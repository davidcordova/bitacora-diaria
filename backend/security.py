"""
Capa de seguridad centralizada de la API de Bitácora.

- Emite y valida tokens de sesión firmados (HMAC, itsdangerous) con expiración.
- Exige autenticación en todos los endpoints /api/* salvo una lista blanca pública.
- Vincula la identidad del solicitante al token: los campos de "actor" que envía el
  cliente (requesting_user_id, created_by, role, ...) se reescriben con el usuario real,
  de modo que nadie pueda suplantar a otro usuario manipulando el cuerpo o la URL.
- Restringe endpoints administrativos y de mantenimiento al rol admin.
- Verifica propiedad antes de modificar actividades o bitácoras por ID.
- Limita intentos fallidos de inicio de sesión (anti fuerza bruta).
"""

import os
import re
import hashlib
import secrets
import time

import nh3
from flask import request, jsonify, g
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from werkzeug.datastructures import ImmutableMultiDict

from database import get_db, DB_PATH

TOKEN_MAX_AGE_SECONDS = 30 * 24 * 3600  # 30 días: compatible con el uso offline-first
TOKEN_SALT = 'bitacora-session-v1'

# Desbloqueo de la bóveda: token corto, firmado y ligado al usuario (enviado en X-Vault-Token)
VAULT_TOKEN_SALT = 'bitacora-vault-unlock-v1'
VAULT_UNLOCK_SECONDS = 15 * 60
VAULT_MAX_FAILED_UNLOCKS = 5

LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_FAILURES_PER_USER = 8
LOGIN_MAX_FAILURES_PER_IP = 25

DATA_DIR = os.path.dirname(os.path.abspath(DB_PATH))


def _read_or_create_secret_file(path, nbytes=48):
    """Lee un secreto persistente o lo crea de forma atómica (seguro entre workers de Gunicorn)."""
    for _ in range(50):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                val = f.read().strip()
            if len(val) >= 32:
                return val
        except FileNotFoundError:
            try:
                fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                val = secrets.token_urlsafe(nbytes)
                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    f.write(val)
                return val
            except FileExistsError:
                pass
        time.sleep(0.05)
    raise RuntimeError(f'No se pudo leer ni crear el secreto de sesión en {path}')


def _get_secret_key():
    env_key = os.environ.get('BITACORA_SECRET_KEY') or os.environ.get('SECRET_KEY')
    if env_key and len(env_key) >= 16:
        return env_key
    return _read_or_create_secret_file(os.path.join(DATA_DIR, '.session_secret'))


_serializer = None


def _get_serializer():
    global _serializer
    if _serializer is None:
        _serializer = URLSafeTimedSerializer(_get_secret_key(), salt=TOKEN_SALT)
    return _serializer


def _password_fingerprint(password_hash):
    """Huella corta del hash de contraseña: cambiar la contraseña invalida las sesiones previas."""
    return hashlib.sha256((password_hash or '').encode('utf-8')).hexdigest()[:16]


def issue_token(user_id, password_hash):
    return _get_serializer().dumps({'uid': int(user_id), 'pv': _password_fingerprint(password_hash)})


def _load_user_from_token(token):
    try:
        data = _get_serializer().loads(token, max_age=TOKEN_MAX_AGE_SECONDS)
    except SignatureExpired:
        return None, 'Tu sesión expiró. Inicia sesión nuevamente.'
    except BadSignature:
        return None, 'Sesión inválida. Inicia sesión nuevamente.'

    conn = get_db()
    row = conn.execute('''
        SELECT u.id, u.username, u.full_name, u.role, u.team_id, u.is_active, u.password_hash,
               COALESCE(u.must_change_password, 0) AS must_change_password
        FROM users u WHERE u.id = ?
    ''', (data.get('uid'),)).fetchone()
    if not row or not row['is_active']:
        return None, 'Usuario no encontrado o desactivado.'
    if data.get('pv') != _password_fingerprint(row['password_hash']):
        return None, 'Tu contraseña cambió. Inicia sesión nuevamente.'
    user = dict(row)
    user.pop('password_hash', None)
    if user['role'] == 'operador':
        user['role'] = 'analista'
    return user, None


# ==================== DESBLOQUEO DE BÓVEDA ====================

def issue_vault_token(user_id):
    s = URLSafeTimedSerializer(_get_secret_key(), salt=VAULT_TOKEN_SALT)
    return s.dumps({'uid': int(user_id)})


def vault_unlocked():
    """True si la petición trae un token de desbloqueo vigente del mismo usuario autenticado."""
    user = getattr(g, 'current_user', None)
    token = request.headers.get('X-Vault-Token', '').strip()
    if not user or not token:
        return False
    try:
        data = URLSafeTimedSerializer(_get_secret_key(), salt=VAULT_TOKEN_SALT).loads(token, max_age=VAULT_UNLOCK_SECONDS)
    except (BadSignature, SignatureExpired):
        return False
    return int(data.get('uid', -1)) == int(user['id'])


# ==================== RATE LIMIT DE LOGIN (tabla login_attempts creada en init_db) ====================

