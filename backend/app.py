import os
import json
import base64
import sqlite3
import threading
import time
import re
import logging
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, g
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

from database import (
    get_db, init_db, DB_PATH, get_peru_now, get_peru_now_str, get_peru_today_str,
    get_schema_version,
)
from security import (
    register_security, issue_token, login_is_throttled,
    register_login_failure, clear_login_failures,
    user_can_access_owner, user_can_review_owner,
)
from helpers import (
    validate_new_password,
    generate_temp_password,
    is_dia_laborable,
    calculate_hora_fin,
    sanitize_evidencias,
    strip_html_text,
    format_actividad_dict,
    slim_actividad_for_summary,
    fetch_enriched_bitacora_activities,
    check_and_notify_stagnant_activities,
    get_default_hora_inicio,
    _mask_vault_secrets,
)
from routes.system_routes import system_bp, normalize_client_name
from routes.mcp_routes import mcp_bp
from routes.admin_routes import admin_bp
from routes.supervision_routes import supervision_bp
from routes.buzon_routes import buzon_bp
from routes.vault_routes import vault_bp
from activity_lifecycle import (
    normalize_desc_key,
    enrich_activities_with_net_info,
    recalculate_bitacora_durations,
    propagate_completion_across_lineage,
    mark_lineage_rollover_dismissed,
    relink_children_before_delete,
)

