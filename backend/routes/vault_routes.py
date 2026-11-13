import io
import csv
import secrets
import string
import sqlite3
import logging
from flask import Blueprint, request, jsonify, send_file
from werkzeug.security import generate_password_hash, check_password_hash

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
    _HAS_OPENPYXL = True
except ImportError:
    openpyxl = None
    _HAS_OPENPYXL = False

from database import get_db, get_peru_now, get_peru_now_str
from crypto_utils import encrypt_vault_secret, decrypt_vault_secret
from security import (
    issue_vault_token,
    vault_unlocked,
    VAULT_UNLOCK_SECONDS,
    VAULT_MAX_FAILED_UNLOCKS,
)
from helpers import _mask_vault_secrets

logger = logging.getLogger('bitacora')
vault_bp = Blueprint('vault_routes', __name__)


# =========================================================================
# RUTAS REST: ACCESOS DIRECTOS (QUICK LINKS)
# =========================================================================

@vault_bp.route('/api/quick-links', methods=['GET', 'POST', 'OPTIONS'])
def api_quick_links():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        user_id = request.args.get('user_id', type=int)
        categoria = request.args.get('categoria', '').strip()
        search = request.args.get('search', '').strip().lower()

        user_team_id = None
        user_role = 'analista'
        if user_id:
            cursor.execute("SELECT team_id, role FROM users WHERE id = ?", (user_id,))
            u_row = cursor.fetchone()
            if u_row:
                user_team_id = u_row['team_id']
                user_role = u_row['role'] or 'analista'

        query = '''
            SELECT q.*, u.full_name as author_name, t.nombre as team_name
            FROM quick_links q
            LEFT JOIN users u ON q.user_id = u.id
            LEFT JOIN teams t ON q.team_id = t.id
            WHERE 1=1
        '''
        params = []

        if user_role not in ('admin', 'lider'):
            if user_id:
                if user_team_id:
                    query += " AND (q.visibilidad = 'global' OR (q.visibilidad = 'equipo' AND q.team_id = ?) OR (q.visibilidad = 'personal' AND q.user_id = ?))"
                    params.extend([user_team_id, user_id])
                else:
                    query += " AND (q.visibilidad = 'global' OR (q.visibilidad = 'personal' AND q.user_id = ?))"
                    params.append(user_id)
            else:
                query += " AND q.visibilidad = 'global'"

        if categoria and categoria != 'todas':
            query += " AND q.categoria = ?"
            params.append(categoria)

        if search:
            query += " AND (LOWER(q.titulo) LIKE ? OR LOWER(q.url) LIKE ? OR LOWER(COALESCE(q.descripcion, '')) LIKE ?)"
            s_param = f"%{search}%"
            params.extend([s_param, s_param, s_param])

        query += " ORDER BY q.updated_at DESC, q.titulo ASC"
        cursor.execute(query, params)
        raw_links = cursor.fetchall()
        links = []
        unlocked = vault_unlocked()
        for row in raw_links:
            item = dict(row)
            _mask_vault_secrets(item, ('password',), unlocked)
            links.append(item)
        conn.close()
        return jsonify(links), 200

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        user_id = data.get('user_id')
        titulo = (data.get('titulo') or '').strip()
        url = (data.get('url') or '').strip()

        if not user_id or not titulo or not url:
            conn.close()
            return jsonify({"error": "user_id, titulo y url son obligatorios"}), 400

        cursor.execute("SELECT team_id FROM users WHERE id = ?", (user_id,))
        u_row = cursor.fetchone()
        team_id = u_row['team_id'] if u_row else None

        categoria = (data.get('categoria') or 'General').strip()
        descripcion = (data.get('descripcion') or '').strip()
        icono = (data.get('icono') or 'Link').strip()
        color = (data.get('color') or '#0284C7').strip()
        usuario = (data.get('usuario') or '').strip()
        raw_password = (data.get('password') or '').strip()
        password = encrypt_vault_secret(raw_password) if raw_password else ''
        visibilidad = data.get('visibilidad', 'personal')
        if visibilidad not in ('personal', 'equipo', 'global'):
            visibilidad = 'personal'

        now_peru = get_peru_now()
        cursor.execute('''
            INSERT INTO quick_links (
                user_id, titulo, url, categoria, descripcion, icono, color,
                usuario, password, visibilidad, team_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, titulo, url, categoria, descripcion, icono, color,
              usuario, password, visibilidad, team_id, now_peru, now_peru))
        new_id = cursor.lastrowid
        conn.commit()

        cursor.execute('''
            SELECT q.*, u.full_name as author_name, t.nombre as team_name
            FROM quick_links q
            LEFT JOIN users u ON q.user_id = u.id
            LEFT JOIN teams t ON q.team_id = t.id
            WHERE q.id = ?
        ''', (new_id,))
        created_item = dict(cursor.fetchone())
        if created_item.get('password'):
            created_item['password'] = decrypt_vault_secret(created_item['password'])
        conn.close()
        return jsonify(created_item), 201


@vault_bp.route('/api/quick-links/<int:link_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
def api_quick_link_detail(link_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM quick_links WHERE id = ?", (link_id,))
    link = cursor.fetchone()
    if not link:
        conn.close()
        return jsonify({"error": "Acceso directo no encontrado"}), 404

    if request.method == 'DELETE':
        user_id = request.args.get('user_id', type=int)
        cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        u = cursor.fetchone()
        is_admin = u and u['role'] == 'admin'

        if not is_admin and link['user_id'] != user_id:
            conn.close()
            return jsonify({"error": "No tienes permiso para eliminar este enlace"}), 403

        cursor.execute("DELETE FROM quick_links WHERE id = ?", (link_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True}), 200

    if request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        user_id = data.get('user_id')
        cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        u = cursor.fetchone()
        is_admin = u and u['role'] == 'admin'

        if not is_admin and link['user_id'] != user_id:
            conn.close()
            return jsonify({"error": "No tienes permiso para modificar este enlace"}), 403

        titulo = (data.get('titulo') or link['titulo']).strip()
        url = (data.get('url') or link['url']).strip()
        categoria = (data.get('categoria') or link['categoria']).strip()
        descripcion = (data.get('descripcion') if 'descripcion' in data else link['descripcion']) or ''
        icono = data.get('icono') or link['icono']
        color = data.get('color') or link['color']
        usuario = data.get('usuario') if 'usuario' in data else link['usuario']
        if 'password' in data:
            raw_pass = (data.get('password') or '').strip()
            if raw_pass:
                password = encrypt_vault_secret(raw_pass)
            elif data.get('clear_password'):
                password = ''
            else:
                password = link['password']
        else:
            password = link['password']
        visibilidad = data.get('visibilidad') or link['visibilidad']

        now_peru = get_peru_now()
        cursor.execute('''
            UPDATE quick_links SET
                titulo = ?, url = ?, categoria = ?, descripcion = ?,
                icono = ?, color = ?, usuario = ?, password = ?,
                visibilidad = ?, updated_at = ?
            WHERE id = ?
        ''', (titulo, url, categoria, descripcion, icono, color, usuario, password, visibilidad, now_peru, link_id))
        conn.commit()

        cursor.execute('''
            SELECT q.*, u.full_name as author_name, t.nombre as team_name
            FROM quick_links q
            LEFT JOIN users u ON q.user_id = u.id
            LEFT JOIN teams t ON q.team_id = t.id
            WHERE q.id = ?
        ''', (link_id,))
        updated_item = dict(cursor.fetchone())
        _mask_vault_secrets(updated_item, ('password',), vault_unlocked())
        conn.close()
        return jsonify(updated_item), 200


# =========================================================================
# RUTAS REST: BÓVEDA IT CORPORATIVA (MULTI-EMPRESA / MARCAS / CREDENCIALES)
# =========================================================================

@vault_bp.route('/api/it-vault/empresas', methods=['GET', 'POST', 'OPTIONS'])
def api_it_empresas():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        cursor.execute("SELECT * FROM it_empresas ORDER BY nombre ASC")
        empresas = [dict(row) for row in cursor.fetchall()]
        for emp in empresas:
            cursor.execute("SELECT * FROM it_marcas WHERE empresa_id = ? ORDER BY nombre ASC", (emp['id'],))
            emp['marcas'] = [dict(m) for m in cursor.fetchall()]
        conn.close()
        return jsonify(empresas), 200

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        nombre = (data.get('nombre') or '').strip()
        color = data.get('color', '#0284C7')
        if not nombre:
            conn.close()
            return jsonify({"error": "El nombre de la empresa es obligatorio"}), 400

        try:
            cursor.execute("INSERT INTO it_empresas (nombre, color) VALUES (?, ?)", (nombre, color))
            new_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return jsonify({"id": new_id, "nombre": nombre, "color": color, "marcas": []}), 201
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({"error": "Ya existe una empresa con ese nombre"}), 400


@vault_bp.route('/api/it-vault/marcas', methods=['POST', 'OPTIONS'])
def api_it_marcas():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json(silent=True) or {}
    empresa_id = data.get('empresa_id')
    nombre = (data.get('nombre') or '').strip()
    if not empresa_id or not nombre:
        return jsonify({"error": "empresa_id y nombre son obligatorios"}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO it_marcas (empresa_id, nombre) VALUES (?, ?)", (empresa_id, nombre))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"id": new_id, "empresa_id": empresa_id, "nombre": nombre}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Esta marca ya existe para la empresa seleccionada"}), 400


@vault_bp.route('/api/it-vault/credentials', methods=['GET', 'POST', 'OPTIONS'])
def api_it_credentials():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        user_id = request.args.get('user_id', type=int)
        empresa_id = request.args.get('empresa_id', type=int)
        marca_id = request.args.get('marca_id', type=int)
        tipo_servicio = request.args.get('tipo_servicio', '').strip()
        search = request.args.get('search', '').strip().lower()

        user_role = 'analista'
        if user_id:
            cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
            ur = cursor.fetchone()
            if ur:
                user_role = ur['role'] or 'analista'

        is_admin_or_leader = user_role in ('admin', 'lider')

        query = '''
            SELECT c.*, 
                   e.nombre as empresa_nombre, e.color as empresa_color,
                   m.nombre as marca_nombre,
                   u.full_name as author_name,
                   COALESCE(p.can_view, 0) as user_can_view,
                   COALESCE(p.can_edit, 0) as user_can_edit
            FROM it_credentials c
            JOIN it_empresas e ON c.empresa_id = e.id
            LEFT JOIN it_marcas m ON c.marca_id = m.id
            LEFT JOIN users u ON c.created_by = u.id
            LEFT JOIN it_credential_permissions p ON p.credential_id = c.id AND p.user_id = ?
            WHERE c.is_active = 1
        '''
        params = [user_id or 0]

        if not is_admin_or_leader:
            query += " AND (c.created_by = ? OR p.can_view = 1)"
            params.append(user_id or 0)

        if empresa_id:
            query += " AND c.empresa_id = ?"
            params.append(empresa_id)

        if marca_id:
            query += " AND c.marca_id = ?"
            params.append(marca_id)

        if tipo_servicio and tipo_servicio != 'todas':
            query += " AND c.tipo_servicio = ?"
            params.append(tipo_servicio)

        if search:
            query += " AND (LOWER(c.plataforma) LIKE ? OR LOWER(c.usuario_login) LIKE ? OR LOWER(COALESCE(c.notas, '')) LIKE ? OR LOWER(e.nombre) LIKE ?)"
            s_param = f"%{search}%"
            params.extend([s_param, s_param, s_param, s_param])

        query += " ORDER BY e.nombre ASC, m.nombre ASC, c.plataforma ASC"
        cursor.execute(query, params)
        rows = cursor.fetchall()

        results = []
        unlocked = vault_unlocked()
        for r in rows:
            item = dict(r)
            _mask_vault_secrets(item, ('password_secret',), unlocked)
            if is_admin_or_leader or item['created_by'] == user_id:
                item['can_view'] = True
                item['can_edit'] = True
            else:
                item['can_view'] = bool(item.get('user_can_view'))
                item['can_edit'] = bool(item.get('user_can_edit'))
            results.append(item)

        conn.close()
        return jsonify(results), 200

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        user_id = data.get('created_by') or data.get('user_id')
        empresa_id = data.get('empresa_id')
        marca_id = data.get('marca_id')
        plataforma = (data.get('plataforma') or '').strip()
        tipo_servicio = (data.get('tipo_servicio') or 'General').strip()
        url_acceso = (data.get('url_acceso') or '').strip()
        usuario_login = (data.get('usuario_login') or '').strip()
        raw_secret = (data.get('password_secret') or '').strip()
        password_secret = encrypt_vault_secret(raw_secret) if raw_secret else ''
        notas = (data.get('notas') or '').strip()
        tipo_cuenta = data.get('tipo_cuenta', 'operativa')
        permissions = data.get('permissions', [])

        if not user_id or not empresa_id or not plataforma or not usuario_login or not raw_secret:
            conn.close()
            return jsonify({"error": "empresa_id, plataforma, usuario_login y password_secret son requeridos"}), 400

        now_peru = get_peru_now_str()
        cursor.execute('''
            INSERT INTO it_credentials (
                empresa_id, marca_id, plataforma, tipo_servicio, url_acceso,
                usuario_login, password_secret, notas, tipo_cuenta, created_by,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (empresa_id, marca_id, plataforma, tipo_servicio, url_acceso,
              usuario_login, password_secret, notas, tipo_cuenta, user_id, now_peru, now_peru))
        cred_id = cursor.lastrowid

        cursor.execute('''
            INSERT OR REPLACE INTO it_credential_permissions (credential_id, user_id, can_view, can_edit, assigned_by)
            VALUES (?, ?, 1, 1, ?)
        ''', (cred_id, user_id, user_id))

        for p in permissions:
            u_p_id = p.get('user_id')
            if u_p_id and u_p_id != user_id:
                c_view = 1 if p.get('can_view') else 0
                c_edit = 1 if p.get('can_edit') else 0
                cursor.execute('''
                    INSERT OR REPLACE INTO it_credential_permissions (credential_id, user_id, can_view, can_edit, assigned_by)
                    VALUES (?, ?, ?, ?, ?)
                ''', (cred_id, u_p_id, c_view, c_edit, user_id))

        cursor.execute('''
            INSERT INTO it_credential_audit (credential_id, user_id, action, ip_or_agent)
            VALUES (?, ?, 'create', ?)
        ''', (cred_id, user_id, request.remote_addr))

        conn.commit()
        conn.close()
        return jsonify({"id": cred_id, "success": True}), 201


@vault_bp.route('/api/it-vault/credentials/<int:cred_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
def api_it_credential_detail(cred_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM it_credentials WHERE id = ? AND is_active = 1", (cred_id,))
    cred = cursor.fetchone()
    if not cred:
        conn.close()
        return jsonify({"error": "Credencial no encontrada"}), 404

    if request.method == 'DELETE':
        user_id = request.args.get('user_id', type=int)
        cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        u = cursor.fetchone()
        is_admin = u and u['role'] in ('admin', 'lider')

        if not is_admin and cred['created_by'] != user_id:
            conn.close()
            return jsonify({"error": "No tienes permiso para eliminar esta credencial"}), 403

        cursor.execute("UPDATE it_credentials SET is_active = 0 WHERE id = ?", (cred_id,))
        cursor.execute('''
            INSERT INTO it_credential_audit (credential_id, user_id, action, ip_or_agent)
            VALUES (?, ?, 'delete', ?)
        ''', (cred_id, user_id, request.remote_addr))
        conn.commit()
        conn.close()
        return jsonify({"success": True}), 200

    if request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        user_id = data.get('updated_by') or data.get('user_id')
        cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        u = cursor.fetchone()
        is_admin = u and u['role'] in ('admin', 'lider')

        cursor.execute("SELECT can_edit FROM it_credential_permissions WHERE credential_id = ? AND user_id = ?", (cred_id, user_id))
        perm = cursor.fetchone()
        can_edit = (perm and perm['can_edit'] == 1) or is_admin or (cred['created_by'] == user_id)

        if not can_edit:
            conn.close()
            return jsonify({"error": "No tienes permiso de edición sobre esta credencial"}), 403

        empresa_id = data.get('empresa_id') or cred['empresa_id']
        marca_id = data.get('marca_id') if 'marca_id' in data else cred['marca_id']
        plataforma = (data.get('plataforma') or cred['plataforma']).strip()
        tipo_servicio = (data.get('tipo_servicio') or cred['tipo_servicio']).strip()
        url_acceso = data.get('url_acceso') if 'url_acceso' in data else cred['url_acceso']
        usuario_login = (data.get('usuario_login') or cred['usuario_login']).strip()
        if 'password_secret' in data:
            raw_secret = (data.get('password_secret') or '').strip()
            if raw_secret:
                password_secret = encrypt_vault_secret(raw_secret)
            elif data.get('clear_password'):
                password_secret = ''
            else:
                password_secret = cred['password_secret']
        else:
            password_secret = cred['password_secret']
        notas = data.get('notas') if 'notas' in data else cred['notas']
        tipo_cuenta = data.get('tipo_cuenta') or cred['tipo_cuenta']

        now_peru = get_peru_now_str()
        cursor.execute('''
            UPDATE it_credentials SET
                empresa_id = ?, marca_id = ?, plataforma = ?, tipo_servicio = ?,
                url_acceso = ?, usuario_login = ?, password_secret = ?,
                notas = ?, tipo_cuenta = ?, updated_by = ?, updated_at = ?
            WHERE id = ?
        ''', (empresa_id, marca_id, plataforma, tipo_servicio, url_acceso,
              usuario_login, password_secret, notas, tipo_cuenta, user_id, now_peru, cred_id))

        cursor.execute('''
            INSERT INTO it_credential_audit (credential_id, user_id, action, ip_or_agent)
            VALUES (?, ?, 'update', ?)
        ''', (cred_id, user_id, request.remote_addr))

        conn.commit()
        conn.close()
        return jsonify({"success": True}), 200


@vault_bp.route('/api/it-vault/credentials/<int:cred_id>/audit', methods=['POST', 'OPTIONS'])
def api_it_credential_audit(cred_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    action = data.get('action') or 'view_password'
    if not user_id:
        return jsonify({"error": "user_id es requerido"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO it_credential_audit (credential_id, user_id, action, ip_or_agent)
        VALUES (?, ?, ?, ?)
    ''', (cred_id, user_id, action, request.remote_addr))
    conn.commit()
    conn.close()
    return jsonify({"success": True}), 201


@vault_bp.route('/api/it-vault/credentials/<int:cred_id>/permissions', methods=['GET', 'PUT', 'OPTIONS'])
def api_it_credential_permissions(cred_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        cursor.execute('''
            SELECT u.id as user_id, u.full_name, u.username, u.role,
                   COALESCE(p.can_view, 0) as can_view,
                   COALESCE(p.can_edit, 0) as can_edit
            FROM users u
            LEFT JOIN it_credential_permissions p ON p.user_id = u.id AND p.credential_id = ?
            WHERE u.is_active = 1
            ORDER BY u.full_name ASC
        ''', (cred_id,))
        permissions = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify(permissions), 200

    if request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        assigned_by = data.get('assigned_by')
        permissions_list = data.get('permissions', [])

        cursor.execute("SELECT role FROM users WHERE id = ?", (assigned_by,))
        u = cursor.fetchone()
        if not u or u['role'] not in ('admin', 'lider'):
            conn.close()
            return jsonify({"error": "Solo administradores o líderes pueden configurar permisos"}), 403

        for perm in permissions_list:
            target_user_id = perm.get('user_id')
            can_view = 1 if perm.get('can_view') else 0
            can_edit = 1 if perm.get('can_edit') else 0
            cursor.execute('''
                INSERT INTO it_credential_permissions (credential_id, user_id, can_view, can_edit, assigned_by)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(credential_id, user_id) DO UPDATE SET
                    can_view = excluded.can_view,
                    can_edit = excluded.can_edit,
                    assigned_by = excluded.assigned_by
            ''', (cred_id, target_user_id, can_view, can_edit, assigned_by))

        conn.commit()
        conn.close()
        return jsonify({"success": True}), 200


# =========================================================================
# RUTAS REST: DIRECTORIO DE USUARIOS POR PLATAFORMA (SOPORTE Y RESETEO)
# =========================================================================

@vault_bp.route('/api/it-vault/platform-users', methods=['GET', 'POST', 'OPTIONS'])
def api_it_platform_users():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        empresa_id = request.args.get('empresa_id', type=int)
        marca_id = request.args.get('marca_id', type=int)
        plataforma = request.args.get('plataforma', '').strip()
        search = request.args.get('search', '').strip().lower()
        estado = request.args.get('estado', '').strip()

        query = '''
            SELECT pu.*, 
                   e.nombre as empresa_nombre, e.color as empresa_color,
                   m.nombre as marca_nombre,
                   u.full_name as created_by_name
            FROM it_platform_users pu
            JOIN it_empresas e ON pu.empresa_id = e.id
            LEFT JOIN it_marcas m ON pu.marca_id = m.id
            LEFT JOIN users u ON pu.created_by = u.id
            WHERE 1=1
        '''
        params = []

        if empresa_id:
            query += " AND pu.empresa_id = ?"
            params.append(empresa_id)

        if marca_id:
            query += " AND pu.marca_id = ?"
            params.append(marca_id)

        if plataforma and plataforma != 'todas':
            query += " AND pu.plataforma = ?"
            params.append(plataforma)

        if estado and estado != 'todos':
            query += " AND pu.estado = ?"
            params.append(estado)

        if search:
            query += " AND (LOWER(pu.colaborador_nombre) LIKE ? OR LOWER(pu.usuario_login) LIKE ? OR LOWER(COALESCE(pu.colaborador_email, '')) LIKE ? OR LOWER(COALESCE(pu.colaborador_cargo, '')) LIKE ?)"
            s_param = f"%{search}%"
            params.extend([s_param, s_param, s_param, s_param])

        query += " ORDER BY pu.colaborador_nombre ASC, pu.plataforma ASC"
        cursor.execute(query, params)
        raw_users = cursor.fetchall()
        users_list = []
        unlocked = vault_unlocked()
        for row in raw_users:
            item = dict(row)
            _mask_vault_secrets(item, ('password_actual', 'password_anterior'), unlocked)
            users_list.append(item)
        conn.close()
        return jsonify(users_list), 200

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        empresa_id = data.get('empresa_id')
        marca_id = data.get('marca_id') or None
        plataforma = (data.get('plataforma') or '').strip()
        colaborador_nombre = (data.get('colaborador_nombre') or '').strip()
        colaborador_cargo = (data.get('colaborador_cargo') or '').strip()
        colaborador_email = (data.get('colaborador_email') or '').strip()
        colaborador_telefono = (data.get('colaborador_telefono') or '').strip()
        usuario_login = (data.get('usuario_login') or '').strip()
        raw_password = (data.get('password_actual') or '').strip()
        password_actual = encrypt_vault_secret(raw_password) if raw_password else ''
        estado = data.get('estado') or 'activo'
        notas = (data.get('notas') or '').strip()
        created_by = data.get('created_by') or 1

        if not empresa_id or not plataforma or not colaborador_nombre or not usuario_login or not raw_password:
            conn.close()
            return jsonify({"error": "Empresa, Plataforma, Colaborador, Usuario y Contraseña son obligatorios"}), 400

        now_peru = get_peru_now_str()
        cursor.execute('''
            INSERT INTO it_platform_users (
                empresa_id, marca_id, plataforma, colaborador_nombre, colaborador_cargo,
                colaborador_email, colaborador_telefono, usuario_login, password_actual,
                estado, ultimo_reseteo, notas, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (empresa_id, marca_id, plataforma, colaborador_nombre, colaborador_cargo,
              colaborador_email, colaborador_telefono, usuario_login, password_actual,
              estado, now_peru, notas, created_by, now_peru, now_peru))
        new_id = cursor.lastrowid
        conn.commit()

        cursor.execute('''
            SELECT pu.*, e.nombre as empresa_nombre, e.color as empresa_color, m.nombre as marca_nombre
            FROM it_platform_users pu
            JOIN it_empresas e ON pu.empresa_id = e.id
            LEFT JOIN it_marcas m ON pu.marca_id = m.id
            WHERE pu.id = ?
        ''', (new_id,))
        created_row = dict(cursor.fetchone())
        if created_row.get('password_actual'):
            created_row['password_actual'] = decrypt_vault_secret(created_row['password_actual'])
        conn.close()
        return jsonify(created_row), 201


@vault_bp.route('/api/it-vault/platform-users/<int:user_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
def api_it_platform_user_detail(user_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM it_platform_users WHERE id = ?", (user_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Cuenta de usuario no encontrada"}), 404

    if request.method == 'DELETE':
        cursor.execute("DELETE FROM it_platform_users WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True}), 200

    if request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        empresa_id = data.get('empresa_id') or existing['empresa_id']
        marca_id = data.get('marca_id') if 'marca_id' in data else existing['marca_id']
        plataforma = (data.get('plataforma') or existing['plataforma']).strip()
        colaborador_nombre = (data.get('colaborador_nombre') or existing['colaborador_nombre']).strip()
        colaborador_cargo = (data.get('colaborador_cargo') if 'colaborador_cargo' in data else existing['colaborador_cargo']) or ''
        colaborador_email = (data.get('colaborador_email') if 'colaborador_email' in data else existing['colaborador_email']) or ''
        colaborador_telefono = (data.get('colaborador_telefono') if 'colaborador_telefono' in data else existing['colaborador_telefono']) or ''
        usuario_login = (data.get('usuario_login') or existing['usuario_login']).strip()
        if 'password_actual' in data:
            raw_password = (data.get('password_actual') or '').strip()
            if raw_password:
                password_actual = encrypt_vault_secret(raw_password)
            else:
                password_actual = existing['password_actual']
        else:
            password_actual = existing['password_actual']
        estado = data.get('estado') or existing['estado']
        notas = (data.get('notas') if 'notas' in data else existing['notas']) or ''
        updated_by = data.get('updated_by')

        now_peru = get_peru_now_str()
        cursor.execute('''
            UPDATE it_platform_users SET
                empresa_id = ?, marca_id = ?, plataforma = ?, colaborador_nombre = ?,
                colaborador_cargo = ?, colaborador_email = ?, colaborador_telefono = ?,
                usuario_login = ?, password_actual = ?, estado = ?, notas = ?,
                updated_by = ?, updated_at = ?
            WHERE id = ?
        ''', (empresa_id, marca_id, plataforma, colaborador_nombre, colaborador_cargo,
              colaborador_email, colaborador_telefono, usuario_login, password_actual,
              estado, notas, updated_by, now_peru, user_id))
        conn.commit()

        cursor.execute('''
            SELECT pu.*, e.nombre as empresa_nombre, e.color as empresa_color, m.nombre as marca_nombre
            FROM it_platform_users pu
            JOIN it_empresas e ON pu.empresa_id = e.id
            LEFT JOIN it_marcas m ON pu.marca_id = m.id
            WHERE pu.id = ?
        ''', (user_id,))
        updated_row = dict(cursor.fetchone())
        _mask_vault_secrets(updated_row, ('password_actual', 'password_anterior'), vault_unlocked())
        conn.close()
        return jsonify(updated_row), 200


@vault_bp.route('/api/it-vault/platform-users/<int:user_id>/reset-password', methods=['POST', 'OPTIONS'])
def api_it_platform_user_reset_password(user_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT pu.*, e.nombre as empresa_nombre FROM it_platform_users pu JOIN it_empresas e ON pu.empresa_id = e.id WHERE pu.id = ?", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Cuenta de usuario no encontrada"}), 404

    data = request.get_json(silent=True) or {}
    new_password = (data.get('new_password') or '').strip()
    reset_by = data.get('reset_by')

    if not new_password:
        alphabet = string.ascii_letters + string.digits + "!@#$%&*"
        new_password = ''.join(secrets.choice(alphabet) for _ in range(14))

    now_peru = get_peru_now_str()
    encrypted_new = encrypt_vault_secret(new_password)
    cursor.execute('''
        UPDATE it_platform_users SET
            password_anterior = password_actual,
            password_actual = ?,
            ultimo_reseteo = ?,
            updated_by = ?,
            updated_at = ?
        WHERE id = ?
    ''', (encrypted_new, now_peru, reset_by, now_peru, user_id))
    conn.commit()

    colab = row['colaborador_nombre']
    plat = row['plataforma']
    login = row['usuario_login']
    emp = row['empresa_nombre']

    share_message = (
        f"Hola {colab}, el área de Sistemas de {emp} te comparte tus credenciales actualizadas:\n\n"
        f"Plataforma: {plat}\n"
        f"Usuario: {login}\n"
        f"Contraseña temporal: {new_password}\n\n"
        f"Por seguridad, te sugerimos cambiar tu contraseña al iniciar sesión o mantenerla en un lugar seguro."
    )

    conn.close()
    return jsonify({
        "success": True,
        "new_password": new_password,
        "ultimo_reseteo": now_peru,
        "share_message": share_message
    }), 200


# =========================================================================
# EXCEL & IMPORTACIÓN MASIVA: CUENTAS DE USUARIOS POR PLATAFORMA
# =========================================================================

def normalize_excel_header(h):
    if not h:
        return ""
    h = str(h).strip().lower()
    for char, rep in [("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ñ", "n"), ("*", ""), (" ", "_"), ("-", "_"), (".", "")]:
        h = h.replace(char, rep)
    return h.strip('_')


def map_row_to_account_dict(raw_dict):
    res = {
        'empresa': '',
        'marca': '',
        'plataforma': '',
        'colaborador_nombre': '',
        'colaborador_cargo': '',
        'colaborador_email': '',
        'colaborador_telefono': '',
        'usuario_login': '',
        'password_actual': '',
        'estado': 'activo',
        'notas': '',
    }

    for key, val in raw_dict.items():
        k = normalize_excel_header(key)
        v = str(val).strip() if val is not None else ""
        if not v or v.lower() == 'none':
            v = ""

        if k in ['empresa', 'empresa_nombre', 'company']:
            res['empresa'] = v
        elif k in ['marca', 'marca_nombre', 'brand']:
            res['marca'] = v
        elif k in ['plataforma', 'platform', 'servicio', 'sistema']:
            res['plataforma'] = v
        elif k in ['colaborador', 'colaborador_nombre', 'nombre', 'nombre_colaborador', 'empleado', 'usuario_nombre']:
            res['colaborador_nombre'] = v
        elif k in ['cargo', 'colaborador_cargo', 'puesto', 'rol', 'posicion']:
            res['colaborador_cargo'] = v
        elif k in ['email', 'email_colaborador', 'correo', 'correo_colaborador', 'colaborador_email', 'mail']:
            res['colaborador_email'] = v
        elif k in ['telefono', 'colaborador_telefono', 'celular', 'whatsapp', 'phone']:
            res['colaborador_telefono'] = v
        elif k in ['usuario_login', 'usuario', 'login', 'user', 'cuenta', 'username']:
            res['usuario_login'] = v
        elif k in ['password', 'password_actual', 'contrasena', 'clave', 'pass', 'clave_acceso']:
            res['password_actual'] = v
        elif k in ['estado', 'status']:
            st = v.lower()
            if any(x in st for x in ['crear', 'alta', 'pendiente', 'nueva']):
                res['estado'] = 'por_crear'
            elif any(x in st for x in ['susp', 'paus', 'inact']):
                res['estado'] = 'suspendido'
            elif any(x in st for x in ['baja', 'elim', 'cesad']):
                res['estado'] = 'baja'
            else:
                res['estado'] = 'activo'
        elif k in ['notas', 'nota', 'observaciones', 'observacion', 'comentarios']:
            res['notas'] = v

    return res


def parse_accounts_from_filestorage(file_storage):
    filename = file_storage.filename or ''
    lower_fn = filename.lower()
    raw_dicts = []

    if lower_fn.endswith('.csv'):
        raw_bytes = file_storage.read()
        decoded = None
        for enc in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
            try:
                decoded = raw_bytes.decode(enc)
                break
            except Exception:
                pass
        if decoded is None:
            raise ValueError("No se pudo decodificar el archivo CSV.")

        sample = decoded[:2048]
        delimiter = ';' if sample.count(';') > sample.count(',') else ','
        reader = csv.reader(io.StringIO(decoded), delimiter=delimiter)
        rows = list(reader)
        if not rows:
            return []

        header_idx = -1
        for i, r in enumerate(rows[:20]):
            non_empty = [c for c in r if c is not None and str(c).strip()]
            if len(non_empty) >= 3:
                r_str = " ".join([str(c).lower() for c in non_empty])
                if 'empresa' in r_str and ('colaborador' in r_str or 'usuario' in r_str or 'plataforma' in r_str):
                    header_idx = i
                    break
        if header_idx == -1:
            for i, r in enumerate(rows[:20]):
                if len([c for c in r if c is not None and str(c).strip()]) >= 3:
                    header_idx = i
                    break
        if header_idx == -1:
            header_idx = 0

        headers = [normalize_excel_header(c) for c in rows[header_idx]]
        for r in rows[header_idx + 1:]:
            if not any(str(c).strip() for c in r):
                continue
            item = {}
            for idx, h in enumerate(headers):
                if h and idx < len(r):
                    item[h] = str(r[idx]).strip()
            if item:
                raw_dicts.append(item)
    else:
        if not _HAS_OPENPYXL:
            raise ValueError("El servidor requiere 'openpyxl' para procesar archivos .xlsx. Por favor suba su archivo en formato .csv delimitado por comas o punto y coma, o ejecute 'pip install openpyxl' en el servidor.")
        wb = openpyxl.load_workbook(file_storage, data_only=True)
        ws = None
        for name in ['Cuentas_Plataforma', 'Cuentas', 'Usuarios', 'Hoja1', 'Sheet1']:
            if name in wb.sheetnames:
                ws = wb[name]
                break
        if ws is None:
            ws = wb.active

        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []

        header_idx = -1
        for i, r in enumerate(rows[:20]):
            non_empty = [c for c in r if c is not None and str(c).strip()]
            if len(non_empty) >= 3:
                r_str = " ".join([str(c or '').lower() for c in non_empty])
                if 'empresa' in r_str and ('colaborador' in r_str or 'usuario' in r_str or 'plataforma' in r_str):
                    header_idx = i
                    break
        if header_idx == -1:
            for i, r in enumerate(rows[:20]):
                if len([c for c in r if c is not None and str(c).strip()]) >= 3:
                    header_idx = i
                    break
        if header_idx == -1:
            header_idx = 0

        headers = [normalize_excel_header(c) for c in rows[header_idx]]
        for r in rows[header_idx + 1:]:
            if not any(c is not None and str(c).strip() for c in r):
                continue
            item = {}
            for idx, h in enumerate(headers):
                if h and idx < len(r):
                    val = r[idx]
                    item[h] = str(val).strip() if val is not None else ""
            if item:
                raw_dicts.append(item)

    mapped = []
    for r in raw_dicts:
        acc = map_row_to_account_dict(r)
        if not acc['empresa'] and not acc['plataforma'] and not acc['colaborador_nombre'] and not acc['usuario_login']:
            continue
        mapped.append(acc)
    return mapped


@vault_bp.route('/api/it-vault/platform-users/template', methods=['GET'])
def api_it_platform_users_template():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT nombre FROM it_empresas ORDER BY nombre ASC")
    db_empresas = [r[0] for r in cursor.fetchall()]
    cursor.execute("SELECT nombre, tipo_servicio FROM it_plataformas ORDER BY nombre ASC")
    db_plataformas = cursor.fetchall()
    conn.close()

    if not _HAS_OPENPYXL:
        output = io.StringIO()
        output.write('\ufeff')
        writer = csv.writer(output, delimiter=';')
        writer.writerow(["Empresa *", "Marca", "Plataforma *", "Colaborador *", "Cargo", "Email_Colaborador", "Telefono", "Usuario_Login *", "Password *", "Estado", "Notas"])
        def_emp = db_empresas[0] if db_empresas else "Marketing Alterno"
        writer.writerow([def_emp, def_emp, "Zimbra Mail", "Juan Carlos Pérez Flores", "Diseñador Gráfico", "juan.perez@alterno.pe", "+51 987654321", "jperez@alterno.pe", "Temp#Pass2026!", "activo", "Buzón de correo"])
        writer.writerow([def_emp, def_emp, "Odoo ERP", "María Elena Gómez Silva", "Analista Contable", "mgomez@alterno.pe", "+51 912345678", "mgomez", "Odoo#Mkt2026!", "activo", "Módulos de compras"])
        buf = io.BytesIO(output.getvalue().encode('utf-8-sig'))
        return send_file(buf, mimetype='text/csv', as_attachment=True, download_name='Plantilla_Cuentas_Plataforma.csv')

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Cuentas_Plataforma"
    ws.views.sheetView[0].showGridLines = True

    ws.merge_cells('A1:K1')
    ws['A1'] = "SISTEMAS TI - PLANTILLA DE IMPORTACIÓN MASIVA DE CUENTAS POR PLATAFORMA"
    ws['A1'].font = Font(name='Calibri', size=13, bold=True, color='FFFFFF')
    ws['A1'].fill = PatternFill(start_color='0F172A', end_color='0F172A', fill_type='solid')
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 32

    ws.merge_cells('A2:K2')
    ws['A2'] = "Instrucciones: Complete los datos a partir de la fila 4. Las columnas con (*) son obligatorias. Las contraseñas se guardarán cifradas (Fernet). Borre este archivo después de importarlo."
    ws['A2'].font = Font(name='Calibri', size=10, italic=True, color='475569')
    ws['A2'].fill = PatternFill(start_color='F1F5F9', end_color='F1F5F9', fill_type='solid')
    ws['A2'].alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws.row_dimensions[2].height = 24

    headers = [
        ("Empresa *", 20),
        ("Marca", 18),
        ("Plataforma *", 24),
        ("Colaborador *", 28),
        ("Cargo", 24),
        ("Email_Colaborador", 26),
        ("Telefono", 18),
        ("Usuario_Login *", 26),
        ("Password *", 20),
        ("Estado", 16),
        ("Notas", 32)
    ]

    header_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='1E293B', end_color='1E293B', fill_type='solid')
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    ws.row_dimensions[3].height = 28
    for col_idx, (h_title, col_width) in enumerate(headers, start=1):
        cell = ws.cell(row=3, column=col_idx, value=h_title)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = thin_border
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = col_width

    def_emp = db_empresas[0] if db_empresas else "Marketing Alterno"
    examples = [
        (def_emp, def_emp, "Zimbra Mail", "Juan Carlos Pérez Flores", "Diseñador Gráfico Senior", "juan.perez@alterno.pe", "+51 987654321", "jperez@alterno.pe", "Temp#Pass2026!", "activo", "Buzón de correo corporativo"),
        (def_emp, def_emp, "Odoo ERP", "María Elena Gómez Silva", "Analista Contable", "mgomez@alterno.pe", "+51 912345678", "mgomez", "Odoo#Mkt2026!", "activo", "Acceso a módulos de compras y facturación"),
        (def_emp, "", "Office 365", "Carlos Alberto Mendoza", "Asistente de Operaciones", "cmendoza@alterno.pe", "", "cmendoza@alterno.pe", "Init#2026M365", "por_crear", "Cuenta en proceso de alta técnica"),
    ]

    example_fill = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
    for row_idx, row_data in enumerate(examples, start=4):
        ws.row_dimensions[row_idx].height = 22
        for col_idx, val in enumerate(row_data, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = Font(name='Calibri', size=10, color='1E293B')
            cell.fill = example_fill
            cell.border = thin_border
            cell.alignment = Alignment(
                horizontal='center' if col_idx in [1, 2, 7, 10] else 'left',
                vertical='center'
            )

    ws2 = wb.create_sheet(title="Catalogos_Y_Guia")
    ws2.views.sheetView[0].showGridLines = True
    ws2.column_dimensions['A'].width = 28
    ws2.column_dimensions['B'].width = 36
    ws2.column_dimensions['C'].width = 36

    ws2['A1'] = "CATÁLOGOS ACTUALES & GUÍA DE CARGA"
    ws2['A1'].font = Font(name='Calibri', size=12, bold=True, color='FFFFFF')
    ws2['A1'].fill = PatternFill(start_color='0F172A', end_color='0F172A', fill_type='solid')
    ws2.row_dimensions[1].height = 28

    ws2['A3'] = "EMPRESAS EN BASE DE DATOS"
    ws2['A3'].font = Font(name='Calibri', size=11, bold=True, color='1E293B')
    for idx, emp_name in enumerate(db_empresas, start=4):
        ws2[f'A{idx}'] = emp_name

    plat_start = len(db_empresas) + 5
    ws2[f'A{plat_start}'] = "PLATAFORMAS REGISTRADAS"
    ws2[f'B{plat_start}'] = "TIPO DE SERVICIO"
    ws2[f'A{plat_start}'].font = Font(name='Calibri', size=11, bold=True, color='1E293B')
    ws2[f'B{plat_start}'].font = Font(name='Calibri', size=11, bold=True, color='1E293B')

    for idx, p_row in enumerate(db_plataformas, start=plat_start + 1):
        ws2[f'A{idx}'] = p_row[0]
        ws2[f'B{idx}'] = p_row[1]

    est_start = plat_start + len(db_plataformas) + 3
    ws2[f'A{est_start}'] = "ESTADOS VÁLIDOS"
    ws2[f'B{est_start}'] = "DESCRIPCIÓN"
    ws2[f'A{est_start}'].font = Font(name='Calibri', size=11, bold=True, color='1E293B')
    ws2[f'B{est_start}'].font = Font(name='Calibri', size=11, bold=True, color='1E293B')

    valid_estados = [
        ("activo", "Cuenta operativa y en uso activo por el colaborador."),
        ("por_crear", "Cuenta planificada o pendiente de aprovisionamiento en la plataforma."),
        ("suspendido", "Cuenta bloqueada o pausada por vacaciones o licencia temporal."),
        ("baja", "Cuenta deshabilitada por cese o desvinculación definitiva.")
    ]
    for idx, (st_name, st_desc) in enumerate(valid_estados, start=est_start + 1):
        ws2[f'A{idx}'] = st_name
        ws2[f'B{idx}'] = st_desc

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(
        buf,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='Plantilla_Cuentas_Plataforma.xlsx'
    )


@vault_bp.route('/api/it-vault/platform-users/export', methods=['GET'])
def api_it_platform_users_export():
    empresa_id = request.args.get('empresa_id', type=int)
    marca_id = request.args.get('marca_id', type=int)
    plataforma = request.args.get('plataforma', '').strip()
    search = request.args.get('search', '').strip().lower()
    estado = request.args.get('estado', '').strip()
    include_passwords = request.args.get('include_passwords', '0') == '1'
    if include_passwords and not vault_unlocked():
        return jsonify({
            "error": "Desbloquea la bóveda con tu PIN o contraseña para exportar contraseñas.",
            "code": "vault_locked",
        }), 403

    conn = get_db()
    cursor = conn.cursor()

    query = '''
        SELECT pu.*, 
               e.nombre as empresa_nombre,
               m.nombre as marca_nombre,
               u.full_name as created_by_name
        FROM it_platform_users pu
        JOIN it_empresas e ON pu.empresa_id = e.id
        LEFT JOIN it_marcas m ON pu.marca_id = m.id
        LEFT JOIN users u ON pu.created_by = u.id
        WHERE 1=1
    '''
    params = []

    if empresa_id:
        query += " AND pu.empresa_id = ?"
        params.append(empresa_id)

    if marca_id:
        query += " AND pu.marca_id = ?"
        params.append(marca_id)

    if plataforma and plataforma != 'todas':
        query += " AND pu.plataforma = ?"
        params.append(plataforma)

    if estado and estado != 'todos':
        query += " AND pu.estado = ?"
        params.append(estado)

    if search:
        query += " AND (LOWER(pu.colaborador_nombre) LIKE ? OR LOWER(pu.usuario_login) LIKE ? OR LOWER(COALESCE(pu.colaborador_email, '')) LIKE ? OR LOWER(COALESCE(pu.colaborador_cargo, '')) LIKE ?)"
        s_param = f"%{search}%"
        params.extend([s_param, s_param, s_param, s_param])

    query += " ORDER BY e.nombre ASC, pu.plataforma ASC, pu.colaborador_nombre ASC"
    cursor.execute(query, params)
    raw_users = cursor.fetchall()
    conn.close()

    if not _HAS_OPENPYXL:
        output = io.StringIO()
        output.write('\ufeff')
        writer = csv.writer(output, delimiter=';')
        writer.writerow(["ID", "Empresa", "Marca", "Plataforma", "Colaborador", "Cargo", "Email", "Teléfono", "Usuario Login", "Contraseña", "Estado", "Notas"])
        for r in raw_users:
            pw_val = "••••••••"
            if include_passwords and r['password_actual']:
                try:
                    pw_val = decrypt_vault_secret(r['password_actual'])
                except Exception:
                    pw_val = "••••••••"
            writer.writerow([r['id'], r['empresa_nombre'] or '', r['marca_nombre'] or '', r['plataforma'] or '', r['colaborador_nombre'] or '', r['colaborador_cargo'] or '', r['colaborador_email'] or '', r['colaborador_telefono'] or '', r['usuario_login'] or '', pw_val, r['estado'] or 'activo', r['notas'] or ''])
        buf = io.BytesIO(output.getvalue().encode('utf-8-sig'))
        return send_file(buf, mimetype='text/csv', as_attachment=True, download_name='Cuentas_Plataformas_Export.csv')

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Cuentas_Export"
    ws.views.sheetView[0].showGridLines = True

    ws.merge_cells('A1:L1')
    ws['A1'] = "DIRECTORIO DE CUENTAS POR PLATAFORMA - SISTEMAS / TI"
    ws['A1'].font = Font(name='Calibri', size=13, bold=True, color='FFFFFF')
    ws['A1'].fill = PatternFill(start_color='0F172A', end_color='0F172A', fill_type='solid')
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 32

    now_str = get_peru_now_str()
    ws.merge_cells('A2:L2')
    ws['A2'] = f"Reporte generado el {now_str} | Total de registros exportados: {len(raw_users)}"
    ws['A2'].font = Font(name='Calibri', size=10, italic=True, color='475569')
    ws['A2'].fill = PatternFill(start_color='F1F5F9', end_color='F1F5F9', fill_type='solid')
    ws['A2'].alignment = Alignment(horizontal='left', vertical='center', indent=1)
    ws.row_dimensions[2].height = 24

    cols = [
        ("ID", 8),
        ("Empresa", 20),
        ("Marca", 16),
        ("Plataforma", 22),
        ("Colaborador", 28),
        ("Cargo", 22),
        ("Email", 26),
        ("Teléfono", 16),
        ("Usuario Login", 24),
        ("Contraseña", 18),
        ("Estado", 14),
        ("Notas", 30)
    ]

    header_font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
    header_fill = PatternFill(start_color='1E293B', end_color='1E293B', fill_type='solid')
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    ws.row_dimensions[3].height = 26
    for col_idx, (col_name, col_width) in enumerate(cols, start=1):
        cell = ws.cell(row=3, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.border = thin_border
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = col_width

    for row_idx, r in enumerate(raw_users, start=4):
        ws.row_dimensions[row_idx].height = 20
        pw_val = "••••••••"
        if include_passwords and r['password_actual']:
            try:
                pw_val = decrypt_vault_secret(r['password_actual'])
            except Exception:
                pw_val = "••••••••"

        row_vals = [
            r['id'],
            r['empresa_nombre'] or '',
            r['marca_nombre'] or '',
            r['plataforma'] or '',
            r['colaborador_nombre'] or '',
            r['colaborador_cargo'] or '',
            r['colaborador_email'] or '',
            r['colaborador_telefono'] or '',
            r['usuario_login'] or '',
            pw_val,
            r['estado'] or 'activo',
            r['notas'] or ''
        ]
        for col_idx, val in enumerate(row_vals, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = Font(name='Calibri', size=10, color='1E293B')
            cell.border = thin_border
            cell.alignment = Alignment(
                horizontal='center' if col_idx in [1, 8, 10, 11] else 'left',
                vertical='center'
            )

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return send_file(
        buf,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='Cuentas_Plataformas_Export.xlsx'
    )


@vault_bp.route('/api/it-vault/platform-users/import/preview', methods=['POST', 'OPTIONS'])
def api_it_platform_users_import_preview():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    if 'file' not in request.files:
        return jsonify({"error": "No se envió ningún archivo para previsualización"}), 400

    uploaded_file = request.files['file']
    if not uploaded_file.filename:
        return jsonify({"error": "Archivo no seleccionado"}), 400

    try:
        parsed_rows = parse_accounts_from_filestorage(uploaded_file)
    except Exception as e:
        return jsonify({"error": f"Error al procesar el archivo: {str(e)}"}), 400

    if not parsed_rows:
        return jsonify({"error": "No se encontraron filas con datos en el archivo subido"}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, LOWER(nombre) FROM it_empresas")
    existing_empresas = {r[1]: r[0] for r in cursor.fetchall()}

    cursor.execute("SELECT empresa_id, LOWER(plataforma), LOWER(usuario_login), id, colaborador_nombre FROM it_platform_users")
    existing_accounts = {}
    for r in cursor.fetchall():
        key = (r[0], r[1].strip(), r[2].strip())
        existing_accounts[key] = {"id": r[3], "colaborador_nombre": r[4]}

    conn.close()

    preview_rows = []
    ready_count = 0
    update_count = 0
    invalid_count = 0

    for idx, r in enumerate(parsed_rows, start=1):
        errs = []
        if not r.get('empresa'):
            errs.append("Empresa es obligatoria")
        if not r.get('plataforma'):
            errs.append("Plataforma es obligatoria")
        if not r.get('colaborador_nombre'):
            errs.append("Colaborador es obligatorio")
        if not r.get('usuario_login'):
            errs.append("Usuario Login es obligatorio")

        emp_lower = (r.get('empresa') or '').strip().lower()
        emp_id = existing_empresas.get(emp_lower)

        status = 'ready'
        status_message = 'Listo para registrar'

        if errs:
            status = 'invalid'
            status_message = "; ".join(errs)
            invalid_count += 1
        elif emp_id:
            plat_lower = (r.get('plataforma') or '').strip().lower()
            usr_lower = (r.get('usuario_login') or '').strip().lower()
            acc_key = (emp_id, plat_lower, usr_lower)
            if acc_key in existing_accounts:
                status = 'update'
                prev_name = existing_accounts[acc_key]['colaborador_nombre']
                status_message = f'Cuenta existente ({prev_name}). Se actualizarán sus datos.'
                update_count += 1
            else:
                ready_count += 1
        else:
            ready_count += 1
            status_message = f"Empresa '{r.get('empresa')}' será creada automáticamente."

        preview_rows.append({
            'index': idx,
            'empresa': r.get('empresa', ''),
            'marca': r.get('marca', ''),
            'plataforma': r.get('plataforma', ''),
            'colaborador_nombre': r.get('colaborador_nombre', ''),
            'colaborador_cargo': r.get('colaborador_cargo', ''),
            'colaborador_email': r.get('colaborador_email', ''),
            'colaborador_telefono': r.get('colaborador_telefono', ''),
            'usuario_login': r.get('usuario_login', ''),
            'password_actual': r.get('password_actual', ''),
            'estado': r.get('estado', 'activo'),
            'notas': r.get('notas', ''),
            'status': status,
            'status_message': status_message,
        })

    return jsonify({
        "success": True,
        "filename": uploaded_file.filename,
        "total_filas": len(preview_rows),
        "ready_count": ready_count,
        "update_count": update_count,
        "invalid_count": invalid_count,
        "rows": preview_rows
    }), 200


@vault_bp.route('/api/it-vault/platform-users/import', methods=['POST', 'OPTIONS'])
def api_it_platform_users_import():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    modo = request.form.get('modo', 'crear_o_actualizar')
    created_by = request.form.get('created_by', type=int) or 1

    payload_rows = []
    if request.is_json:
        data = request.get_json(silent=True) or {}
        payload_rows = data.get('rows', [])
        modo = data.get('modo', modo)
        created_by = data.get('created_by', created_by)
    elif 'file' in request.files:
        uploaded_file = request.files['file']
        if not uploaded_file.filename:
            return jsonify({"error": "Archivo no seleccionado"}), 400
        try:
            payload_rows = parse_accounts_from_filestorage(uploaded_file)
        except Exception as e:
            return jsonify({"error": f"Error al leer el archivo: {str(e)}"}), 400

    if not payload_rows:
        return jsonify({"error": "No se proporcionaron filas para importar"}), 400

    conn = get_db()
    cursor = conn.cursor()
    now_peru = get_peru_now_str()

    created_count = 0
    updated_count = 0
    skipped_count = 0
    errors = []

    cursor.execute("SELECT id, LOWER(nombre) FROM it_empresas")
    empresas_map = {r[1]: r[0] for r in cursor.fetchall()}

    cursor.execute("SELECT id, empresa_id, LOWER(nombre) FROM it_marcas")
    marcas_map = {(r[1], r[2]): r[0] for r in cursor.fetchall()}

    cursor.execute("SELECT id, LOWER(nombre) FROM it_plataformas")
    plataformas_map = {r[1]: r[0] for r in cursor.fetchall()}

    for idx, r in enumerate(payload_rows, start=1):
        try:
            emp_name = (r.get('empresa') or '').strip()
            plat_name = (r.get('plataforma') or '').strip()
            colab_name = (r.get('colaborador_nombre') or '').strip()
            usr_login = (r.get('usuario_login') or '').strip()

            if not emp_name or not plat_name or not colab_name or not usr_login:
                errors.append(f"Fila #{idx}: Faltan campos obligatorios (Empresa, Plataforma, Colaborador o Usuario).")
                continue

            emp_lower = emp_name.lower()
            if emp_lower in empresas_map:
                empresa_id = empresas_map[emp_lower]
            else:
                cursor.execute("INSERT INTO it_empresas (nombre, color, created_at) VALUES (?, '#0284C7', ?)", (emp_name, now_peru))
                empresa_id = cursor.lastrowid
                empresas_map[emp_lower] = empresa_id

            marca_name = (r.get('marca') or '').strip()
            marca_id = None
            if marca_name:
                m_key = (empresa_id, marca_name.lower())
                if m_key in marcas_map:
                    marca_id = marcas_map[m_key]
                else:
                    cursor.execute("INSERT INTO it_marcas (empresa_id, nombre, created_at) VALUES (?, ?, ?)", (empresa_id, marca_name, now_peru))
                    marca_id = cursor.lastrowid
                    marcas_map[m_key] = marca_id

            plat_lower = plat_name.lower()
            if plat_lower not in plataformas_map:
                cursor.execute("INSERT INTO it_plataformas (nombre, tipo_servicio, color, created_at) VALUES (?, 'General', '#0284C7', ?)", (plat_name, now_peru))
                plataformas_map[plat_lower] = cursor.lastrowid

            raw_password = (r.get('password_actual') or '').strip()
            if not raw_password:
                chars = string.ascii_letters + string.digits + "!@#$"
                raw_password = "Temp#" + "".join(secrets.choice(chars) for _ in range(8))

            encrypted_pass = encrypt_vault_secret(raw_password)

            cargo = (r.get('colaborador_cargo') or '').strip()
            email = (r.get('colaborador_email') or '').strip()
            telefono = (r.get('colaborador_telefono') or '').strip()
            estado = r.get('estado') or 'activo'
            if estado not in ['activo', 'por_crear', 'suspendido', 'baja']:
                estado = 'activo'
            notas = (r.get('notas') or '').strip()

            cursor.execute('''
                SELECT id, password_actual FROM it_platform_users 
                WHERE empresa_id = ? AND LOWER(plataforma) = LOWER(?) AND LOWER(usuario_login) = LOWER(?)
            ''', (empresa_id, plat_name, usr_login))
            existing = cursor.fetchone()

            if existing:
                existing_id = existing[0]
                if modo == 'crear_o_actualizar':
                    cursor.execute('''
                        UPDATE it_platform_users SET
                            marca_id = COALESCE(?, marca_id),
                            colaborador_nombre = ?,
                            colaborador_cargo = ?,
                            colaborador_email = ?,
                            colaborador_telefono = ?,
                            password_anterior = CASE WHEN ? != '' THEN password_actual ELSE password_anterior END,
                            password_actual = CASE WHEN ? != '' THEN ? ELSE password_actual END,
                            estado = ?,
                            notas = ?,
                            updated_by = ?,
                            updated_at = ?
                        WHERE id = ?
                    ''', (marca_id, colab_name, cargo, email, telefono,
                          raw_password, raw_password, encrypted_pass,
                          estado, notas, created_by, now_peru, existing_id))
                    updated_count += 1
                else:
                    skipped_count += 1
            else:
                cursor.execute('''
                    INSERT INTO it_platform_users (
                        empresa_id, marca_id, plataforma, colaborador_nombre, colaborador_cargo,
                        colaborador_email, colaborador_telefono, usuario_login, password_actual,
                        estado, ultimo_reseteo, notas, created_by, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (empresa_id, marca_id, plat_name, colab_name, cargo,
                      email, telefono, usr_login, encrypted_pass,
                      estado, now_peru, notas, created_by, now_peru, now_peru))
                created_count += 1

        except Exception as ex:
            errors.append(f"Fila #{idx}: {str(ex)}")

    conn.commit()
    conn.close()

    total_procesados = created_count + updated_count + skipped_count

    return jsonify({
        "success": True,
        "total_procesados": total_procesados,
        "creados": created_count,
        "actualizados": updated_count,
        "omitidos": skipped_count,
        "errores": errors,
        "mensaje": f"Proceso finalizado: {created_count} creados, {updated_count} actualizados, {skipped_count} omitidos."
    }), 200


# =========================================================================
# RUTAS REST: GESTIÓN DE CATÁLOGOS MAESTROS (PLATAFORMAS, CARGOS, EMPRESAS)
# =========================================================================

@vault_bp.route('/api/it-vault/plataformas', methods=['GET', 'POST', 'OPTIONS'])
def api_it_plataformas():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        cursor.execute("SELECT * FROM it_plataformas ORDER BY nombre ASC")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify(rows), 200

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        nombre = (data.get('nombre') or '').strip()
        tipo_servicio = (data.get('tipo_servicio') or 'General').strip()
        color = data.get('color', '#0284C7')
        if not nombre:
            conn.close()
            return jsonify({"error": "El nombre de la plataforma es obligatorio"}), 400

        try:
            cursor.execute("INSERT INTO it_plataformas (nombre, tipo_servicio, color) VALUES (?, ?, ?)", (nombre, tipo_servicio, color))
            new_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return jsonify({"id": new_id, "nombre": nombre, "tipo_servicio": tipo_servicio, "color": color}), 201
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({"error": "Esta plataforma ya existe en el catálogo"}), 400


@vault_bp.route('/api/it-vault/plataformas/<int:plat_id>', methods=['DELETE', 'OPTIONS'])
def api_it_plataforma_detail(plat_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM it_plataformas WHERE id = ?", (plat_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True}), 200


@vault_bp.route('/api/it-vault/cargos', methods=['GET', 'POST', 'OPTIONS'])
def api_it_cargos():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        cursor.execute("SELECT * FROM it_cargos ORDER BY nombre ASC")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify(rows), 200

    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        nombre = (data.get('nombre') or '').strip()
        area = (data.get('area') or 'General').strip()
        if not nombre:
            conn.close()
            return jsonify({"error": "El nombre del cargo/área es obligatorio"}), 400

        try:
            cursor.execute("INSERT INTO it_cargos (nombre, area) VALUES (?, ?)", (nombre, area))
            new_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return jsonify({"id": new_id, "nombre": nombre, "area": area}), 201
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({"error": "Este cargo ya existe en el catálogo"}), 400


@vault_bp.route('/api/it-vault/cargos/<int:cargo_id>', methods=['DELETE', 'OPTIONS'])
def api_it_cargo_detail(cargo_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM it_cargos WHERE id = ?", (cargo_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True}), 200


@vault_bp.route('/api/it-vault/empresas/<int:empresa_id>', methods=['DELETE', 'OPTIONS'])
def api_it_empresa_delete(empresa_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM it_credentials WHERE empresa_id = ? AND is_active = 1", (empresa_id,))
    if cursor.fetchone()[0] > 0:
        conn.close()
        return jsonify({"error": "No se puede eliminar esta empresa porque contiene credenciales maestras registradas"}), 400

    cursor.execute("SELECT COUNT(*) FROM it_platform_users WHERE empresa_id = ?", (empresa_id,))
    if cursor.fetchone()[0] > 0:
        conn.close()
        return jsonify({"error": "No se puede eliminar esta empresa porque contiene usuarios/colaboradores registrados"}), 400

    cursor.execute("DELETE FROM it_marcas WHERE empresa_id = ?", (empresa_id,))
    cursor.execute("DELETE FROM it_empresas WHERE id = ?", (empresa_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True}), 200


@vault_bp.route('/api/it-vault/marcas/<int:marca_id>', methods=['DELETE', 'OPTIONS'])
def api_it_marca_delete(marca_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM it_marcas WHERE id = ?", (marca_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True}), 200


# =========================================================================
# RUTAS REST: MODO BÓVEDA SEGURA (DESBLOQUEO POR PIN / RE-AUTENTICACIÓN)
# =========================================================================

@vault_bp.route('/api/it-vault/pin-status', methods=['GET', 'OPTIONS'])
def api_it_vault_pin_status():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({"error": "user_id es requerido"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT security_pin_hash FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()

    has_pin = bool(row and row['security_pin_hash'])
    return jsonify({"has_pin": has_pin}), 200


@vault_bp.route('/api/it-vault/set-pin', methods=['POST', 'OPTIONS'])
def api_it_vault_set_pin():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    current_password = (data.get('current_password') or '').strip()
    new_pin = (data.get('new_pin') or '').strip()

    if not user_id or not current_password or not new_pin:
        return jsonify({"error": "Contraseña actual y nuevo PIN son obligatorios"}), 400

    if len(new_pin) < 4 or len(new_pin) > 8:
        return jsonify({"error": "El PIN debe tener entre 4 y 8 dígitos o caracteres"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM users WHERE id = ? AND is_active = 1", (user_id,))
    user = cursor.fetchone()
    if not user or not check_password_hash(user['password_hash'], current_password):
        conn.close()
        return jsonify({"error": "La contraseña de inicio de sesión actual es incorrecta"}), 400

    pin_hash = generate_password_hash(new_pin)
    cursor.execute("UPDATE users SET security_pin_hash = ? WHERE id = ?", (pin_hash, user_id))

    cursor.execute('''
        INSERT INTO it_credential_audit (credential_id, user_id, action, ip_or_agent)
        VALUES (NULL, ?, 'config_security_pin', ?)
    ''', (user_id, request.remote_addr))

    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "PIN de seguridad configurado exitosamente"}), 200


@vault_bp.route('/api/it-vault/verify-unlock', methods=['POST', 'OPTIONS'])
def api_it_vault_verify_unlock():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    password = (data.get('password') or '').strip()
    pin = (data.get('pin') or '').strip()

    if not user_id or (not password and not pin):
        return jsonify({"error": "Debes ingresar tu contraseña o tu PIN de seguridad"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password_hash, security_pin_hash, role FROM users WHERE id = ? AND is_active = 1", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "Usuario no encontrado o inactivo"}), 404

    recent_failures = cursor.execute('''
        SELECT COUNT(*) FROM it_credential_audit
        WHERE user_id = ? AND action = 'failed_vault_unlock' AND created_at >= datetime('now', '-15 minutes')
    ''', (user_id,)).fetchone()[0]
    if recent_failures >= VAULT_MAX_FAILED_UNLOCKS:
        conn.close()
        return jsonify({
            "error": "Demasiados intentos fallidos. Espera 15 minutos o desbloquea con tu contraseña más tarde.",
            "success": False,
        }), 429

    is_valid = False
    validation_method = None

    if pin:
        if not user['security_pin_hash']:
            conn.close()
            return jsonify({"error": "Aún no has configurado un PIN. Ingresa con tu contraseña de sesión o configúralo."}), 400
        if check_password_hash(user['security_pin_hash'], pin):
            is_valid = True
            validation_method = 'pin'
    elif password:
        if check_password_hash(user['password_hash'], password):
            is_valid = True
            validation_method = 'password'

    if not is_valid:
        cursor.execute('''
            INSERT INTO it_credential_audit (credential_id, user_id, action, ip_or_agent)
            VALUES (NULL, ?, 'failed_vault_unlock', ?)
        ''', (user_id, request.remote_addr))
        conn.commit()
        conn.close()
        remaining = max(0, VAULT_MAX_FAILED_UNLOCKS - recent_failures - 1)
        return jsonify({
            "error": f"Credencial de desbloqueo incorrecta. Intentos restantes: {remaining}.",
            "success": False,
        }), 400

    cursor.execute('''
        INSERT INTO it_credential_audit (credential_id, user_id, action, ip_or_agent)
        VALUES (NULL, ?, ?, ?)
    ''', (user_id, f'unlock_vault_{validation_method}', request.remote_addr))
    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "vault_token": issue_vault_token(user['id']),
        "expires_in": VAULT_UNLOCK_SECONDS,
        "message": "Bóveda desbloqueada con éxito"
    }), 200