def client_ip():
    fwd = request.headers.get('X-Forwarded-For', '')
    if fwd:
        return fwd.split(',')[0].strip()
    return request.remote_addr or ''


def login_is_throttled(username):
    conn = get_db()
    since = int(time.time()) - LOGIN_WINDOW_SECONDS
    conn.execute('DELETE FROM login_attempts WHERE created_at < ?', (since,))
    by_user = conn.execute('SELECT COUNT(*) FROM login_attempts WHERE username = ? AND created_at >= ?', (username, since)).fetchone()[0]
    by_ip = conn.execute('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND created_at >= ?', (client_ip(), since)).fetchone()[0]
    conn.commit()
    return by_user >= LOGIN_MAX_FAILURES_PER_USER or by_ip >= LOGIN_MAX_FAILURES_PER_IP


def register_login_failure(username):
    conn = get_db()
    conn.execute('INSERT INTO login_attempts (username, ip, created_at) VALUES (?, ?, ?)', (username, client_ip(), int(time.time())))
    conn.commit()


def clear_login_failures(username):
    conn = get_db()
    conn.execute('DELETE FROM login_attempts WHERE username = ?', (username,))
    conn.commit()


# ==================== AUTORIZACIÓN ====================

def _is_public(path, method):
    if method == 'OPTIONS':
        return True
    if path in ('/api/health', '/api/auth/login'):
        return True
    if path == '/api/settings' and method == 'GET':
        return True
    if path.startswith('/api/uploads/') and method == 'GET':
        return True
    return False


def _is_admin_only(path, method):
    if path.startswith('/api/admin/'):
        # Lectura de usuarios y equipos: la usan todas las vistas (selectores, supervisión)
        if method == 'GET' and path in ('/api/admin/users', '/api/admin/teams'):
            return False
        return True
    if path.startswith('/api/cron/'):
        return True
    if path == '/api/settings' and method != 'GET':
        return True
    return False


# Campos que identifican "quién actúa": siempre se fuerzan al usuario autenticado
ACTOR_KEYS = ('requesting_user_id', 'requester_id', 'created_by', 'updated_by', 'assigned_by')

# En estas rutas `user_id` significa "yo" (no un tercero)
SELF_USER_ID_PREFIXES = (
    '/api/it-vault', '/api/quick-links', '/api/notifications', '/api/papelera/vaciar',
    '/api/delegations/my-targets', '/api/sugerencias', '/api/auth/profile',
    '/api/support/report-error',
)

# En estas rutas el cliente envía su propio rol como "permiso": se reemplaza por el real
ROLE_CLAIM_PREFIXES = ('/api/papelera', '/api/sugerencias')


def _rewrite_identity(user):
    path = request.path
    uid = user['id']
    is_admin = user['role'] == 'admin'
    force_self_uid = path.startswith(SELF_USER_ID_PREFIXES) or (
        path == '/api/auth/change-password' and not is_admin
    )
    force_role = path.startswith(ROLE_CLAIM_PREFIXES)

    # Query string: siempre inyectar requesting_user_id real (activa los filtros de privacidad por rol)
    args = request.args.to_dict(flat=False)
    for k in ACTOR_KEYS:
        if k in args:
            args[k] = [str(uid)]
    args['requesting_user_id'] = [str(uid)]
    if force_self_uid and 'user_id' in args:
        args['user_id'] = [str(uid)]
    if force_role and 'role' in args:
        args['role'] = [user['role']]
    request.args = ImmutableMultiDict([(k, v) for k, vals in args.items() for v in vals])

    # Cuerpo JSON (Werkzeug cachea el objeto: las mutaciones son visibles para el endpoint)
    if request.is_json:
        body = request.get_json(silent=True)
        if isinstance(body, dict):
            for k in ACTOR_KEYS:
                if k in body:
                    body[k] = uid
            if request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
                body['requesting_user_id'] = uid
            if force_self_uid and 'user_id' in body:
                body['user_id'] = uid
            if force_role and 'role' in body:
                body['role'] = user['role']


# ---------------------------------------------------------------------------
# Sanitización de texto enriquecido (defensa en profundidad contra XSS almacenado)
# ---------------------------------------------------------------------------
RICH_TEXT_KEYS = frozenset({
    'descripcion', 'comentarios', 'resumen_texto', 'pendientes',
    'apoyo_detalle', 'prioridad_siguiente',
})
_HTML_TAG_RE = re.compile(r'<[a-zA-Z!/?]')
_NH3_TAGS = {
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'mark', 'small', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'span', 'div',
    'a', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
}
_NH3_ATTRS = {
    '*': {'class', 'title'},
    'a': {'href', 'target'},
    'img': {'src', 'alt', 'width', 'height'},
    'td': {'colspan', 'rowspan'},
    'th': {'colspan', 'rowspan'},
}
_NH3_SCHEMES = {'http', 'https', 'mailto', 'tel', 'data'}


def sanitize_rich_text(value):
    """Limpia HTML peligroso. El texto plano (sin etiquetas) se deja intacto para no
    alterar fragmentos de código como `a < b` que escriben los usuarios de TI."""
    if not isinstance(value, str) or not _HTML_TAG_RE.search(value):
        return value
    return nh3.clean(value, tags=_NH3_TAGS, attributes=_NH3_ATTRS, url_schemes=_NH3_SCHEMES)