logging.basicConfig(
    level=os.environ.get('LOG_LEVEL', 'INFO').upper(),
    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
)
logger = logging.getLogger('bitacora')

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
register_security(app)
app.register_blueprint(system_bp)
app.register_blueprint(mcp_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(supervision_bp)
app.register_blueprint(buzon_bp)
app.register_blueprint(vault_bp)


@app.teardown_appcontext
def close_open_connections(exception=None):
    conns = getattr(g, '_open_conns', [])
    for conn in conns:
        try:
            conn.close()
        except Exception:
            pass
    if hasattr(g, '_open_conns'):
        g._open_conns = []
    if hasattr(g, '_db_conn'):
        g._db_conn = None


UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,X-MCP-API-Key,X-Vault-Token,Mcp-Session-Id'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS,PATCH'
    response.headers['Access-Control-Expose-Headers'] = 'Mcp-Session-Id,WWW-Authenticate,X-Total-Count,X-Has-More'
    return response


@app.route('/api/health', methods=['GET'])
def health_check():
    """Usado por el monitor de disponibilidad: verifica también que la base de datos responda."""
    now_dt = get_peru_now()
    db_ok = True
    try:
        conn = get_db()
        conn.execute("SELECT 1").fetchone()
    except Exception as e:
        logger.error("[Health] Base de datos no disponible: %s", e)
        db_ok = False
    payload = {
        "status": "ok" if db_ok else "degraded",
        "database": "ok" if db_ok else "error",
        "schema_version": get_schema_version() if db_ok else None,
        "service": "Bitácora API",
        "version": "2.4.0",
        "peru_time": now_dt.strftime('%Y-%m-%d %H:%M:%S'),
        "peru_date": get_peru_today_str(),
        "timezone": "America/Lima (UTC-5)",
    }
    return jsonify(payload), (200 if db_ok else 503)


# ==================== CONFIGURACIONES GLOBALES (SETTINGS) ====================

@app.route('/api/settings', methods=['GET', 'POST', 'OPTIONS'])
def handle_settings():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'POST':
        data = request.get_json() or {}
        allowed_keys = [
            'hora_inicio_default', 'system_title', 'logo_url', 'favicon_url',
            'login_bg_url', 'login_bg_type', 'login_heading', 'login_subheading',
            'system_mode', 'show_demo_logins'
        ]
        for key in allowed_keys:
            if key in data:
                cursor.execute('''
                    INSERT INTO system_settings (key, value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
                ''', (key, str(data[key]) if data[key] is not None else ''))
        conn.commit()

    rows = cursor.execute("SELECT key, value FROM system_settings").fetchall()
    settings = {r['key']: r['value'] for r in rows}

    defaults = {
        'hora_inicio_default': '08:30',
        'system_title': 'Bitácora Diaria de Actividades | Marketing Alterno Perú',
        'logo_url': '',
        'favicon_url': '',
        'login_bg_url': '',
        'login_bg_type': 'gradient',
        'login_heading': 'Bitácora Oficial',
        'login_subheading': 'Marketing Alterno Perú',
        'system_mode': 'production',
        'show_demo_logins': 'false'
    }
    for k, v in defaults.items():
        if k not in settings:
            settings[k] = v

    conn.close()
    return jsonify(settings), 200


@app.route('/api/admin/clean-production-data', methods=['POST', 'OPTIONS'])
def clean_production_data():
    """Purga todas las bitácoras, actividades y usuarios de prueba dejando el sistema limpio en producción con sólo el admin"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    if os.environ.get('ENABLE_MAINTENANCE_ENDPOINTS') != '1':
        return jsonify({"error": "Acción deshabilitada en producción por seguridad (borra o inyecta datos masivamente). "
                                 "Actívala temporalmente con ENABLE_MAINTENANCE_ENDPOINTS=1 y un respaldo previo."}), 410

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE actividades SET parent_task_id = NULL")
        cursor.execute("UPDATE users SET team_id = NULL")
        cursor.execute("UPDATE teams SET lider_id = NULL")

        cursor.execute("DELETE FROM actividades")
        cursor.execute("DELETE FROM bitacoras")
        cursor.execute("DELETE FROM buzon_votos")
        cursor.execute("DELETE FROM buzon_sugerencias")

        for tbl in ['tasks', 'audit_logs', 'notifications', 'evidencias']:
            try:
                cursor.execute(f"DELETE FROM {tbl}")
            except Exception:
                pass

        cursor.execute("DELETE FROM teams")
        cursor.execute("DELETE FROM users WHERE username != 'admin'")

        cursor.execute('''
            INSERT INTO system_settings (key, value, updated_at) VALUES ('system_mode', 'production', CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = 'production', updated_at = CURRENT_TIMESTAMP
        ''')
        cursor.execute('''
            INSERT INTO system_settings (key, value, updated_at) VALUES ('show_demo_logins', 'false', CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = 'false', updated_at = CURRENT_TIMESTAMP
        ''')
        conn.commit()
        conn.close()
        return jsonify({
            "success": True,
            "message": "Datos de prueba purgados exitosamente. El sistema está limpio en Modo Producción con el usuario Administrador."
        }), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": f"Error al limpiar datos: {str(e)}"}), 500


@app.route('/api/admin/seed-demo-data', methods=['POST', 'OPTIONS'])
def seed_demo_data():
    """Restaura los datos de prueba (usuarios, equipos y bitácoras de ejemplo) para modo demostración"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    if os.environ.get('ENABLE_MAINTENANCE_ENDPOINTS') != '1':
        return jsonify({"error": "Acción deshabilitada en producción por seguridad (borra o inyecta datos masivamente). "
                                 "Actívala temporalmente con ENABLE_MAINTENANCE_ENDPOINTS=1 y un respaldo previo."}), 410

    try:
        from seed_data import seed_team_and_activities
        seed_team_and_activities()

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO system_settings (key, value, updated_at) VALUES ('system_mode', 'demo', CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = 'demo', updated_at = CURRENT_TIMESTAMP
        ''')
        cursor.execute('''
            INSERT INTO system_settings (key, value, updated_at) VALUES ('show_demo_logins', 'true', CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = CURRENT_TIMESTAMP
        ''')
        conn.commit()
        conn.close()
        return jsonify({
            "success": True,
            "message": "Datos de demostración y usuarios de prueba cargados correctamente en Modo Demo."
        }), 200
    except Exception as e:
        return jsonify({"error": f"Error al cargar datos de demostración: {str(e)}"}), 500


# ==================== GESTIÓN DE ARCHIVOS Y EVIDENCIAS ====================

ALLOWED_UPLOAD_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'heic',
    'pdf', 'txt', 'csv', 'log',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
    'zip', 'rar', '7z',
    'mp4', 'mov', 'webm', 'mp3', 'wav', 'm4a',
}
INLINE_UPLOAD_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'pdf', 'mp4', 'webm', 'mp3', 'wav', 'm4a'}
BASE64_MIME_EXT = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/bmp': 'bmp',
}


def _upload_ext(name):
    return name.rsplit('.', 1)[-1].lower() if '.' in name else ''


@app.route('/api/upload', methods=['POST', 'OPTIONS'])
def upload_file():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        if 'file' in request.files:
            file = request.files['file']
            if not file or file.filename == '':
                return jsonify({"error": "No se seleccionó ningún archivo"}), 400

            orig_filename = file.filename or 'evidencia'
            safe_name = secure_filename(orig_filename)
            if not safe_name:
                safe_name = f"evidencia_{int(time.time())}.png"
            if _upload_ext(safe_name) not in ALLOWED_UPLOAD_EXTENSIONS:
                return jsonify({"error": f"Tipo de archivo no permitido (.{_upload_ext(safe_name) or 'sin extensión'}). Usa imágenes, PDF, documentos Office, ZIP o video."}), 400
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_name = f"{timestamp}_{safe_name}"
            filepath = os.path.join(UPLOAD_FOLDER, unique_name)
            file.save(filepath)

            file_size = os.path.getsize(filepath)
            mime_type = file.content_type or 'application/octet-stream'

            return jsonify({
                "url": f"/api/uploads/{unique_name}",
                "nombre": orig_filename,
                "tipo": mime_type,
                "tamano": file_size
            }), 201

        data = request.get_json() or {}
        base64_data = data.get('base64')
        if base64_data:
            nombre = data.get('nombre') or 'captura_pantalla.png'
            safe_nombre = secure_filename(nombre)
            if not safe_nombre:
                safe_nombre = f"captura_{int(time.time())}.png"

            if ',' in base64_data:
                header, base64_str = base64_data.split(',', 1)
                mime_type = header.split(';')[0].replace('data:', '') if 'data:' in header else 'image/png'
            else:
                base64_str = base64_data
                mime_type = 'image/png'

            if mime_type not in BASE64_MIME_EXT:
                return jsonify({"error": "Solo se permiten capturas de imagen (PNG, JPG, GIF, WEBP)"}), 400
            if _upload_ext(safe_nombre) not in BASE64_MIME_EXT.values():
                safe_nombre = f"{safe_nombre.rsplit('.', 1)[0]}.{BASE64_MIME_EXT[mime_type]}"

            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_name = f"{timestamp}_{safe_nombre}"
            filepath = os.path.join(UPLOAD_FOLDER, unique_name)

            try:
                binary_bytes = base64.b64decode(base64_str, validate=False)
            except Exception:
                return jsonify({"error": "La imagen pegada no tiene un formato válido"}), 400
            with open(filepath, 'wb') as f:
                f.write(binary_bytes)

            file_size = len(binary_bytes)

            return jsonify({
                "url": f"/api/uploads/{unique_name}",
                "nombre": safe_nombre,
                "tipo": mime_type,
                "tamano": file_size
            }), 201

        return jsonify({"error": "No se proporcionó archivo ni imagen base64"}), 400
    except Exception as e:
        return jsonify({"error": f"Error al procesar el archivo: {str(e)}"}), 500


@app.route('/api/uploads/<path:filename>', methods=['GET'])
def serve_uploaded_file(filename):
    as_attachment = _upload_ext(filename) not in INLINE_UPLOAD_EXTENSIONS
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=as_attachment)


# ==================== AUTHENTICATION ====================

@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json() or {}
    username = (data.get('username') or '').strip().lower()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify({"error": "Usuario y contraseña requeridos"}), 400

    if login_is_throttled(username):
        return jsonify({"error": "Demasiados intentos fallidos. Espera 15 minutos o contacta al administrador."}), 429

    conn = get_db()
    cursor = conn.cursor()
    user = cursor.execute('''
        SELECT u.id, u.username, u.email, u.phone, u.password_hash, u.full_name, u.role, u.is_active, u.team_id,
               COALESCE(u.must_change_password, 0) AS must_change_password,
               t.nombre as team_name, t.lider_id
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE LOWER(u.username) = ?
    ''', (username,)).fetchone()

    if not user:
        register_login_failure(username)
        return jsonify({"error": "Usuario o contraseña incorrectos"}), 401

    if not user['is_active']:
        return jsonify({"error": "Usuario desactivado. Contacta al administrador"}), 403

    stored_hash = user['password_hash']
    password_matches = False
    try:
        password_matches = check_password_hash(stored_hash, password)
    except Exception:
        password_matches = False

    if not password_matches and stored_hash and stored_hash == password:
        password_matches = True
        stored_hash = generate_password_hash(password)
        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (stored_hash, user['id']))
        conn.commit()

    if not password_matches:
        register_login_failure(username)
        return jsonify({"error": "Usuario o contraseña incorrectos"}), 401

    clear_login_failures(username)

    role_name = 'analista' if user['role'] in ('operador', 'analista') else user['role']
    is_leader = (user['lider_id'] == user['id']) or (role_name == 'lider') or (role_name == 'admin')
    user_dict = {
        "id": user['id'],
        "username": user['username'],
        "email": user['email'],
        "full_name": user['full_name'],
        "role": role_name,
        "phone": user['phone'] if 'phone' in user.keys() else None,
        "team_id": user['team_id'],
        "team_name": user['team_name'],
        "is_leader": is_leader,
        "must_change_password": bool(user['must_change_password'])
    }

    return jsonify({
        "message": "Autenticación exitosa",
        "user": user_dict,
        "token": issue_token(user['id'], stored_hash)
    }), 200


@app.route('/api/auth/change-password', methods=['POST', 'OPTIONS'])
def change_password():
    """Permite a cualquier usuario cambiar su contraseña validando la anterior, o al admin actualizarla."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json() or {}
    user_id = data.get('user_id')
    current_password = data.get('current_password') or ''
    new_password = (data.get('new_password') or '').strip()

    if not user_id:
        return jsonify({"error": "Identificador de usuario requerido"}), 400

    pw_error = validate_new_password(new_password)
    if pw_error:
        return jsonify({"error": pw_error}), 400

    conn = get_db()
    cursor = conn.cursor()
    user = cursor.execute("SELECT id, username, password_hash FROM users WHERE id = ?", (user_id,)).fetchone()

    if not user:
        conn.close()
        return jsonify({"error": "Usuario no encontrado"}), 404

    stored_hash = user['password_hash']
    acting_user = getattr(g, 'current_user', None) or {}
    is_self_change = int(user['id']) == int(acting_user.get('id', -1))
    if not is_self_change and acting_user.get('role') != 'admin':
        conn.close()
        return jsonify({"error": "Solo un administrador puede cambiar la contraseña de otro usuario"}), 403
    if is_self_change and not current_password:
        conn.close()
        return jsonify({"error": "Debes ingresar tu contraseña actual"}), 400
    if current_password:
        password_matches = False
        try:
            password_matches = check_password_hash(stored_hash, current_password)
        except Exception:
            password_matches = (stored_hash == current_password)
        if not password_matches and stored_hash == current_password:
            password_matches = True

        if not password_matches:
            conn.close()
            return jsonify({"error": "La contraseña actual es incorrecta"}), 400
        if current_password == new_password:
            conn.close()
            return jsonify({"error": "La nueva contraseña debe ser distinta de la actual"}), 400

    new_hash = generate_password_hash(new_password)
    cursor.execute("UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?",
                   (new_hash, 0 if is_self_change else 1, user_id))
    conn.commit()
    conn.close()

    resp = {
        "success": True,
        "message": "Contraseña actualizada exitosamente"
    }
    if is_self_change:
        resp["token"] = issue_token(user['id'], new_hash)
    return jsonify(resp), 200


@app.route('/api/auth/profile', methods=['PUT', 'OPTIONS'])
def update_profile():
    """Permite al propio usuario actualizar su nombre, correo, teléfono y opcionalmente su contraseña sin poder modificar roles ni equipos."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json() or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({"error": "Identificador de usuario requerido"}), 400

    full_name = (data.get('full_name') or '').strip()
    email = (data.get('email') or '').strip()
    phone = (data.get('phone') or '').strip()
    current_password = data.get('current_password') or ''
    new_password = (data.get('new_password') or '').strip()

    if not full_name:
        return jsonify({"error": "El nombre completo es obligatorio"}), 400

    conn = get_db()
    cursor = conn.cursor()
    u = cursor.execute("SELECT id, username, password_hash, role, team_id, is_active FROM users WHERE id = ?", (user_id,)).fetchone()
    if not u:
        conn.close()
        return jsonify({"error": "Usuario no encontrado"}), 404

    if new_password:
        pw_error = validate_new_password(new_password)
        if pw_error:
            conn.close()
            return jsonify({"error": pw_error}), 400
        if not current_password:
            conn.close()
            return jsonify({"error": "Debes ingresar tu contraseña actual para establecer una nueva"}), 400

        stored_hash = u['password_hash']
        password_matches = False
        try:
            password_matches = check_password_hash(stored_hash, current_password)
        except Exception:
            password_matches = (stored_hash == current_password)
        if not password_matches and stored_hash == current_password:
            password_matches = True

        if not password_matches:
            conn.close()
            return jsonify({"error": "La contraseña actual es incorrecta"}), 400

        new_hash = generate_password_hash(new_password)
        cursor.execute("""
            UPDATE users 
            SET full_name = ?, email = ?, phone = ?, password_hash = ?, must_change_password = 0
            WHERE id = ?
        """, (full_name, email, phone, new_hash, user_id))
    else:
        new_hash = None
        cursor.execute("""
            UPDATE users 
            SET full_name = ?, email = ?, phone = ?
            WHERE id = ?
        """, (full_name, email, phone, user_id))

    conn.commit()

    updated_u = cursor.execute("""
        SELECT u.id, u.username, u.email, u.full_name, u.role, u.phone, u.team_id, u.is_active,
               t.nombre as team_name,
               CASE WHEN t.lider_id = u.id THEN 1 ELSE 0 END as is_team_leader
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.id = ?
    """, (user_id,)).fetchone()

    conn.close()

    resp = {
        "success": True,
        "message": "Perfil actualizado correctamente",
        "user": dict(updated_u)
    }
    if new_hash:
        resp["token"] = issue_token(user_id, new_hash)
    return jsonify(resp), 200


# ==================== BITACORAS CRUD & ROLLOVER ====================

def rollover_user_open_tasks(cursor, u_id, u_name, today_str, now_peru):
    """
    Arrastra tareas abiertas de días previos de un usuario hacia la fecha actual.
    Idempotente:
      - No duplica si ya fue transferida (activa o enviada a papelera) en una fecha posterior.
      - No arrastra tareas marcadas con `rollover_dismissed = 1`.
      - Si una instancia igual/posterior del mismo usuario ya fue completada, cierra el eslabón
        abierto rezagado en lugar de volver a arrastrarlo.
    """
    open_tasks = cursor.execute('''
        SELECT a.*, b.fecha, b.area
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE (b.user_id = ? OR LOWER(TRIM(b.colaborador)) = LOWER(TRIM(?)))
          AND b.fecha < ?
          AND a.estado != 'completada'
          AND (a.is_deleted IS NULL OR a.is_deleted = 0)
          AND COALESCE(a.rollover_dismissed, 0) = 0
          AND NOT EXISTS (
            SELECT 1 FROM actividades a_child
            JOIN bitacoras b_child ON a_child.bitacora_id = b_child.id
            WHERE a_child.parent_task_id = a.id
              AND COALESCE(a_child.tipo_vinculo, 'continuacion') IN ('', 'continuacion')
              AND b_child.fecha > b.fecha
          )
        ORDER BY b.fecha DESC, a.id DESC
    ''', (u_id, u_name or '', today_str)).fetchall()

    if not open_tasks:
        return 0

    min_open_fecha = min(t['fecha'] for t in open_tasks)
    completed_rows = cursor.execute('''
        SELECT a.descripcion, MAX(b.fecha) AS max_fecha
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE (b.user_id = ? OR LOWER(TRIM(b.colaborador)) = LOWER(TRIM(?)))
          AND b.fecha >= ?
          AND a.estado = 'completada'
          AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        GROUP BY a.descripcion
    ''', (u_id, u_name or '', min_open_fecha)).fetchall()

    completed_max_fecha_by_desc = {}
    for cr in completed_rows:
        dk = normalize_desc_key(cr['descripcion'])
        if dk:
            prev_f = completed_max_fecha_by_desc.get(dk, '')
            if (cr['max_fecha'] or '') > prev_f:
                completed_max_fecha_by_desc[dk] = cr['max_fecha']

    filtered_tasks = []
    stale_to_close = []
    seen_desc_keys = set()
    for task in open_tasks:
        desc_key = normalize_desc_key(task['descripcion'])
        if not desc_key:
            continue
        comp_fecha = completed_max_fecha_by_desc.get(desc_key)
        if comp_fecha and comp_fecha >= task['fecha']:
            stale_to_close.append(task['id'])
            continue
        if desc_key in seen_desc_keys:
            cursor.execute("UPDATE actividades SET rollover_dismissed = 1 WHERE id = ?", (task['id'],))
            continue
        seen_desc_keys.add(desc_key)
        filtered_tasks.append(task)

    if stale_to_close:
        ph = ','.join(['?'] * len(stale_to_close))
        cursor.execute(
            f"UPDATE actividades SET estado = 'completada', updated_at = ?, last_stagnant_notified_at = NULL WHERE id IN ({ph})",
            [now_peru] + stale_to_close,
        )

    if not filtered_tasks:
        return len(stale_to_close)

    filtered_tasks.reverse()

    today_b = cursor.execute('''
        SELECT id FROM bitacoras
        WHERE (user_id = ? OR LOWER(TRIM(b_col)) = LOWER(TRIM(?))) AND fecha = ?
        ORDER BY id ASC LIMIT 1
    '''.replace('b_col', 'colaborador'), (u_id, u_name or '', today_str)).fetchone()

    today_b_id = None
    if today_b:
        today_b_id = today_b['id']
    else:
        last_b = cursor.execute('''
            SELECT area FROM bitacoras
            WHERE (user_id = ? OR LOWER(TRIM(colaborador)) = LOWER(TRIM(?)))
            ORDER BY fecha DESC, id DESC LIMIT 1
        ''', (u_id, u_name or '')).fetchone()
        area_val = last_b['area'] if last_b else 'Sistemas'

        try:
            cursor.execute('''
                INSERT INTO bitacoras (
                    user_id, fecha, hora_inicio, colaborador, area,
                    pendientes, necesita_apoyo, prioridad_siguiente,
                    tiempo_total_min, estado, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, '', 'No', '', 0, 'generada', ?, ?)
            ''', (u_id, today_str, get_default_hora_inicio(cursor), u_name, area_val, now_peru, now_peru))
            today_b_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            today_b_id = cursor.execute(
                "SELECT id FROM bitacoras WHERE user_id = ? AND fecha = ? ORDER BY id ASC LIMIT 1",
                (u_id, today_str)
            ).fetchone()['id']

    existing_parent_ids = set(
        r[0] for r in cursor.execute(
            "SELECT parent_task_id FROM actividades WHERE bitacora_id = ? AND parent_task_id IS NOT NULL",
            (today_b_id,)
        ).fetchall()
    )
    existing_descriptions = set(
        normalize_desc_key(r[0]) for r in cursor.execute(
            "SELECT descripcion FROM actividades WHERE bitacora_id = ?",
            (today_b_id,)
        ).fetchall() if r[0]
    )

    current_order = cursor.execute(
        "SELECT COALESCE(MAX(orden), 0) FROM actividades WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0)",
        (today_b_id,)
    ).fetchone()[0] + 1

    rolled_count = 0
    for task in filtered_tasks:
        desc_clean = normalize_desc_key(task['descripcion'])
        if not desc_clean:
            continue
        if task['id'] in existing_parent_ids or desc_clean in existing_descriptions:
            continue

        existing_descriptions.add(desc_clean)

        orig_created = task['created_at'] or get_peru_now().strftime('%Y-%m-%d %H:%M:%S')
        orig_updated = task['updated_at'] or orig_created
        ev_val = task['evidencias'] if ('evidencias' in task.keys() and task['evidencias']) else '[]'
        sw_val = task['shared_with'] if ('shared_with' in task.keys() and task['shared_with']) else '[]'
        sw_uuid = task['shared_uuid'] if ('shared_uuid' in task.keys() and task['shared_uuid']) else None
        rev_dec = task['revision_decision'] if ('revision_decision' in task.keys() and task['revision_decision']) else None
        rev_com = task['revision_comentario'] if ('revision_comentario' in task.keys() and task['revision_comentario']) else None
        rev_por = task['revisado_por'] if ('revisado_por' in task.keys() and task['revision_decision']) else None
        rev_at = task['revisado_at'] if ('revisado_at' in task.keys() and task['revisado_at']) else None
        cursor.execute('''
            INSERT INTO actividades (
                bitacora_id, orden, hora_inicio, hora_fin, duracion_min,
                tipo_trabajo, descripcion, para_cliente, estado,
                parent_task_id, tipo_vinculo, created_at, updated_at, evidencias,
                shared_with, shared_uuid, is_deleted, rollover_dismissed,
                revision_decision, revision_comentario, revisado_por, revisado_at
            ) VALUES (?, ?, '', '', 0, ?, ?, ?, ?, ?, 'continuacion', ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
        ''', (
            today_b_id,
            current_order,
            task['tipo_trabajo'],
            task['descripcion'],
            task['para_cliente'],
            task['estado'],
            task['id'],
            orig_created,
            orig_updated,
            ev_val,
            sw_val,
            sw_uuid,
            rev_dec,
            rev_com,
            rev_por,
            rev_at
        ))
        existing_parent_ids.add(task['id'])
        current_order += 1
        rolled_count += 1

    return rolled_count + len(stale_to_close)


@app.route('/api/bitacoras', methods=['GET'])
def get_bitacoras():
    conn = get_db()
    cursor = conn.cursor()

    fecha = request.args.get('fecha')
    colaborador = request.args.get('colaborador')
    team_id = request.args.get('team_id')
    user_id = request.args.get('user_id')
    requesting_user_id = request.args.get('requesting_user_id')
    is_summary = str(request.args.get('summary') or '').lower() in ('1', 'true', 'yes')

    default_limit = 500 if fecha else 200
    try:
        limit = int(request.args.get('limit') or default_limit)
    except (TypeError, ValueError):
        limit = default_limit
    limit = max(1, min(500, limit))

    try:
        offset = int(request.args.get('offset') or 0)
    except (TypeError, ValueError):
        offset = 0
    offset = max(0, offset)

    today_str = get_peru_today_str()
    if offset == 0 and (not fecha or fecha == today_str):
        target_uid = user_id or requesting_user_id
        if target_uid:
            target_user = cursor.execute("SELECT id, full_name FROM users WHERE id = ?", (target_uid,)).fetchone()
            if target_user:
                rolled = rollover_user_open_tasks(cursor, target_user['id'], target_user['full_name'], today_str, get_peru_now_str())
                if rolled > 0:
                    conn.commit()
        elif colaborador:
            target_user = cursor.execute("SELECT id, full_name FROM users WHERE LOWER(full_name) = LOWER(?) OR LOWER(username) = LOWER(?)", (colaborador, colaborador)).fetchone()
            if target_user:
                rolled = rollover_user_open_tasks(cursor, target_user['id'], target_user['full_name'], today_str, get_peru_now_str())
                if rolled > 0:
                    conn.commit()

    where_sql = "WHERE 1=1"
    params = []

    if requesting_user_id:
        req_u = cursor.execute("SELECT id, role, team_id, full_name, username FROM users WHERE id = ?", (requesting_user_id,)).fetchone()
        if req_u:
            r_role = req_u['role']
            if r_role in ('analista', 'operador'):
                where_sql += " AND (b.user_id = ? OR LOWER(b.colaborador) = LOWER(?) OR LOWER(b.colaborador) = LOWER(?) OR b.user_id IN (SELECT target_user_id FROM user_delegations WHERE delegate_user_id = ? AND is_active = 1))"
                params.extend([req_u['id'], req_u['full_name'], req_u['username'], req_u['id']])
            elif r_role == 'lider':
                leader_teams = [r['id'] for r in cursor.execute("SELECT id FROM teams WHERE lider_id = ? OR id = ?", (req_u['id'], req_u['team_id'])).fetchall()]
                if team_id and str(team_id).isdigit() and int(team_id) in leader_teams:
                    pass
                elif leader_teams:
                    placeholders = ','.join(['?'] * len(leader_teams))
                    where_sql += f" AND (u.team_id IN ({placeholders}) OR u.id = ? OR b.user_id = ? OR EXISTS (SELECT 1 FROM teams tl WHERE tl.id IN ({placeholders}) AND tl.lider_id = u.id))"
                    params.extend(leader_teams + [req_u['id'], req_u['id']] + leader_teams)
                else:
                    where_sql += " AND (b.user_id = ? OR LOWER(b.colaborador) = LOWER(?) OR LOWER(b.colaborador) = LOWER(?))"
                    params.extend([req_u['id'], req_u['full_name'], req_u['username']])

    if fecha:
        where_sql += " AND b.fecha = ?"
        params.append(fecha)
    if colaborador:
        where_sql += " AND (b.colaborador LIKE ? OR u.username LIKE ?)"
        params.extend([f"%{colaborador}%", f"%{colaborador}%"])
    if team_id:
        where_sql += " AND (u.team_id = ? OR EXISTS (SELECT 1 FROM teams tl WHERE tl.id = ? AND tl.lider_id = u.id))"
        params.extend([team_id, team_id])
    if user_id:
        where_sql += " AND (b.user_id = ? OR u.id = ?)"
        params.extend([user_id, user_id])

    from_sql = '''
        FROM bitacoras b
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN teams t ON u.team_id = t.id
    '''
    total_count = cursor.execute(f"SELECT COUNT(*) {from_sql} {where_sql}", params).fetchone()[0]

    query = f"SELECT b.*, u.team_id, t.nombre as team_name {from_sql} {where_sql} ORDER BY b.fecha DESC, b.id DESC LIMIT ? OFFSET ?"
    bitacoras = cursor.execute(query, [*params, limit, offset]).fetchall()
    users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}

    acts_by_bitacora = {}
    bitacora_ids = [b['id'] for b in bitacoras]
    CHUNK = 400
    for i in range(0, len(bitacora_ids), CHUNK):
        chunk = bitacora_ids[i:i + CHUNK]
        placeholders = ','.join('?' * len(chunk))
        rows = cursor.execute(f'''
            SELECT a.*,
              p.descripcion as parent_task_desc,
              p.estado as parent_task_estado,
              CASE WHEN a.parent_task_id IS NULL THEN a.duracion_min ELSE COALESCE((
                WITH RECURSIVE lineage(id, parent_task_id, duracion_min, depth) AS (
                  SELECT id, parent_task_id, duracion_min, 1 FROM actividades WHERE id = a.id
                  UNION ALL
                  SELECT prev.id, prev.parent_task_id, prev.duracion_min, l.depth + 1
                  FROM actividades prev
                  JOIN lineage l ON prev.id = l.parent_task_id
                  WHERE l.depth < 15 AND prev.id != l.id AND prev.parent_task_id != prev.id
                )
                SELECT SUM(duracion_min) FROM lineage
              ), a.duracion_min) END AS tiempo_acumulado_min
            FROM actividades a
            LEFT JOIN actividades p ON a.parent_task_id = p.id
            WHERE a.bitacora_id IN ({placeholders}) AND (a.is_deleted IS NULL OR a.is_deleted = 0)
            ORDER BY a.bitacora_id, a.orden ASC, a.id ASC
        ''', chunk).fetchall()
        for a in rows:
            acts_by_bitacora.setdefault(a['bitacora_id'], []).append(a)

    result = []
    for b in bitacoras:
        b_dict = dict(b)
        acts = acts_by_bitacora.get(b['id'], [])
        formatted_list = [format_actividad_dict(a, users_map, b_dict.get('fecha')) for a in acts]
        enriched = enrich_activities_with_net_info(formatted_list, fecha=b_dict.get('fecha'))
        if is_summary:
            b_dict['actividades'] = [slim_actividad_for_summary(item) for item in enriched]
            b_dict['resumen_texto'] = ''
            b_dict['is_summary'] = True
        else:
            b_dict['actividades'] = enriched
        result.append(b_dict)

    conn.close()
    resp = jsonify(result)
    resp.headers['X-Total-Count'] = str(total_count)
    resp.headers['X-Has-More'] = '1' if (offset + len(result)) < total_count else '0'
    return resp


@app.route('/api/bitacoras/<int:bitacora_id>', methods=['GET'])
def get_bitacora(bitacora_id):
    conn = get_db()
    cursor = conn.cursor()
    b = cursor.execute('''
        SELECT b.*, u.team_id, t.nombre as team_name
        FROM bitacoras b
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE b.id = ?
    ''', (bitacora_id,)).fetchone()
    if not b:
        conn.close()
        return jsonify({"error": "Bitácora no encontrada"}), 404

    b_dict = dict(b)
    users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
    b_dict['actividades'] = fetch_enriched_bitacora_activities(cursor, bitacora_id, fecha=b_dict.get('fecha'), users_map=users_map)
    conn.close()
    return jsonify(b_dict)


def _resolve_target_owner_and_proxy(cursor, raw_user_id, raw_colaborador, requesting_user_id):
    """Canonicaliza titular (user_id, colaborador) y valida autorización de Modo Apoyo."""
    user_id = raw_user_id
    colaborador = (raw_colaborador or '').strip()

    if not user_id and colaborador:
        u_match = cursor.execute(
            "SELECT id, full_name FROM users WHERE LOWER(full_name) = LOWER(?) OR LOWER(username) = LOWER(?)",
            (colaborador, colaborador)
        ).fetchone()
        if u_match:
            user_id = u_match['id']
            colaborador = u_match['full_name']
    elif user_id:
        u_by_id = cursor.execute("SELECT id, full_name FROM users WHERE id = ?", (user_id,)).fetchone()
        if u_by_id:
            user_id = u_by_id['id']
            colaborador = u_by_id['full_name']

    if not user_id and requesting_user_id:
        req_role_row = cursor.execute("SELECT id, role, full_name FROM users WHERE id = ?", (requesting_user_id,)).fetchone()
        if req_role_row and req_role_row['role'] != 'admin':
            user_id = int(req_role_row['id'])
            colaborador = req_role_row['full_name']

    is_proxy_mode = False
    if requesting_user_id and user_id and int(requesting_user_id) != int(user_id):
        req_u = cursor.execute("SELECT id, role, full_name FROM users WHERE id = ?", (requesting_user_id,)).fetchone()
        if not req_u:
            return None, None, False, ("Usuario solicitante no válido", 403)
        if not user_can_access_owner(dict(req_u, team_id=cursor.execute("SELECT team_id FROM users WHERE id = ?", (requesting_user_id,)).fetchone()['team_id']), user_id):
            return None, None, False, ("No tienes autorización de apoyo para registrar tareas de este colaborador", 403)
        is_proxy_mode = True

    return user_id, colaborador, is_proxy_mode, None


def _find_or_create_bitacora(cursor, user_id, colaborador, fecha, area='Sistemas', hora_inicio='', now_peru=None):
    """Obtiene o crea de forma segura la cabecera de bitácora para (user_id, fecha)."""
    now_peru = now_peru or get_peru_now_str()

    def _find():
        if user_id:
            row = cursor.execute(
                "SELECT id FROM bitacoras WHERE user_id = ? AND fecha = ? ORDER BY id ASC LIMIT 1",
                (user_id, fecha)
            ).fetchone()
            if not row and colaborador:
                row = cursor.execute(
                    "SELECT id FROM bitacoras WHERE user_id IS NULL AND LOWER(colaborador) = LOWER(?) AND fecha = ? ORDER BY id ASC LIMIT 1",
                    (colaborador, fecha)
                ).fetchone()
        else:
            row = cursor.execute(
                "SELECT id FROM bitacoras WHERE LOWER(colaborador) = LOWER(?) AND fecha = ? ORDER BY id ASC LIMIT 1",
                (colaborador, fecha)
            ).fetchone()
        return row['id'] if row else None

    b_id = _find()
    if b_id:
        return b_id

    eff_hora = hora_inicio or get_default_hora_inicio(cursor)
    try:
        cursor.execute('''
            INSERT INTO bitacoras (
                user_id, fecha, hora_inicio, colaborador, area,
                pendientes, necesita_apoyo, prioridad_siguiente,
                tiempo_total_min, estado, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, '', 'No', '', 0, 'generada', ?, ?)
        ''', (user_id, fecha, eff_hora, colaborador, area or 'Sistemas', now_peru, now_peru))
        return cursor.lastrowid
    except sqlite3.IntegrityError:
        b_id = _find()
        if not b_id:
            raise
        return b_id


def _sync_shared_copies_same_day(cursor, owner_user_id, fecha, shared_with_val, shared_uuid, act_payload, now_peru):
    """Sincroniza copias de una tarea compartida hacia las bitácoras del mismo día de los co-autores."""
    touched_bitacoras = set()
    if not shared_with_val or not shared_uuid:
        return touched_bitacoras

    evidencias_json = act_payload['evidencias_json']
    counterpart_shared = json.dumps([owner_user_id] if owner_user_id else [])

    for target_uid in shared_with_val:
        if owner_user_id and str(target_uid) == str(owner_user_id):
            continue
        target_u = cursor.execute("SELECT id, full_name FROM users WHERE id = ?", (target_uid,)).fetchone()
        if not target_u:
            continue

        target_b_id = _find_or_create_bitacora(
            cursor,
            target_u['id'],
            target_u['full_name'],
            fecha,
            area='Sistemas',
            hora_inicio=act_payload['hora_inicio'] or get_default_hora_inicio(cursor),
            now_peru=now_peru,
        )

        existing_sync_act = cursor.execute(
            "SELECT id, is_deleted FROM actividades WHERE bitacora_id = ? AND shared_uuid = ?",
            (target_b_id, shared_uuid)
        ).fetchone()

        if existing_sync_act:
            if existing_sync_act['is_deleted']:
                continue
            cursor.execute('''
                UPDATE actividades SET
                    hora_inicio = ?,
                    hora_fin = ?,
                    duracion_min = ?,
                    tipo_trabajo = ?,
                    descripcion = ?,
                    para_cliente = ?,
                    estado = ?,
                    evidencias = ?,
                    shared_with = ?,
                    updated_at = ?
                WHERE id = ?
            ''', (
                act_payload['hora_inicio'],
                act_payload['hora_fin'],
                act_payload['duracion_min'],
                act_payload['tipo_trabajo'],
                act_payload['descripcion'],
                act_payload['para_cliente'],
                act_payload['estado'],
                evidencias_json,
                counterpart_shared,
                now_peru,
                existing_sync_act['id']
            ))
        else:
            next_ord = cursor.execute(
                "SELECT COALESCE(MAX(orden), 0) + 1 FROM actividades WHERE bitacora_id = ?",
                (target_b_id,)
            ).fetchone()[0]
            cursor.execute('''
                INSERT INTO actividades (
                    bitacora_id, orden, hora_inicio, hora_fin, duracion_min,
                    tipo_trabajo, descripcion, para_cliente, estado,
                    evidencias, shared_with, shared_uuid, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                target_b_id,
                next_ord,
                act_payload['hora_inicio'],
                act_payload['hora_fin'],
                act_payload['duracion_min'],
                act_payload['tipo_trabajo'],
                act_payload['descripcion'],
                act_payload['para_cliente'],
                act_payload['estado'],
                evidencias_json,
                counterpart_shared,
                shared_uuid,
                now_peru,
                now_peru
            ))

        touched_bitacoras.add(target_b_id)
    return touched_bitacoras


@app.route('/api/bitacoras/header', methods=['PATCH', 'POST', 'OPTIONS'])
@app.route('/api/bitacoras/<int:bitacora_id>/header', methods=['PATCH', 'POST', 'OPTIONS'])
def update_bitacora_header(bitacora_id=None):
    """Actualiza atómicamente solo la cabecera/cierre de una bitácora sin reenviar ni pisar `actividades[]`."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json() or {}
    conn = get_db()
    cursor = conn.cursor()
    now_peru = get_peru_now_str()
    requesting_user_id = data.get('requesting_user_id') or (getattr(g, 'current_user', None) or {}).get('id')

    target_b = None
    if bitacora_id is not None:
        target_b = cursor.execute("SELECT * FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone()
        if not target_b:
            conn.close()
            return jsonify({"error": "Bitácora no encontrada"}), 404
        user_id = target_b['user_id']
        colaborador = target_b['colaborador']
        fecha = target_b['fecha']
        is_proxy_mode = bool(requesting_user_id and user_id and int(requesting_user_id) != int(user_id))
    else:
        raw_b_id = data.get('id') or data.get('bitacora_id')
        fecha = (data.get('fecha') or '').strip()
        user_id, colaborador, is_proxy_mode, err = _resolve_target_owner_and_proxy(
            cursor, data.get('user_id'), data.get('colaborador'), requesting_user_id
        )
        if err:
            conn.close()
            return jsonify({"error": err[0]}), err[1]

        if raw_b_id and str(raw_b_id).isdigit():
            row = cursor.execute("SELECT * FROM bitacoras WHERE id = ?", (int(raw_b_id),)).fetchone()
            if row and (not fecha or row['fecha'] == fecha) and (
                row['user_id'] is None or not user_id or str(row['user_id']) == str(user_id)
            ):
                target_b = row
                bitacora_id = row['id']
                fecha = row['fecha']
                colaborador = colaborador or row['colaborador']
                user_id = user_id or row['user_id']

        if not target_b:
            if not fecha or not (colaborador or user_id):
                conn.close()
                return jsonify({"error": "Se requiere bitacora_id o (fecha y colaborador/user_id)"}), 400
            bitacora_id = _find_or_create_bitacora(
                cursor,
                user_id,
                colaborador,
                fecha,
                area=data.get('area') or 'Sistemas',
                hora_inicio=data.get('hora_inicio') or '',
                now_peru=now_peru,
            )
            target_b = cursor.execute("SELECT * FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone()

    allowed_cols = (
        'hora_inicio', 'area', 'pendientes', 'necesita_apoyo',
        'apoyo_detalle', 'prioridad_siguiente', 'resumen_texto', 'estado'
    )
    updates = []
    params = []
    for col in allowed_cols:
        if col in data and data[col] is not None:
            val = data[col]
            if col == 'estado' and is_proxy_mode and val in ('completada', 'cerrada', 'cerrada_sistema'):
                val = target_b['estado'] or 'generada'
            updates.append(f"{col} = ?")
            params.append(str(val))

    if updates:
        updates.append("updated_at = ?")
        params.append(now_peru)
        params.append(bitacora_id)
        cursor.execute(f"UPDATE bitacoras SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()

    updated_b = dict(cursor.execute("SELECT * FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone())
    conn.close()
    return jsonify({
        "success": True,
        "bitacora_id": bitacora_id,
        "header": updated_b,
    }), 200


@app.route('/api/bitacoras', methods=['POST', 'OPTIONS'])
def save_bitacora():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json() or {}
    fecha = data.get('fecha')
    colaborador = data.get('colaborador')
    area = data.get('area', 'Sistemas')
    user_id = data.get('user_id')

    if not fecha or not colaborador:
        return jsonify({"error": "Fecha y Colaborador son requeridos"}), 400

    conn = get_db()
    cursor = conn.cursor()

    requesting_user_id = data.get('requesting_user_id')
    user_id, colaborador, is_proxy_mode, err = _resolve_target_owner_and_proxy(
        cursor, user_id, colaborador, requesting_user_id
    )
    if err:
        conn.close()
        return jsonify({"error": err[0]}), err[1]

    effective_creator_id = requesting_user_id or user_id

    estado_req = data.get('estado', 'generada')
    if is_proxy_mode and estado_req in ('completada', 'cerrada', 'cerrada_sistema'):
        estado_to_save = 'generada'
    else:
        estado_to_save = estado_req

    sync_mode = str(data.get('sync_mode') or 'replace').lower()
    is_merge = sync_mode == 'merge'

    header_fields = {
        'hora_inicio': data.get('hora_inicio', '') or '',
        'area': area,
        'pendientes': data.get('pendientes', '') or '',
        'necesita_apoyo': data.get('necesita_apoyo', 'No') or 'No',
        'apoyo_detalle': data.get('apoyo_detalle', '') or '',
        'prioridad_siguiente': data.get('prioridad_siguiente', '') or '',
        'resumen_texto': data.get('resumen_texto', '') or '',
    }

    def _update_header(b_id):
        if is_merge:
            sets = ", ".join(
                f"{k} = CASE WHEN COALESCE({k}, '') = '' THEN ? ELSE {k} END" for k in header_fields
            )
            cursor.execute(
                f"UPDATE bitacoras SET user_id = COALESCE(user_id, ?), colaborador = ?, {sets}, updated_at = ? WHERE id = ?",
                (user_id, colaborador, *header_fields.values(), now_peru, b_id)
            )
        else:
            sets = ", ".join(f"{k} = ?" for k in header_fields)
            cursor.execute(
                f"UPDATE bitacoras SET user_id = COALESCE(?, user_id), colaborador = ?, {sets}, estado = ?, updated_at = ? WHERE id = ?",
                (user_id, colaborador, *header_fields.values(), estado_to_save, now_peru, b_id)
            )

    def _find_by_owner_date():
        if user_id:
            row = cursor.execute(
                "SELECT id FROM bitacoras WHERE user_id = ? AND fecha = ? ORDER BY id ASC LIMIT 1",
                (user_id, fecha)
            ).fetchone()
            if not row:
                row = cursor.execute(
                    "SELECT id FROM bitacoras WHERE user_id IS NULL AND LOWER(colaborador) = LOWER(?) AND fecha = ? ORDER BY id ASC LIMIT 1",
                    (colaborador, fecha)
                ).fetchone()
        else:
            row = cursor.execute(
                "SELECT id FROM bitacoras WHERE LOWER(colaborador) = LOWER(?) AND fecha = ? ORDER BY id ASC LIMIT 1",
                (colaborador, fecha)
            ).fetchone()
        return row['id'] if row else None

    try:
        now_peru = get_peru_now_str()
        actividades_data = data.get('actividades') or []
        if not isinstance(actividades_data, list):
            actividades_data = []

        bitacora_id = None
        raw_b_id = data.get('id')
        if raw_b_id is not None and str(raw_b_id).isdigit():
            row = cursor.execute("SELECT id, user_id, fecha FROM bitacoras WHERE id = ?", (int(raw_b_id),)).fetchone()
            if row and row['fecha'] == fecha and (
                row['user_id'] is None or not user_id or str(row['user_id']) == str(user_id)
            ):
                bitacora_id = row['id']
        if not bitacora_id:
            bitacora_id = _find_by_owner_date()

        if bitacora_id:
            _update_header(bitacora_id)
        else:
            try:
                cursor.execute('''
                    INSERT INTO bitacoras (
                        user_id, fecha, hora_inicio, colaborador, area, pendientes,
                        necesita_apoyo, apoyo_detalle, prioridad_siguiente,
                        tiempo_total_min, resumen_texto, estado, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
                ''', (
                    user_id, fecha, header_fields['hora_inicio'], colaborador, area,
                    header_fields['pendientes'], header_fields['necesita_apoyo'],
                    header_fields['apoyo_detalle'], header_fields['prioridad_siguiente'],
                    header_fields['resumen_texto'], estado_to_save, now_peru, now_peru
                ))
                bitacora_id = cursor.lastrowid
            except sqlite3.IntegrityError:
                bitacora_id = _find_by_owner_date()
                if not bitacora_id:
                    raise
                _update_header(bitacora_id)

        all_rows = [dict(r) for r in cursor.execute(
            "SELECT id, orden, shared_uuid, client_uid, updated_at, updated_by_user_id, is_deleted, estado, revisado_at FROM actividades WHERE bitacora_id = ? ORDER BY orden ASC, id ASC",
            (bitacora_id,)
        ).fetchall()]
        active_by_id = {r['id']: r for r in all_rows if not r.get('is_deleted')}
        deleted_rows = [r for r in all_rows if r.get('is_deleted')]
        deleted_ids_set = {r['id'] for r in deleted_rows}
        deleted_shared = {r['shared_uuid'] for r in deleted_rows if r.get('shared_uuid')}
        deleted_client = {r['client_uid'] for r in deleted_rows if r.get('client_uid')}

        used_ids = set()
        matched_target_ids = {}
        skip_idx = set()

        def _client_uid_of(a):
            cu = a.get('client_uid')
            if cu:
                return str(cu)[:80]
            raw = a.get('id')
            if raw is not None and not str(raw).isdigit() and str(raw).strip():
                return str(raw)[:80]
            return None

        for idx, act in enumerate(actividades_data):
            raw = act.get('id')
            if raw is None or not str(raw).isdigit():
                continue
            num = int(raw)
            if num in active_by_id and num not in used_ids:
                matched_target_ids[idx] = num
                used_ids.add(num)
            elif num in deleted_ids_set:
                skip_idx.add(idx)

        for idx, act in enumerate(actividades_data):
            if idx in matched_target_ids or idx in skip_idx:
                continue
            su = act.get('shared_uuid')
            if not su:
                continue
            for ex in active_by_id.values():
                if ex['id'] not in used_ids and ex.get('shared_uuid') == su:
                    matched_target_ids[idx] = ex['id']
                    used_ids.add(ex['id'])
                    break
            else:
                if su in deleted_shared:
                    skip_idx.add(idx)

        for idx, act in enumerate(actividades_data):
            if idx in matched_target_ids or idx in skip_idx:
                continue
            cu = _client_uid_of(act)
            if not cu:
                continue
            for ex in active_by_id.values():
                if ex['id'] not in used_ids and ex.get('client_uid') == cu:
                    matched_target_ids[idx] = ex['id']
                    used_ids.add(ex['id'])
                    break
            else:
                if cu in deleted_client:
                    skip_idx.add(idx)

        next_orden = (max([r['orden'] or 0 for r in all_rows]) + 1) if all_rows else 0
        conflicts = 0
        completed_in_save = []
        shared_bitacoras_touched = set()

        for idx, act in enumerate(actividades_data):
            if idx in skip_idx:
                continue
            target_act_id = matched_target_ids.get(idx)

            if target_act_id:
                srv_row_chk = active_by_id[target_act_id]
                srv_upd = srv_row_chk.get('updated_at')
                cli_upd = act.get('updated_at')
                if is_merge:
                    if not cli_upd or (srv_upd and str(srv_upd) != str(cli_upd)):
                        conflicts += 1
                        continue
                elif cli_upd and srv_upd and str(srv_upd) > str(cli_upd):
                    # Protección contra sobrescritura concurrente entre Titular y Modo Apoyo:
                    # si otro usuario actualizó esta actividad más recientemente en el servidor, conservar la versión nueva.
                    srv_updater = srv_row_chk.get('updated_by_user_id')
                    if srv_updater and effective_creator_id and int(srv_updater) != int(effective_creator_id):
                        conflicts += 1
                        continue

            evidencias_clean = sanitize_evidencias(act.get('evidencias', []), act.get('descripcion', ''))
            evidencias_json = json.dumps(evidencias_clean)

            shared_with_val = act.get('shared_with', [])
            if not isinstance(shared_with_val, list):
                try:
                    shared_with_val = json.loads(shared_with_val) if shared_with_val else []
                except Exception:
                    shared_with_val = []
            shared_with_json = json.dumps(shared_with_val)

            shared_uuid = act.get('shared_uuid')
            if shared_with_val and not shared_uuid:
                shared_uuid = f"sync-{int(time.time()*1000)}-{idx}-{user_id}"
            parent_task_id = int(act['parent_task_id']) if act.get('parent_task_id') and str(act['parent_task_id']).isdigit() else None
            if target_act_id and parent_task_id == target_act_id:
                parent_task_id = None
            comentarios = act.get('comentarios', '') or ''
            tipo_vinculo = act.get('tipo_vinculo', 'continuacion') or 'continuacion'
            try:
                duracion = max(0, int(act.get('duracion_min', 0) or 0))
            except (TypeError, ValueError):
                duracion = 0
            act_hora_inicio = (act.get('hora_inicio') or '').strip()
            if act_hora_inicio:
                act_hora_fin = (act.get('hora_fin') or '').strip() or calculate_hora_fin(act_hora_inicio, duracion, fecha)
            else:
                act_hora_fin = ''
            client_uid = _client_uid_of(act)

            estado_to_write = act.get('estado', 'completada')
            if target_act_id:
                srv_row = active_by_id[target_act_id]
                srv_rev = srv_row.get('revisado_at')
                if srv_rev and str(act.get('revisado_at') or '') != str(srv_rev):
                    estado_to_write = srv_row.get('estado') or estado_to_write

            norm_cliente = normalize_client_name(act.get('para_cliente', ''))

            if target_act_id:
                cursor.execute('''
                    UPDATE actividades SET
                        orden = ?, hora_inicio = ?, hora_fin = ?, duracion_min = ?,
                        tipo_trabajo = ?, descripcion = ?, para_cliente = ?,
                        estado = ?, evidencias = ?, shared_with = ?,
                        shared_uuid = COALESCE(?, shared_uuid),
                        client_uid = COALESCE(client_uid, ?),
                        comentarios = ?, parent_task_id = ?, tipo_vinculo = ?,
                        created_by_user_id = COALESCE(created_by_user_id, ?),
                        updated_by_user_id = ?,
                        updated_at = ?,
                        last_stagnant_notified_at = NULL
                    WHERE id = ?
                ''', (
                    idx if not is_merge else active_by_id[target_act_id].get('orden', idx),
                    act_hora_inicio,
                    act_hora_fin,
                    duracion,
                    act.get('tipo_trabajo', ''),
                    act.get('descripcion', ''),
                    norm_cliente,
                    estado_to_write,
                    evidencias_json,
                    shared_with_json,
                    shared_uuid,
                    client_uid,
                    comentarios,
                    parent_task_id,
                    tipo_vinculo,
                    effective_creator_id,
                    effective_creator_id,
                    now_peru,
                    target_act_id
                ))
                saved_id = target_act_id
            else:
                orden_val = idx if not is_merge else next_orden
                if is_merge:
                    next_orden += 1
                cursor.execute('''
                    INSERT INTO actividades (
                        bitacora_id, orden, hora_inicio, hora_fin, duracion_min,
                        tipo_trabajo, descripcion, para_cliente, estado, evidencias,
                        shared_with, shared_uuid, client_uid, comentarios, parent_task_id, tipo_vinculo,
                        created_by_user_id, updated_by_user_id,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    bitacora_id,
                    orden_val,
                    act_hora_inicio,
                    act_hora_fin,
                    duracion,
                    act.get('tipo_trabajo', ''),
                    act.get('descripcion', ''),
                    norm_cliente,
                    estado_to_write,
                    evidencias_json,
                    shared_with_json,
                    shared_uuid,
                    client_uid,
                    comentarios,
                    parent_task_id,
                    tipo_vinculo,
                    effective_creator_id,
                    effective_creator_id,
                    now_peru,
                    now_peru
                ))
                saved_id = cursor.lastrowid
                used_ids.add(saved_id)

            if estado_to_write == 'completada' and saved_id:
                completed_in_save.append(saved_id)

            if shared_with_val and shared_uuid:
                touched = _sync_shared_copies_same_day(
                    cursor, user_id, fecha, shared_with_val, shared_uuid,
                    {
                        'hora_inicio': act_hora_inicio,
                        'hora_fin': act_hora_fin,
                        'duracion_min': duracion,
                        'tipo_trabajo': act.get('tipo_trabajo', ''),
                        'descripcion': act.get('descripcion', ''),
                        'para_cliente': norm_cliente,
                        'estado': estado_to_write,
                        'evidencias_json': evidencias_json,
                    },
                    now_peru,
                )
                shared_bitacoras_touched.update(touched)

        if not is_merge:
            for raw_del in (data.get('deleted_ids') or []):
                if raw_del is None or not str(raw_del).isdigit():
                    continue
                del_id = int(raw_del)
                if del_id in active_by_id and del_id not in matched_target_ids.values():
                    mark_lineage_rollover_dismissed(cursor, [del_id])
                    relink_children_before_delete(cursor, [del_id])
                    cursor.execute("UPDATE actividades SET is_deleted = 1, deleted_at = ? WHERE id = ?", (now_peru, del_id))

        recalculate_bitacora_durations(cursor, bitacora_id, fecha=fecha, now_peru=now_peru)
        for tb_id in shared_bitacoras_touched:
            recalculate_bitacora_durations(cursor, tb_id, fecha=fecha, now_peru=now_peru)

        closed_lineage_ids = []
        if completed_in_save:
            closed_lineage_ids = propagate_completion_across_lineage(cursor, completed_in_save, now_peru)

        conn.commit()

        if is_proxy_mode:
            try:
                del_user = cursor.execute("SELECT full_name FROM users WHERE id = ?", (requesting_user_id,)).fetchone()
                del_name = del_user['full_name'] if del_user else "Un colaborador de apoyo"
                cursor.execute('''
                    INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                    VALUES (?, 'Registro de Apoyo', ?, 'info', 0, CURRENT_TIMESTAMP)
                ''', (user_id, f"{del_name} ha registrado o actualizado actividades de apoyo en tu bitácora del {fecha}."))
                conn.commit()
            except Exception as ne:
                logger.warning("[Notif proxy] %s", ne)

        users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
        b = cursor.execute("SELECT * FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone()
        b_dict = dict(b)
        b_dict['actividades'] = fetch_enriched_bitacora_activities(cursor, bitacora_id, fecha=b_dict.get('fecha'), users_map=users_map)

        conn.close()
        return jsonify({
            "message": "Bitácora guardada con éxito",
            "bitacora": b_dict,
            "conflicts": conflicts,
            "closed_lineage_ids": closed_lineage_ids,
        }), 200

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500


# ==================== ACTIVIDADES ATOMIC CRUD & REVISION ====================

def _same_day_shared_siblings(cursor, act_id, shared_uuid):
    """Copias activas de una tarea compartida en bitácoras de OTROS usuarios del MISMO día."""
    if not shared_uuid:
        return []
    return cursor.execute('''
        SELECT a.id, a.bitacora_id FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE a.shared_uuid = ? AND a.id != ?
          AND (a.is_deleted IS NULL OR a.is_deleted = 0)
          AND b.fecha = (
              SELECT b2.fecha FROM actividades a2 JOIN bitacoras b2 ON a2.bitacora_id = b2.id WHERE a2.id = ?
          )
          AND a.bitacora_id != (SELECT bitacora_id FROM actividades WHERE id = ?)
    ''', (shared_uuid, act_id, act_id, act_id)).fetchall()


def _plain_snippet(raw_html, limit=80):
    text = strip_html_text(raw_html)
    return (text[:limit] + '…') if len(text) > limit else text


def _notify_reviewers(cursor, owner_id, colaborador, descripcion):
    """Avisa a los líderes del equipo del colaborador que hay una tarea esperando su aprobación."""
    if not owner_id:
        return
    try:
        leaders = cursor.execute('''
            SELECT DISTINCT l.id FROM users o
            JOIN teams t ON o.team_id = t.id
            JOIN users l ON l.id = t.lider_id
            WHERE o.id = ? AND l.id != o.id AND COALESCE(l.is_active, 1) = 1
        ''', (owner_id,)).fetchall()
        msg = f"{colaborador} solicita tu aprobación: «{_plain_snippet(descripcion)}»"
        for row in leaders:
            cursor.execute('''
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                VALUES (?, 'Aprobación pendiente', ?, 'warning', 0, CURRENT_TIMESTAMP)
            ''', (row['id'], msg))
    except Exception as ne:
        logger.warning("[Notif revisión] %s", ne)


@app.route('/api/actividades', methods=['POST', 'OPTIONS'])
def create_actividad_atomica():
    """Crea una única actividad de forma atómica (idempotente por `client_uid`), evitando reenviar toda la bitácora."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json() or {}
    act_in = data.get('actividad') if isinstance(data.get('actividad'), dict) else data
    fecha = (data.get('fecha') or act_in.get('fecha') or '').strip()
    area = (data.get('area') or 'Sistemas').strip()
    hora_inicio_jornada = (data.get('hora_inicio_jornada') or '').strip()

    conn = get_db()
    cursor = conn.cursor()
    now_peru = get_peru_now_str()
    requesting_user_id = data.get('requesting_user_id') or (getattr(g, 'current_user', None) or {}).get('id')

    raw_b_id = data.get('bitacora_id') or act_in.get('bitacora_id')
    user_id, colaborador, is_proxy_mode, err = _resolve_target_owner_and_proxy(
        cursor, data.get('user_id'), data.get('colaborador'), requesting_user_id
    )
    if err:
        conn.close()
        return jsonify({"error": err[0]}), err[1]

    bitacora_id = None
    if raw_b_id and str(raw_b_id).isdigit():
        b_row = cursor.execute("SELECT * FROM bitacoras WHERE id = ?", (int(raw_b_id),)).fetchone()
        if b_row:
            acting_user = getattr(g, 'current_user', None)
            if acting_user and not user_can_access_owner(acting_user, b_row['user_id']):
                conn.close()
                return jsonify({"error": "No tienes permisos para modificar esta bitácora"}), 403
            if not fecha or b_row['fecha'] == fecha:
                bitacora_id = b_row['id']
                fecha = b_row['fecha']
                user_id = user_id or b_row['user_id']
                colaborador = colaborador or b_row['colaborador']
                is_proxy_mode = bool(requesting_user_id and user_id and int(requesting_user_id) != int(user_id))

    if not bitacora_id:
        if not fecha or not (user_id or colaborador):
            conn.close()
            return jsonify({"error": "Fecha y Colaborador son requeridos para registrar la actividad"}), 400
        bitacora_id = _find_or_create_bitacora(
            cursor, user_id, colaborador, fecha, area=area, hora_inicio=hora_inicio_jornada, now_peru=now_peru
        )

    effective_creator_id = requesting_user_id or user_id
    raw_client_uid = act_in.get('client_uid') or (
        act_in.get('id') if act_in.get('id') is not None and not str(act_in.get('id')).isdigit() else None
    )
    client_uid = str(raw_client_uid)[:80] if raw_client_uid and str(raw_client_uid).strip() else None

    # Idempotencia por client_uid en la misma bitácora
    existing_row = None
    if client_uid:
        existing_row = cursor.execute(
            "SELECT id, is_deleted FROM actividades WHERE bitacora_id = ? AND client_uid = ? LIMIT 1",
            (bitacora_id, client_uid)
        ).fetchone()
        if existing_row and existing_row['is_deleted']:
            conn.close()
            return jsonify({"error": "La actividad ya fue eliminada previamente"}), 409

    try:
        duracion = max(0, int(act_in.get('duracion_min', 0) or 0))
    except (TypeError, ValueError):
        duracion = 0

    act_hora_inicio = (act_in.get('hora_inicio') or '').strip()
    if act_hora_inicio:
        act_hora_fin = (act_in.get('hora_fin') or '').strip() or calculate_hora_fin(act_hora_inicio, duracion, fecha)
    else:
        act_hora_fin = ''

    descripcion = act_in.get('descripcion', '') or ''
    tipo_trabajo = act_in.get('tipo_trabajo', '') or ''
    norm_cliente = normalize_client_name(act_in.get('para_cliente', ''))
    estado = act_in.get('estado', 'en_proceso') or 'en_proceso'
    comentarios = act_in.get('comentarios', '') or ''
    tipo_vinculo = act_in.get('tipo_vinculo', 'continuacion') or 'continuacion'
    parent_task_id = (
        int(act_in['parent_task_id'])
        if act_in.get('parent_task_id') and str(act_in['parent_task_id']).isdigit()
        else None
    )

    evidencias_clean = sanitize_evidencias(act_in.get('evidencias', []), descripcion)
    evidencias_json = json.dumps(evidencias_clean)

    shared_with_val = act_in.get('shared_with', [])
    if not isinstance(shared_with_val, list):
        try:
            shared_with_val = json.loads(shared_with_val) if shared_with_val else []
        except Exception:
            shared_with_val = []
    shared_with_json = json.dumps(shared_with_val)
    shared_uuid = act_in.get('shared_uuid')
    if shared_with_val and not shared_uuid:
        shared_uuid = f"sync-{int(time.time()*1000)}-{user_id or 0}"

    try:
        if existing_row:
            act_id = existing_row['id']
            cursor.execute('''
                UPDATE actividades SET
                    hora_inicio = ?, hora_fin = ?, duracion_min = ?,
                    tipo_trabajo = ?, descripcion = ?, para_cliente = ?,
                    estado = ?, evidencias = ?, shared_with = ?,
                    shared_uuid = COALESCE(?, shared_uuid),
                    comentarios = ?, parent_task_id = ?, tipo_vinculo = ?,
                    updated_by_user_id = ?, updated_at = ?, last_stagnant_notified_at = NULL
                WHERE id = ?
            ''', (
                act_hora_inicio, act_hora_fin, duracion,
                tipo_trabajo, descripcion, norm_cliente,
                estado, evidencias_json, shared_with_json,
                shared_uuid, comentarios, parent_task_id, tipo_vinculo,
                effective_creator_id, now_peru, act_id
            ))
        else:
            next_orden = cursor.execute(
                "SELECT COALESCE(MAX(orden), -1) + 1 FROM actividades WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0)",
                (bitacora_id,)
            ).fetchone()[0]
            cursor.execute('''
                INSERT INTO actividades (
                    bitacora_id, orden, hora_inicio, hora_fin, duracion_min,
                    tipo_trabajo, descripcion, para_cliente, estado, evidencias,
                    shared_with, shared_uuid, client_uid, comentarios, parent_task_id, tipo_vinculo,
                    created_by_user_id, updated_by_user_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                bitacora_id, next_orden, act_hora_inicio, act_hora_fin, duracion,
                tipo_trabajo, descripcion, norm_cliente, estado, evidencias_json,
                shared_with_json, shared_uuid, client_uid, comentarios, parent_task_id, tipo_vinculo,
                effective_creator_id, effective_creator_id, now_peru, now_peru
            ))
            act_id = cursor.lastrowid

        touched = _sync_shared_copies_same_day(
            cursor, user_id, fecha, shared_with_val, shared_uuid,
            {
                'hora_inicio': act_hora_inicio,
                'hora_fin': act_hora_fin,
                'duracion_min': duracion,
                'tipo_trabajo': tipo_trabajo,
                'descripcion': descripcion,
                'para_cliente': norm_cliente,
                'estado': estado,
                'evidencias_json': evidencias_json,
            },
            now_peru,
        )

        recalculate_bitacora_durations(cursor, bitacora_id, fecha=fecha, now_peru=now_peru)
        for tb_id in touched:
            recalculate_bitacora_durations(cursor, tb_id, fecha=fecha, now_peru=now_peru)

        closed_lineage_ids = []
        if estado == 'completada':
            closed_lineage_ids = propagate_completion_across_lineage(cursor, [act_id], now_peru)
        elif estado == 'en_revision':
            _notify_reviewers(cursor, user_id, colaborador, descripcion)

        if is_proxy_mode and user_id:
            try:
                del_user = cursor.execute("SELECT full_name FROM users WHERE id = ?", (requesting_user_id,)).fetchone()
                del_name = del_user['full_name'] if del_user else "Un colaborador de apoyo"
                cursor.execute('''
                    INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                    VALUES (?, 'Registro de Apoyo', ?, 'info', 0, CURRENT_TIMESTAMP)
                ''', (user_id, f"{del_name} registró una actividad de apoyo en tu bitácora del {fecha}."))
            except Exception as ne:
                logger.warning("[Notif proxy create] %s", ne)

        conn.commit()

        users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
        b_info = cursor.execute("SELECT tiempo_total_min FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone()
        tiempo_total = b_info['tiempo_total_min'] if b_info else 0
        enriched_acts = fetch_enriched_bitacora_activities(cursor, bitacora_id, fecha=fecha, users_map=users_map)
        created_act = next((a for a in enriched_acts if a.get('id') == act_id), None)

        conn.close()
        return jsonify({
            "success": True,
            "bitacora_id": bitacora_id,
            "actividad": created_act,
            "bitacora_actividades": enriched_acts,
            "tiempo_total_min": tiempo_total,
            "closed_lineage_ids": closed_lineage_ids,
        }), (200 if existing_row else 201)
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500


@app.route('/api/actividades/<int:act_id>/estado', methods=['PATCH', 'OPTIONS'])
def update_actividad_estado(act_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.get_json() or {}
    nuevo_estado = data.get('estado')
    if not nuevo_estado:
        return jsonify({"error": "Estado es requerido"}), 400

    conn = get_db()
    cursor = conn.cursor()
    now_peru = get_peru_now_str()
    acting_uid = (getattr(g, 'current_user', None) or {}).get('id') or data.get('requesting_user_id')
    act = cursor.execute('''
        SELECT a.id, a.bitacora_id, a.shared_uuid, a.estado, a.descripcion, b.user_id AS owner_id, b.colaborador, b.fecha AS bitacora_fecha
        FROM actividades a JOIN bitacoras b ON a.bitacora_id = b.id WHERE a.id = ?
    ''', (act_id,)).fetchone()
    if not act:
        conn.close()
        return jsonify({"error": "Actividad no encontrada"}), 404
    cursor.execute(
        "UPDATE actividades SET estado = ?, updated_by_user_id = COALESCE(?, updated_by_user_id), updated_at = ?, last_stagnant_notified_at = NULL WHERE id = ?",
        (nuevo_estado, acting_uid, now_peru, act_id)
    )
    sib_ids = []
    for sib in _same_day_shared_siblings(cursor, act_id, act['shared_uuid']):
        cursor.execute(
            "UPDATE actividades SET estado = ?, updated_at = ?, last_stagnant_notified_at = NULL WHERE id = ?",
            (nuevo_estado, now_peru, sib['id'])
        )
        sib_ids.append(sib['id'])

    closed_lineage_ids = []
    if nuevo_estado == 'completada':
        closed_lineage_ids = propagate_completion_across_lineage(cursor, [act_id] + sib_ids, now_peru)
    elif nuevo_estado == 'en_revision' and act['estado'] != 'en_revision':
        _notify_reviewers(cursor, act['owner_id'], act['colaborador'], act['descripcion'])
    conn.commit()

    primary_b_id = act['bitacora_id']
    b_info = cursor.execute("SELECT tiempo_total_min FROM bitacoras WHERE id = ?", (primary_b_id,)).fetchone() if primary_b_id else None
    enriched_acts = fetch_enriched_bitacora_activities(cursor, primary_b_id, fecha=act['bitacora_fecha']) if primary_b_id else []
    conn.close()
    return jsonify({
        "success": True,
        "id": act_id,
        "nuevo_estado": nuevo_estado,
        "closed_lineage_ids": closed_lineage_ids,
        "bitacora_actividades": enriched_acts,
        "tiempo_total_min": b_info['tiempo_total_min'] if b_info else 0,
    })


REVISION_DECISIONS = {
    'aprobada_continuar': ('en_proceso', 'Aprobada: puedes continuar'),
    'aprobada_cerrada': ('completada', 'Aprobada y cerrada'),
    'devuelta': ('en_proceso', 'Devuelta con observaciones'),
}


@app.route('/api/actividades/<int:act_id>/revision', methods=['POST', 'OPTIONS'])
def revisar_actividad(act_id):
    """Decisión del líder sobre una tarea 'En revisión': aprobar y continuar, aprobar y cerrar,
    o devolver con observaciones. Guarda quién y cuándo, y avisa al colaborador."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.get_json() or {}
    decision = data.get('decision')
    comentario = (data.get('comentario') or '').strip()[:1000]
    if decision not in REVISION_DECISIONS:
        return jsonify({"error": "Decisión inválida"}), 400
    if decision == 'devuelta' and not comentario:
        return jsonify({"error": "Indica qué debe corregirse al devolver la tarea"}), 400

    reviewer = g.current_user
    conn = get_db()
    cursor = conn.cursor()
    act = cursor.execute('''
        SELECT a.id, a.shared_uuid, a.estado, a.descripcion, b.user_id AS owner_id
        FROM actividades a JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE a.id = ? AND (a.is_deleted IS NULL OR a.is_deleted = 0)
    ''', (act_id,)).fetchone()
    if not act:
        conn.close()
        return jsonify({"error": "Actividad no encontrada"}), 404
    if not user_can_review_owner(reviewer, act['owner_id']):
        conn.close()
        return jsonify({"error": "Solo el líder del equipo o un administrador puede revisar esta tarea"}), 403
    if act['estado'] != 'en_revision':
        conn.close()
        return jsonify({"error": "La tarea ya no está esperando revisión", "estado": act['estado']}), 409

    nuevo_estado, titulo = REVISION_DECISIONS[decision]
    now_peru = get_peru_now_str()
    ids = [act_id] + [s['id'] for s in _same_day_shared_siblings(cursor, act_id, act['shared_uuid'])]
    for target in ids:
        cursor.execute('''
            UPDATE actividades SET estado = ?, revision_decision = ?, revision_comentario = ?,
                revisado_por = ?, revisado_at = ?, updated_at = ?, updated_by_user_id = ?,
                last_stagnant_notified_at = NULL
            WHERE id = ?
        ''', (nuevo_estado, decision, comentario or None, reviewer['id'], now_peru, now_peru, reviewer['id'], target))

    closed_lineage_ids = []
    if nuevo_estado == 'completada':
        closed_lineage_ids = propagate_completion_across_lineage(cursor, ids, now_peru)

    if act['owner_id']:
        detalle = f" — {comentario}" if comentario else ''
        cursor.execute('''
            INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
            VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
        ''', (
            act['owner_id'], titulo,
            f"{reviewer['full_name']} revisó «{_plain_snippet(act['descripcion'])}»{detalle}",
            'warning' if decision == 'devuelta' else 'success',
        ))
    conn.commit()
    conn.close()
    return jsonify({
        "success": True, "id": act_id, "nuevo_estado": nuevo_estado, "revision_decision": decision,
        "revision_comentario": comentario or None, "revisado_por": reviewer['id'],
        "revisado_por_nombre": reviewer['full_name'], "revisado_at": now_peru,
        "closed_lineage_ids": closed_lineage_ids,
    })


@app.route('/api/actividades/<int:act_id>', methods=['GET', 'PUT', 'PATCH', 'OPTIONS'])
def update_actividad_detalle(act_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    if request.method == 'GET':
        conn = get_db()
        cursor = conn.cursor()
        query = '''
            SELECT a.*, b.fecha as bitacora_fecha, b.colaborador
            FROM actividades a
            JOIN bitacoras b ON a.bitacora_id = b.id
            WHERE a.id = ? AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        '''
        row = cursor.execute(query, (act_id,)).fetchone()
        conn.close()
        if not row:
            return jsonify({'error': 'Actividad no encontrada'}), 404
        d = dict(row)
        if d.get('evidencias'):
            try:
                d['evidencias'] = json.loads(d['evidencias'])
            except Exception:
                pass
        if d.get('shared_with'):
            try:
                d['shared_with'] = json.loads(d['shared_with'])
            except Exception:
                pass
        return jsonify(d), 200

    data = request.get_json() or {}
    acting_uid = (getattr(g, 'current_user', None) or {}).get('id') or data.get('requesting_user_id')

    conn = get_db()
    cursor = conn.cursor()
    now_peru = get_peru_now_str()
    act = cursor.execute('''
        SELECT a.id, a.bitacora_id, a.shared_uuid, a.hora_inicio, a.hora_fin, a.duracion_min,
               a.descripcion, a.tipo_trabajo, a.para_cliente, a.estado, a.evidencias,
               b.fecha AS bitacora_fecha, b.user_id AS owner_id, b.colaborador
        FROM actividades a
        LEFT JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE a.id = ?
    ''', (act_id,)).fetchone()
    if not act:
        conn.close()
        return jsonify({"error": "Actividad no encontrada"}), 404

    evidencias_json = None
    if 'evidencias' in data:
        target_desc = data.get('descripcion') if data.get('descripcion') is not None else (act['descripcion'] or '')
        ev_clean = sanitize_evidencias(data['evidencias'], target_desc)
        evidencias_json = json.dumps(ev_clean)

    shared_with_val = data.get('shared_with')
    shared_with_json = json.dumps(shared_with_val) if isinstance(shared_with_val, list) else None
    eff_shared_uuid = act['shared_uuid']
    if isinstance(shared_with_val, list) and len(shared_with_val) > 0 and not eff_shared_uuid:
        eff_shared_uuid = f"sync-{int(time.time()*1000)}-{act_id}-{act['owner_id'] or 0}"

    has_parent_key = 1 if 'parent_task_id' in data else 0
    parent_task_id_param = (
        int(data['parent_task_id'])
        if data.get('parent_task_id') and str(data['parent_task_id']).isdigit() and int(data['parent_task_id']) != act_id
        else None
    )
    comentarios_param = data.get('comentarios')
    tipo_vinculo_param = data.get('tipo_vinculo')

    eff_hora_inicio = (
        (data.get('hora_inicio') or '').strip()
        if 'hora_inicio' in data and data.get('hora_inicio') is not None
        else (act['hora_inicio'] or '').strip()
    )
    try:
        eff_dur = (
            max(0, int(data.get('duracion_min') or 0))
            if 'duracion_min' in data and data.get('duracion_min') is not None
            else max(0, int(act['duracion_min'] or 0))
        )
    except (TypeError, ValueError):
        eff_dur = max(0, int(act['duracion_min'] or 0))

    has_hora_fin_update = 0
    resolved_hora_fin = None
    if not eff_hora_inicio:
        if 'hora_inicio' in data or 'hora_fin' in data:
            has_hora_fin_update = 1
            resolved_hora_fin = ''
    elif 'hora_fin' in data and data.get('hora_fin') is not None:
        has_hora_fin_update = 1
        hfin_raw = str(data.get('hora_fin') or '').strip()
        resolved_hora_fin = hfin_raw or calculate_hora_fin(eff_hora_inicio, eff_dur, act['bitacora_fecha'])
    elif 'hora_inicio' in data or 'duracion_min' in data:
        has_hora_fin_update = 1
        resolved_hora_fin = calculate_hora_fin(eff_hora_inicio, eff_dur, act['bitacora_fecha'])

    norm_cliente_param = (
        normalize_client_name(data.get('para_cliente'))
        if 'para_cliente' in data and data.get('para_cliente') is not None
        else None
    )

    siblings = _same_day_shared_siblings(cursor, act_id, eff_shared_uuid)
    affected_bitacoras = set()
    sib_ids = []
    for sib in siblings:
        cursor.execute('''
            UPDATE actividades SET
                hora_inicio = COALESCE(?, hora_inicio),
                hora_fin = CASE WHEN ? = 1 THEN ? ELSE hora_fin END,
                duracion_min = COALESCE(?, duracion_min),
                tipo_trabajo = COALESCE(?, tipo_trabajo),
                descripcion = COALESCE(?, descripcion),
                para_cliente = COALESCE(?, para_cliente),
                estado = COALESCE(?, estado),
                evidencias = COALESCE(?, evidencias),
                updated_at = ?,
                last_stagnant_notified_at = NULL
            WHERE id = ?
        ''', (
            data.get('hora_inicio'),
            has_hora_fin_update,
            resolved_hora_fin,
            data.get('duracion_min'),
            data.get('tipo_trabajo'),
            data.get('descripcion'),
            norm_cliente_param,
            data.get('estado'),
            evidencias_json,
            now_peru,
            sib['id']
        ))
        affected_bitacoras.add(sib['bitacora_id'])
        sib_ids.append(sib['id'])

    cursor.execute('''
        UPDATE actividades SET
            hora_inicio = COALESCE(?, hora_inicio),
            hora_fin = CASE WHEN ? = 1 THEN ? ELSE hora_fin END,
            duracion_min = COALESCE(?, duracion_min),
            tipo_trabajo = COALESCE(?, tipo_trabajo),
            descripcion = COALESCE(?, descripcion),
            para_cliente = COALESCE(?, para_cliente),
            estado = COALESCE(?, estado),
            evidencias = COALESCE(?, evidencias),
            shared_with = COALESCE(?, shared_with),
            shared_uuid = COALESCE(?, shared_uuid),
            comentarios = COALESCE(?, comentarios),
            parent_task_id = CASE WHEN ? = 1 THEN ? ELSE parent_task_id END,
            tipo_vinculo = COALESCE(?, tipo_vinculo),
            updated_by_user_id = COALESCE(?, updated_by_user_id),
            updated_at = ?,
            last_stagnant_notified_at = NULL
        WHERE id = ?
    ''', (
        data.get('hora_inicio'),
        has_hora_fin_update,
        resolved_hora_fin,
        data.get('duracion_min'),
        data.get('tipo_trabajo'),
        data.get('descripcion'),
        norm_cliente_param,
        data.get('estado'),
        evidencias_json,
        shared_with_json,
        eff_shared_uuid,
        comentarios_param,
        has_parent_key,
        parent_task_id_param,
        tipo_vinculo_param,
        acting_uid,
        now_peru,
        act_id
    ))

    # Si se acaban de añadir colaboradores compartidos a una tarea existente, sincronizar sus copias del día
    if isinstance(shared_with_val, list) and len(shared_with_val) > 0 and eff_shared_uuid and act['bitacora_fecha']:
        cur_full = cursor.execute("SELECT * FROM actividades WHERE id = ?", (act_id,)).fetchone()
        if cur_full:
            newly_touched = _sync_shared_copies_same_day(
                cursor,
                act['owner_id'],
                act['bitacora_fecha'],
                shared_with_val,
                eff_shared_uuid,
                {
                    'hora_inicio': cur_full['hora_inicio'] or '',
                    'hora_fin': cur_full['hora_fin'] or '',
                    'duracion_min': cur_full['duracion_min'] or 0,
                    'tipo_trabajo': cur_full['tipo_trabajo'] or '',
                    'descripcion': cur_full['descripcion'] or '',
                    'para_cliente': cur_full['para_cliente'] or '',
                    'estado': cur_full['estado'] or 'en_proceso',
                    'evidencias_json': cur_full['evidencias'] or '[]',
                },
                now_peru,
            )
            affected_bitacoras.update(newly_touched)

    primary_b_id = act['bitacora_id']
    if primary_b_id:
        affected_bitacoras.add(primary_b_id)
    for b_id in affected_bitacoras:
        recalculate_bitacora_durations(cursor, b_id, now_peru=now_peru)

    closed_lineage_ids = []
    cur_estado_row = cursor.execute("SELECT estado, descripcion FROM actividades WHERE id = ?", (act_id,)).fetchone()
    if cur_estado_row:
        if cur_estado_row['estado'] == 'completada':
            closed_lineage_ids = propagate_completion_across_lineage(cursor, [act_id] + sib_ids, now_peru)
        elif cur_estado_row['estado'] == 'en_revision' and act['estado'] != 'en_revision':
            _notify_reviewers(cursor, act['owner_id'], act['colaborador'], cur_estado_row['descripcion'])

    conn.commit()
    users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}

    formatted_bitacora_acts = []
    formatted_updated = None
    tiempo_total = 0
    if primary_b_id:
        b_info = cursor.execute("SELECT fecha, tiempo_total_min FROM bitacoras WHERE id = ?", (primary_b_id,)).fetchone()
        b_fecha = b_info['fecha'] if b_info else act['bitacora_fecha']
        tiempo_total = b_info['tiempo_total_min'] if b_info else 0
        formatted_bitacora_acts = fetch_enriched_bitacora_activities(cursor, primary_b_id, fecha=b_fecha, users_map=users_map)
        formatted_updated = next((fa for fa in formatted_bitacora_acts if fa.get('id') == act_id), None)

    if formatted_updated is None:
        updated_act = cursor.execute('''
            SELECT a.*, p.descripcion as parent_task_desc, p.estado as parent_task_estado
            FROM actividades a
            LEFT JOIN actividades p ON a.parent_task_id = p.id
            WHERE a.id = ?
        ''', (act_id,)).fetchone()
        formatted_updated = format_actividad_dict(updated_act, users_map) if updated_act else None

    conn.close()
    return jsonify({
        "success": True,
        "actividad": formatted_updated,
        "bitacora_actividades": formatted_bitacora_acts,
        "tiempo_total_min": tiempo_total,
        "closed_lineage_ids": closed_lineage_ids,
    })


@app.route('/api/actividades/pendientes', methods=['GET'])
def get_actividades_pendientes():
    colaborador = request.args.get('colaborador')
    user_id = request.args.get('user_id')
    current_u = getattr(g, 'current_user', None) or {}

    conn = get_db()
    cursor = conn.cursor()

    query = '''
        SELECT a.*, b.fecha, b.colaborador
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE a.estado != 'completada'
          AND (a.is_deleted IS NULL OR a.is_deleted = 0)
          AND COALESCE(a.rollover_dismissed, 0) = 0
          AND NOT EXISTS (
              SELECT 1 FROM actividades a_child
              JOIN bitacoras b_child ON a_child.bitacora_id = b_child.id
              WHERE a_child.parent_task_id = a.id
                AND COALESCE(a_child.tipo_vinculo, 'continuacion') IN ('', 'continuacion')
                AND b_child.fecha > b.fecha
          )
    '''
    params = []

    if current_u.get('role') in ('analista', 'operador'):
        query += " AND (b.user_id = ? OR LOWER(b.colaborador) = LOWER(?) OR b.user_id IN (SELECT target_user_id FROM user_delegations WHERE delegate_user_id = ? AND is_active = 1))"
        params.extend([current_u['id'], current_u.get('full_name', ''), current_u['id']])
    elif current_u.get('role') == 'lider':
        leader_teams = [r['id'] for r in cursor.execute("SELECT id FROM teams WHERE lider_id = ? OR id = ?", (current_u['id'], current_u.get('team_id'))).fetchall()]
        if leader_teams:
            placeholders = ','.join(['?'] * len(leader_teams))
            query += f" AND (b.user_id IN (SELECT id FROM users WHERE team_id IN ({placeholders})) OR b.user_id = ?)"
            params.extend(leader_teams + [current_u['id']])

    if colaborador:
        query += " AND b.colaborador LIKE ?"
        params.append(f"%{colaborador}%")
    if user_id:
        query += " AND b.user_id = ?"
        params.append(user_id)

    query += " ORDER BY a.id DESC LIMIT 50"
    acts = cursor.execute(query, params).fetchall()
    conn.close()
    return jsonify([format_actividad_dict(a) for a in acts])


@app.route('/api/actividades/stagnant', methods=['GET', 'OPTIONS'])
def get_stagnant_actividades():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    user_id = request.args.get('user_id')
    user_id_int = int(user_id) if user_id and str(user_id).isdigit() else None

    conn = get_db()
    cursor = conn.cursor()
    res = check_and_notify_stagnant_activities(user_id=user_id_int, cursor=cursor, conn=conn)
    conn.close()
    return jsonify({
        "success": True,
        "stagnant_count": res['stagnant_count'],
        "notified_count": res['notified_count'],
        "items": res['stagnant_activities']
    })


@app.route('/api/bitacoras/<int:bitacora_id>', methods=['DELETE', 'OPTIONS'])
def delete_bitacora(bitacora_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    conn = get_db()
    cursor = conn.cursor()
    b_act_ids = [r[0] for r in cursor.execute("SELECT id FROM actividades WHERE bitacora_id = ?", (bitacora_id,)).fetchall()]
    if b_act_ids:
        mark_lineage_rollover_dismissed(cursor, b_act_ids)
        relink_children_before_delete(cursor, b_act_ids)
    cursor.execute("DELETE FROM actividades WHERE bitacora_id = ?", (bitacora_id,))
    cursor.execute("DELETE FROM bitacoras WHERE id = ?", (bitacora_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Bitácora eliminada"})


# ==================== PAPELERA DE RECICLAJE (RETENCIÓN 15 DÍAS) ====================

@app.route('/api/papelera', methods=['GET', 'OPTIONS'])
def get_papelera():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    try:
        cursor = conn.cursor()
        user_id = request.args.get('user_id')
        requesting_user_id = request.args.get('requesting_user_id')

        query = '''
            SELECT a.*, b.fecha as bitacora_fecha, b.colaborador as bitacora_colaborador, b.user_id as bitacora_user_id,
                   u.team_id, t.nombre as team_name
            FROM actividades a
            JOIN bitacoras b ON a.bitacora_id = b.id
            LEFT JOIN users u ON b.user_id = u.id
            LEFT JOIN teams t ON u.team_id = t.id
            WHERE a.is_deleted = 1
        '''
        params = []

        if requesting_user_id:
            req_u = cursor.execute("SELECT id, role, team_id, full_name, username FROM users WHERE id = ?", (requesting_user_id,)).fetchone()
            if req_u:
                if req_u['role'] in ('analista', 'operador'):
                    query += " AND (b.user_id = ? OR LOWER(b.colaborador) = LOWER(?) OR LOWER(b.colaborador) = LOWER(?))"
                    params.extend([req_u['id'], req_u['full_name'], req_u['username']])
                elif req_u['role'] == 'lider':
                    leader_teams = [r['id'] for r in cursor.execute("SELECT id FROM teams WHERE lider_id = ? OR id = ?", (req_u['id'], req_u['team_id'])).fetchall()]
                    if leader_teams:
                        placeholders = ','.join(['?'] * len(leader_teams))
                        query += f" AND (u.team_id IN ({placeholders}) OR u.id = ? OR b.user_id = ?)"
                        params.extend(leader_teams + [req_u['id'], req_u['id']])
                    else:
                        query += " AND (b.user_id = ? OR LOWER(b.colaborador) = LOWER(?))"
                        params.extend([req_u['id'], req_u['full_name']])
        elif user_id:
            query += " AND (b.user_id = ? OR u.id = ?)"
            params.extend([user_id, user_id])

        query += " ORDER BY a.deleted_at DESC, a.id DESC"
        deleted_rows = cursor.execute(query, params).fetchall()
        users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}

        items = []
        for row in deleted_rows:
            item = format_actividad_dict(row, users_map)
            deleted_at_str = item.get('deleted_at')
            dias_restantes = 15
            expira_en = None

            if deleted_at_str:
                try:
                    del_dt = datetime.strptime(deleted_at_str.split('.')[0], '%Y-%m-%d %H:%M:%S')
                    now_p = get_peru_now()
                    now_naive = datetime(now_p.year, now_p.month, now_p.day, now_p.hour, now_p.minute, now_p.second)
                    dias_transcurridos = max(0, (now_naive - del_dt).days)
                    dias_restantes = max(0, min(15, 15 - dias_transcurridos))
                    expira_dt = del_dt + timedelta(days=15)
                    expira_en = expira_dt.strftime('%Y-%m-%d')
                except Exception:
                    dias_restantes = 15

            item['dias_restantes'] = dias_restantes
            item['expira_en'] = expira_en
            items.append(item)

        return jsonify({
            "success": True,
            "items": items,
            "total": len(items)
        })
    finally:
        conn.close()


@app.route('/api/papelera/restaurar/<int:act_id>', methods=['POST', 'OPTIONS'])
def restaurar_actividad(act_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json(silent=True) or {}
    target_bitacora_id = data.get('target_bitacora_id')
    target_fecha = data.get('target_fecha')
    target_user_id = data.get('target_user_id')

    conn = get_db()
    cursor = conn.cursor()
    now_peru = get_peru_now_str()

    act = cursor.execute("SELECT * FROM actividades WHERE id = ?", (act_id,)).fetchone()
    if not act:
        conn.close()
        return jsonify({"error": "Actividad no encontrada"}), 404

    old_bitacora_id = act['bitacora_id']
    new_bitacora_id = old_bitacora_id

    if target_bitacora_id and target_bitacora_id != old_bitacora_id:
        target_b = cursor.execute("SELECT id FROM bitacoras WHERE id = ?", (target_bitacora_id,)).fetchone()
        if target_b:
            new_bitacora_id = target_bitacora_id
    elif target_fecha and target_user_id:
        existing_b = cursor.execute("SELECT id FROM bitacoras WHERE user_id = ? AND fecha = ?", (target_user_id, target_fecha)).fetchone()
        if existing_b:
            new_bitacora_id = existing_b['id']

    cursor.execute('''
        UPDATE actividades 
        SET is_deleted = 0, deleted_at = NULL, rollover_dismissed = 0, bitacora_id = ?, updated_at = ? 
        WHERE id = ?
    ''', (new_bitacora_id, now_peru, act_id))

    recalculate_bitacora_durations(cursor, old_bitacora_id, now_peru=now_peru)
    if new_bitacora_id != old_bitacora_id:
        recalculate_bitacora_durations(cursor, new_bitacora_id, now_peru=now_peru)

    conn.commit()

    restored_row = cursor.execute('''
        SELECT a.*, b.fecha as bitacora_fecha, b.colaborador as bitacora_colaborador
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE a.id = ?
    ''', (act_id,)).fetchone()

    users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
    formatted_act = format_actividad_dict(restored_row, users_map) if restored_row else dict(act)

    conn.close()

    return jsonify({
        "success": True,
        "message": "Actividad restaurada exitosamente",
        "id": act_id,
        "actividad": formatted_act,
        "bitacora_id": new_bitacora_id,
        "bitacora_fecha": restored_row['bitacora_fecha'] if restored_row else None
    })


@app.route('/api/papelera/eliminar/<int:act_id>', methods=['DELETE', 'OPTIONS'])
def eliminar_definitivo_actividad(act_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    mark_lineage_rollover_dismissed(cursor, [act_id])
    relink_children_before_delete(cursor, [act_id])
    cursor.execute("DELETE FROM actividades WHERE id = ?", (act_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Actividad eliminada definitivamente"})


@app.route('/api/papelera/vaciar', methods=['POST', 'OPTIONS'])
def vaciar_papelera():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json() or {}
    current_u = getattr(g, 'current_user', None) or {}
    user_role = current_u.get('role', 'analista')
    current_uid = current_u.get('id')

    conn = get_db()
    cursor = conn.cursor()

    if user_role == 'admin' and (data.get('all') or data.get('role') == 'admin') and not data.get('target_user_id'):
        del_ids = [r[0] for r in cursor.execute("SELECT id FROM actividades WHERE is_deleted = 1").fetchall()]
        if del_ids:
            mark_lineage_rollover_dismissed(cursor, del_ids)
            relink_children_before_delete(cursor, del_ids)
        cursor.execute("DELETE FROM actividades WHERE is_deleted = 1")
    else:
        target_uid = data.get('target_user_id') if (user_role == 'admin' and data.get('target_user_id')) else current_uid
        if target_uid:
            del_ids = [
                r[0]
                for r in cursor.execute('''
                    SELECT id FROM actividades 
                    WHERE is_deleted = 1 AND bitacora_id IN (
                        SELECT id FROM bitacoras WHERE user_id = ? OR colaborador = (SELECT full_name FROM users WHERE id = ?)
                    )
                ''', (target_uid, target_uid)).fetchall()
            ]
            if del_ids:
                mark_lineage_rollover_dismissed(cursor, del_ids)
                relink_children_before_delete(cursor, del_ids)
            cursor.execute('''
                DELETE FROM actividades 
                WHERE is_deleted = 1 AND bitacora_id IN (
                    SELECT id FROM bitacoras WHERE user_id = ? OR colaborador = (SELECT full_name FROM users WHERE id = ?)
                )
            ''', (target_uid, target_uid))

    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Papelera vaciada correctamente"})


@app.route('/api/actividades/<int:act_id>/eliminar', methods=['POST', 'DELETE', 'OPTIONS'])
def soft_delete_actividad(act_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    act = cursor.execute('''
        SELECT a.bitacora_id, b.fecha AS bitacora_fecha
        FROM actividades a
        LEFT JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE a.id = ?
    ''', (act_id,)).fetchone()
    if not act:
        conn.close()
        return jsonify({"error": "Actividad no encontrada"}), 404

    now_peru = get_peru_now_str()
    mark_lineage_rollover_dismissed(cursor, [act_id])
    cursor.execute("UPDATE actividades SET is_deleted = 1, deleted_at = ? WHERE id = ?", (now_peru, act_id))

    primary_b_id = act['bitacora_id']
    if primary_b_id:
        recalculate_bitacora_durations(cursor, primary_b_id, now_peru=now_peru)

    conn.commit()
    b_info = cursor.execute("SELECT tiempo_total_min FROM bitacoras WHERE id = ?", (primary_b_id,)).fetchone() if primary_b_id else None
    enriched_acts = fetch_enriched_bitacora_activities(cursor, primary_b_id, fecha=act['bitacora_fecha']) if primary_b_id else []
    conn.close()
    return jsonify({
        "success": True,
        "message": "Actividad movida a la papelera (retención 15 días)",
        "bitacora_actividades": enriched_acts,
        "tiempo_total_min": b_info['tiempo_total_min'] if b_info else 0,
    })


# ==================== CRON ROLLOVER & TASK LIFECYCLE ====================

def execute_daily_rollover(today_str=None):
    """
    Motor automático de medianoche (00:00) y catch-up:
    1. Cierra automáticamente bitácoras de días anteriores que quedaron abiertas ('cerrada_sistema').
    2. Identifica actividades no completadas ('pendiente', 'en_proceso', 'en_revision') o modificadas
       y las transfiere a la jornada de hoy con duracion_min = 0 para no duplicar horas.
    3. Auto-purga actividades en papelera que tengan más de 15 días.
    """
    if not today_str:
        today_str = get_peru_today_str()

    conn = get_db()
    cursor = conn.cursor()
    closed_count = 0
    rolled_count = 0
    now_peru = get_peru_now_str()

    try:
        purge_threshold = (get_peru_now() - timedelta(days=15)).strftime('%Y-%m-%d %H:%M:%S')
        expired_ids = [
            r[0]
            for r in cursor.execute(
                "SELECT id FROM actividades WHERE is_deleted = 1 AND deleted_at < ?",
                (purge_threshold,),
            ).fetchall()
        ]
        if expired_ids:
            mark_lineage_rollover_dismissed(cursor, expired_ids)
            relink_children_before_delete(cursor, expired_ids)
        cursor.execute("DELETE FROM actividades WHERE is_deleted = 1 AND deleted_at < ?", (purge_threshold,))

        past_open = cursor.execute('''
            SELECT id, user_id, colaborador, fecha, pendientes
            FROM bitacoras
            WHERE fecha < ? AND estado NOT IN ('cerrada', 'cerrada_sistema')
        ''', (today_str,)).fetchall()

        for b in past_open:
            dur = cursor.execute(
                "SELECT COALESCE(SUM(duracion_min), 0) FROM actividades WHERE bitacora_id = ? AND (is_deleted IS NULL OR a_del = 0)".replace('a_del', 'is_deleted'),
                (b['id'],)
            ).fetchone()[0]
            incomp = cursor.execute(
                "SELECT descripcion FROM actividades WHERE bitacora_id = ? AND estado != 'completada' AND (is_deleted IS NULL OR is_deleted = 0)",
                (b['id'],)
            ).fetchall()
            auto_pend = b['pendientes']
            if not auto_pend or len(auto_pend.strip()) == 0:
                if incomp:
                    auto_pend = "Pendientes al cierre: " + "; ".join(r['descripcion'] for r in incomp[:3])
                else:
                    auto_pend = "Todas las actividades fueron concluidas en esta fecha."

            cursor.execute('''
                UPDATE bitacoras SET
                    estado = 'cerrada_sistema',
                    tiempo_total_min = ?,
                    pendientes = ?,
                    updated_at = ?
                WHERE id = ?
            ''', (dur, auto_pend, now_peru, b['id']))
            closed_count += 1

        if is_dia_laborable(today_str):
            active_users = cursor.execute("SELECT id, full_name FROM users WHERE is_active = 1").fetchall()
            for u in active_users:
                rolled_count += rollover_user_open_tasks(cursor, u['id'], u['full_name'], today_str, now_peru)

        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.exception("[Rollover] Error en execute_daily_rollover: %s", e)
    finally:
        conn.close()

    return {
        "success": True,
        "date": today_str,
        "closed_bitacoras": closed_count,
        "rolled_activities": rolled_count
    }


@app.route('/api/cron/rollover', methods=['GET', 'POST', 'OPTIONS'])
def trigger_rollover():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    date_arg = request.args.get('date') or (request.get_json(silent=True) or {}).get('target_fecha')
    today = get_peru_today_str()
    if date_arg:
        try:
            datetime.strptime(date_arg, '%Y-%m-%d')
        except ValueError:
            return jsonify({"error": "Formato de fecha inválido (YYYY-MM-DD)"}), 400
        if date_arg > today:
            return jsonify({"error": "No se puede ejecutar el cierre para una fecha futura"}), 400
    res = execute_daily_rollover(today_str=date_arg or today)
    return jsonify(res)


@app.route('/api/actividades/importar-pendientes', methods=['POST', 'OPTIONS'])
def importar_actividades_pendientes():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.get_json() or {}
    colaborador = data.get('colaborador')
    user_id = data.get('user_id')
    target_fecha = data.get('target_fecha') or get_peru_today_str()

    if not colaborador:
        return jsonify({"error": "Colaborador es requerido"}), 400

    conn = get_db()
    cursor = conn.cursor()

    query = '''
        SELECT a.*, b.fecha as fecha_origen,
          COALESCE((
            WITH RECURSIVE lineage(id, parent_task_id, duracion_min, depth) AS (
              SELECT id, parent_task_id, duracion_min, 1 FROM actividades WHERE id = a.id
              UNION ALL
              SELECT prev.id, prev.parent_task_id, prev.duracion_min, l.depth + 1
              FROM actividades prev
              JOIN lineage l ON prev.id = l.parent_task_id
              WHERE l.depth < 15 AND prev.id != l.id AND prev.parent_task_id != prev.id
            )
            SELECT SUM(duracion_min) FROM lineage
          ), a.duracion_min) AS tiempo_acumulado_min
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE (b.user_id = ? OR LOWER(TRIM(b.colaborador)) = LOWER(TRIM(?)))
          AND b.fecha < ?
          AND a.estado != 'completada'
          AND (a.is_deleted IS NULL OR a.is_deleted = 0)
          AND COALESCE(a.rollover_dismissed, 0) = 0
          AND NOT EXISTS (
            SELECT 1 FROM actividades a_child
            JOIN bitacoras b_child ON a_child.bitacora_id = b_child.id
            WHERE a_child.parent_task_id = a.id
              AND COALESCE(a_child.tipo_vinculo, 'continuacion') IN ('', 'continuacion')
              AND b_child.fecha > b.fecha
          )
        ORDER BY a.id ASC
    '''
    tasks = cursor.execute(query, (user_id, colaborador, target_fecha)).fetchall()
    conn.close()

    return jsonify({
        "success": True,
        "pendientes": [format_actividad_dict(t) for t in tasks],
        "count": len(tasks)
    })


# ==================== ACTIVIDADES REFERENCIAS / VÍNCULOS ====================

@app.route('/api/actividades/referencias', methods=['GET', 'OPTIONS'])
def get_actividades_referencias():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    user_id = request.args.get('user_id')
    colaborador = request.args.get('colaborador')
    q = request.args.get('q', '').strip()
    current_u = getattr(g, 'current_user', None) or {}

    conn = get_db()
    cursor = conn.cursor()

    query = '''
        SELECT a.id, a.orden, a.hora_inicio, a.duracion_min, a.tipo_trabajo, a.descripcion,
               a.para_cliente, a.estado, b.fecha as bitacora_fecha, b.colaborador
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE (a.is_deleted IS NULL OR a.is_deleted = 0)
    '''
    params = []

    if current_u.get('role') in ('analista', 'operador'):
        query += " AND (b.user_id = ? OR LOWER(b.colaborador) = LOWER(?) OR b.user_id IN (SELECT target_user_id FROM user_delegations WHERE delegate_user_id = ? AND is_active = 1))"
        params.extend([current_u['id'], current_u.get('full_name', ''), current_u['id']])
    elif current_u.get('role') == 'lider':
        leader_teams = [r['id'] for r in cursor.execute("SELECT id FROM teams WHERE lider_id = ? OR id = ?", (current_u['id'], current_u.get('team_id'))).fetchall()]
        if leader_teams:
            placeholders = ','.join(['?'] * len(leader_teams))
            query += f" AND (b.user_id IN (SELECT id FROM users WHERE team_id IN ({placeholders})) OR b.user_id = ?)"
            params.extend(leader_teams + [current_u['id']])

    if user_id:
        query += " AND (b.user_id = ? OR LOWER(b.colaborador) = LOWER(?))"
        params.extend([user_id, colaborador or ''])
    elif colaborador:
        query += " AND LOWER(b.colaborador) = LOWER(?)"
        params.append(colaborador)

    if q:
        query += " AND (a.descripcion LIKE ? OR a.para_cliente LIKE ? OR a.tipo_trabajo LIKE ?)"
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])

    query += " ORDER BY b.fecha DESC, a.orden ASC, a.id DESC LIMIT 80"
    rows = cursor.execute(query, params).fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows]), 200


LAST_ROLLOVER_DATE = None
rollover_lock = threading.Lock()


def ensure_daily_rollover(target_date=None, force=False):
    global LAST_ROLLOVER_DATE
    today_str = target_date or get_peru_today_str()
    if LAST_ROLLOVER_DATE == today_str and not force:
        return

    with rollover_lock:
        if LAST_ROLLOVER_DATE == today_str and not force:
            return

        try:
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('last_rollover_date', '', datetime('now'))")
            if force:
                cursor.execute("UPDATE system_settings SET value = ?, updated_at = datetime('now') WHERE key = 'last_rollover_date'", (today_str,))
                claimed = True
            else:
                cursor.execute(
                    "UPDATE system_settings SET value = ?, updated_at = datetime('now') WHERE key = 'last_rollover_date' AND COALESCE(value, '') < ?",
                    (today_str, today_str)
                )
                claimed = cursor.rowcount == 1
            conn.commit()
            LAST_ROLLOVER_DATE = today_str
            if not claimed:
                return
            logger.info("[Scheduler] Ejecutando rollover diario para %s", today_str)
            execute_daily_rollover(today_str)
        except Exception as e:
            logger.exception("[Scheduler] Error en ensure_daily_rollover: %s", e)


def start_midnight_scheduler():
    """Inicia el hilo en background para ejecutar el rollover nocturno periódicamente."""
    def run_scheduler():
        time.sleep(10)
        while True:
            try:
                ensure_daily_rollover()
            except Exception as e:
                logger.exception("[Scheduler] Error en ciclo periódico: %s", e)
            time.sleep(60)

    t = threading.Thread(target=run_scheduler, daemon=True)
    t.start()


def _init_db_serialized():
    """Ejecuta init_db con un candado de archivo para que los workers de Gunicorn no migren en paralelo."""
    lock_path = os.path.join(os.path.dirname(os.path.abspath(DB_PATH)), '.init.lock')
    try:
        import fcntl
    except ImportError:
        init_db()
        return
    with open(lock_path, 'w') as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            init_db()
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)


try:
    _init_db_serialized()
    if os.environ.get('BITACORA_DISABLE_SCHEDULER') != '1':
        start_midnight_scheduler()
except Exception as e:
    logger.exception("[Startup] Error inicializando DB o scheduler: %s", e)

if __name__ == '__main__':
    logger.info("Servidor de desarrollo de Bitácora en http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