def _sanitize_payload(node):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in RICH_TEXT_KEYS and isinstance(v, str):
                node[k] = sanitize_rich_text(v)
            elif isinstance(v, (dict, list)):
                _sanitize_payload(v)
    elif isinstance(node, list):
        for item in node:
            _sanitize_payload(item)


def _sanitize_request_body():
    if request.method in ('POST', 'PUT', 'PATCH') and request.is_json:
        body = request.get_json(silent=True)
        if isinstance(body, (dict, list)):
            _sanitize_payload(body)


def user_can_access_owner(user, owner_id):
    """Admin, el propio dueño, su líder de equipo o un delegado activo."""
    if owner_id is None:
        return user['role'] == 'admin'
    if user['role'] == 'admin' or int(owner_id) == int(user['id']):
        return True
    conn = get_db()
    row = conn.execute('''
        SELECT 1 FROM users o
        LEFT JOIN teams t ON o.team_id = t.id
        WHERE o.id = ? AND (t.lider_id = ? OR (? = 'lider' AND o.team_id IS NOT NULL AND o.team_id = ?))
    ''', (owner_id, user['id'], user['role'], user['team_id'])).fetchone()
    if row:
        return True
    row = conn.execute('''
        SELECT 1 FROM user_delegations
        WHERE delegate_user_id = ? AND target_user_id = ? AND is_active = 1
    ''', (user['id'], owner_id)).fetchone()
    return bool(row)


def user_can_review_owner(user, owner_id):
    """Quién puede aprobar/devolver una tarea "En revisión": el admin o el líder del equipo
    del colaborador. Nunca el propio dueño ni un delegado (aprobarse a sí mismo no es control)."""
    if owner_id is None:
        return user['role'] == 'admin'
    if int(owner_id) == int(user['id']):
        return False
    if user['role'] == 'admin':
        return True
    row = get_db().execute('''
        SELECT 1 FROM users o
        LEFT JOIN teams t ON o.team_id = t.id
        WHERE o.id = ? AND (t.lider_id = ? OR (? = 'lider' AND o.team_id IS NOT NULL AND o.team_id = ?))
    ''', (owner_id, user['id'], user['role'], user['team_id'])).fetchone()
    return bool(row)


_ACT_RE = re.compile(r'^/api/actividades/(\d+)(?:/estado|/eliminar)?$')
_TRASH_RE = re.compile(r'^/api/papelera/(?:restaurar|eliminar)/(\d+)$')
_BIT_RE = re.compile(r'^/api/bitacoras/(\d+)$')


def _ownership_denied(user):
    path, method = request.path, request.method
    conn = get_db()
    owner = None
    found = False

    m = _ACT_RE.match(path) or _TRASH_RE.match(path)
    if m and (method != 'GET'):
        row = conn.execute('''
            SELECT b.user_id FROM actividades a JOIN bitacoras b ON a.bitacora_id = b.id WHERE a.id = ?
        ''', (int(m.group(1)),)).fetchone()
        found, owner = bool(row), (row['user_id'] if row else None)
    else:
        m = _BIT_RE.match(path)
        if m:
            row = conn.execute('SELECT user_id FROM bitacoras WHERE id = ?', (int(m.group(1)),)).fetchone()
            found, owner = bool(row), (row['user_id'] if row else None)

    if found and not user_can_access_owner(user, owner):
        return True
    return False


PASSWORD_CHANGE_ALLOWED_PATHS = ('/api/auth/change-password', '/api/auth/profile', '/api/support/report-error')


def register_security(app):
    @app.before_request
    def _enforce_auth():
        path = request.path
        if not path.startswith('/api/'):
            return None
        if _is_public(path, request.method):
            return None

        auth = request.headers.get('Authorization', '')
        token = auth[7:].strip() if auth.lower().startswith('bearer ') else ''
        if not token:
            return jsonify({'error': 'Autenticación requerida', 'code': 'auth_required'}), 401

        user, err = _load_user_from_token(token)
        if not user:
            return jsonify({'error': err, 'code': 'auth_invalid'}), 401
        g.current_user = user

        # Contraseña temporal o por defecto: solo lectura hasta que el usuario la cambie
        if user.get('must_change_password') and request.method not in ('GET', 'HEAD') \
                and path not in PASSWORD_CHANGE_ALLOWED_PATHS:
            return jsonify({
                'error': 'Debes cambiar tu contraseña antes de continuar.',
                'code': 'password_change_required',
            }), 403

        if _is_admin_only(path, request.method) and user['role'] != 'admin':
            return jsonify({'error': 'Acción reservada a administradores'}), 403

        _rewrite_identity(user)
        _sanitize_request_body()

        if _ownership_denied(user):
            return jsonify({'error': 'No tienes permiso sobre este registro'}), 403
        return None

    @app.after_request
    def _security_headers(response):
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
        response.headers.setdefault('Referrer-Policy', 'same-origin')
        return response
