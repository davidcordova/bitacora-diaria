import os
import json
import base64
import sqlite3
import threading
import time
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from database import get_db, init_db, DB_PATH, get_peru_now, get_peru_now_str, get_peru_today_str

app = Flask(__name__)

UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# Helper para normalizar evidencias y tareas compartidas en el diccionario de una actividad
def format_actividad_dict(act_row, users_map=None):
    a_dict = dict(act_row)
    ev_val = a_dict.get('evidencias')
    if isinstance(ev_val, str):
        try:
            a_dict['evidencias'] = json.loads(ev_val)
        except Exception:
            a_dict['evidencias'] = []
    elif isinstance(ev_val, list):
        a_dict['evidencias'] = ev_val
    else:
        a_dict['evidencias'] = []

    sw_val = a_dict.get('shared_with')
    if isinstance(sw_val, str):
        try:
            a_dict['shared_with'] = json.loads(sw_val)
        except Exception:
            a_dict['shared_with'] = []
    elif isinstance(sw_val, list):
        a_dict['shared_with'] = sw_val
    else:
        a_dict['shared_with'] = []

    if users_map and isinstance(a_dict.get('shared_with'), list):
        a_dict['shared_with_names'] = [
            users_map[uid] for uid in a_dict['shared_with'] if uid in users_map
        ]
    return a_dict

# Configuración de CORS manual y limpia
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS,PATCH'
    return response

def get_default_hora_inicio():
    try:
        conn = get_db()
        row = conn.execute("SELECT value FROM system_settings WHERE key = 'hora_inicio_default'").fetchone()
        conn.close()
        if row and row['value']:
            return row['value']
    except Exception:
        pass
    return '08:30'

@app.route('/api/health', methods=['GET'])
def health_check():
    now_dt = get_peru_now()
    return jsonify({
        "status": "ok",
        "service": "Bitácora API",
        "version": "2.2.0",
        "peru_time": now_dt.strftime('%Y-%m-%d %H:%M:%S'),
        "peru_date": get_peru_today_str(),
        "timezone": "America/Lima (UTC-5)",
        "env_tz": os.environ.get('TZ', 'not_set')
    })


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

@app.route('/api/admin/diagnose-db', methods=['GET'])
def diagnose_db():
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        all_acts = [dict(r) for r in cursor.execute("""
            SELECT a.id, a.bitacora_id, a.descripcion, a.estado, a.is_deleted, a.deleted_at, a.created_at,
                   b.colaborador, b.fecha, b.user_id
            FROM actividades a
            LEFT JOIN bitacoras b ON a.bitacora_id = b.id
            ORDER BY a.id DESC
        """).fetchall()]
        
        all_b = [dict(r) for r in cursor.execute("SELECT * FROM bitacoras ORDER BY id DESC").fetchall()]
        tables = [r[0] for r in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        
        db_dir = os.path.dirname(os.path.abspath(DB_PATH))
        db_files = []
        try:
            db_files = [f for f in os.listdir(db_dir) if any(ext in f for ext in ['db', 'sqlite', 'wal', 'bak'])]
        except Exception:
            pass
            
        import re
        raw_matches = []
        for fname in ['bitacora.db', 'bitacora.db-wal']:
            fpath = os.path.join(db_dir, fname)
            if os.path.exists(fpath):
                try:
                    with open(fpath, 'rb') as fp:
                        raw_bytes = fp.read()
                    raw_strs = re.findall(b'[\x20-\x7E\xC0-\xFF]{6,}', raw_bytes)
                    for s in raw_strs:
                        try:
                            txt = s.decode('latin1')
                            if any(k in txt.lower() for k in ['masivo', 'rh', 'chamba', 'ayala', 'ticket', 'wifi', 'switch', 'vpn', 'incidente', 'odoo']):
                                raw_matches.append(f"[{fname}] {txt}")
                        except Exception:
                            pass
                except Exception as e:
                    raw_matches.append(f"Error reading {fname}: {str(e)}")

        conn.close()
        return jsonify({
            "db_path": DB_PATH,
            "db_files": db_files,
            "tables": tables,
            "total_actividades": len(all_acts),
            "actividades": all_acts,
            "bitacoras": all_b,
            "raw_matches_count": len(raw_matches),
            "raw_matches": list(set(raw_matches))[:200]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def cleanup_synthetic_historical_data():
    """
    Elimina bitácoras y actividades sintéticas/falsas inyectadas por scripts antiguos
    para la fecha 2026-09-23 creadas a las 19:40:16 UTC que confunden al usuario administrador.
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Eliminar actividades asociadas a bitácoras sintéticas del 2026-09-23 creadas a las 19:40 UTC
        cursor.execute("""
            DELETE FROM actividades 
            WHERE bitacora_id IN (
                SELECT id FROM bitacoras 
                WHERE fecha = '2026-09-23' AND created_at LIKE '2026-09-24 19:40:%'
            )
        """)
        
        # Eliminar las bitácoras sintéticas del 2026-09-23
        cursor.execute("""
            DELETE FROM bitacoras 
            WHERE fecha = '2026-09-23' AND created_at LIKE '2026-09-24 19:40:%'
        """)

        
        conn.commit()
        conn.close()
        print("[Cleanup] Bitácoras sintéticas del 2026-09-23 purgadas exitosamente.")
    except Exception as e:
        print("[Cleanup] Error en cleanup_synthetic_historical_data:", e)

@app.route('/api/admin/clean-synthetic-history', methods=['POST', 'GET', 'OPTIONS'])
def clean_synthetic_history_endpoint():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    cleanup_synthetic_historical_data()
    return jsonify({"success": True, "message": "Bitácoras sintéticas de prueba del 2026-09-23 purgadas correctamente."})

def fix_mock_data_jayala():
    """Limpia las actividades mock generadas por el script de sincronización para Josué Ayala y registra su actividad real 're rh masivo'"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        now_peru = get_peru_now_str()
        
        b_jayala = cursor.execute("""
            SELECT id FROM bitacoras 
            WHERE (user_id = 5 OR LOWER(colaborador) = 'josue ayala') AND fecha = '2026-09-24'
        """).fetchone()

        
        if b_jayala:
            b_id = b_jayala['id']
            # Desactivar actividades mock generadas automáticamente
            mock_descriptions = [
                'Test actividad de depuracion',
                'Implementación de optimizaciones en endpoints API REST y validaciones de carga.',
                'Pruebas integrales de flujo de bitácoras y resolución de inconsistencias de navegación.',
                'Revisión técnica de incidencias y sincronización con el equipo de soporte.',
                'Desarrollo de módulos interactivos de supervisión y gestión de estados de tareas.'
            ]
            for desc in mock_descriptions:
                cursor.execute("""
                    UPDATE actividades SET is_deleted = 1, deleted_at = ?
                    WHERE bitacora_id = ? AND descripcion = ? AND (is_deleted IS NULL OR is_deleted = 0)
                """, (now_peru, b_id, desc))
            
            exact_description = """Se agregó soporte para Carné de Extranjería (CE) como tipo de documento alternativo al DNI en el módulo RH Masivo (mkt_rh_management): nuevo campo "Tipo de Documento" en las líneas de importación, con validaciones diferenciadas (DNI exige 8 dígitos y validación RENIEC; CE exige 9 dígitos con validación manual). Se mantienen intactas las validaciones de correo, celular, provincia, cargo y fechas para ambos tipos.

Durante las pruebas en el sistema se detectaron y corrigieron 2 bugs relacionados:
- Una restricción dura del DNI rompía la carga completa del Excel cuando una fila tenía el documento mal formateado, dejando un mensaje de error pegado en la cabecera de la planilla aunque la fila ya estuviera corregida. Se eliminó, dejando solo la validación que marca la fila puntual en rojo sin bloquear el resto de la carga.
- La plantilla oficial de Excel tenía la columna N° Documento en formato numérico, por lo que Excel borraba los ceros a la izquierda de los Carné de Extranjería antes de guardarse. Se corrigió el formato de esa columna a Texto y se agregó un mensaje de error más claro para detectar este caso a futuro."""

            # Actualizar o insertar con la descripción exacta y fidedigna
            existing_real = cursor.execute("""
                SELECT id FROM actividades 
                WHERE bitacora_id = ? AND (LOWER(descripcion) LIKE '%rh masivo%' OR LOWER(descripcion) LIKE '%carné de extranjería%')
                ORDER BY id DESC LIMIT 1
            """, (b_id,)).fetchone()

            if existing_real:
                cursor.execute("""
                    UPDATE actividades SET 
                        descripcion = ?, duracion_min = 240, para_cliente = 'mkt_rh_management / RR.HH.',
                        tipo_trabajo = 'Desarrollo', estado = 'completada', is_deleted = 0, deleted_at = NULL,
                        updated_at = ?
                    WHERE id = ?
                """, (exact_description, now_peru, existing_real['id']))
            else:
                cursor.execute("""
                    INSERT INTO actividades (
                        bitacora_id, orden, hora_inicio, duracion_min,
                        tipo_trabajo, descripcion, para_cliente, estado, evidencias,
                        shared_with, created_at, updated_at
                    ) VALUES (
                        ?, 0, '08:30', 240,
                        'Desarrollo', ?, 'mkt_rh_management / RR.HH.', 'completada', '[]',
                        '[]', ?, ?
                    )
                """, (b_id, exact_description, now_peru, now_peru))
            
            cursor.execute("""
                UPDATE bitacoras SET tiempo_total_min = (
                    SELECT COALESCE(SUM(duracion_min), 0) FROM actividades WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
                ), updated_at = ? WHERE id = ?
            """, (b_id, now_peru, b_id))

            
            conn.commit()
        conn.close()
    except Exception as e:
        print("[Repair] Error in fix_mock_data_jayala:", e)

@app.route('/api/admin/repair-mock-jayala', methods=['POST', 'GET', 'OPTIONS'])
def repair_mock_jayala_endpoint():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    fix_mock_data_jayala()
    conn = get_db()
    cursor = conn.cursor()
    acts = cursor.execute("""
        SELECT a.* FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE (b.user_id = 5 OR LOWER(b.colaborador) = 'josue ayala') AND b.fecha = '2026-09-24' AND (a.is_deleted IS NULL OR a.is_deleted = 0)
    """).fetchall()
    conn.close()
    return jsonify({
        "success": True,
        "message": "Datos mock de Josué Ayala limpiados y actividad real 're rh masivo' registrada con éxito",
        "actividades": [dict(r) for r in acts]
    }), 200

@app.route('/api/admin/clean-production-data', methods=['POST', 'OPTIONS'])
def clean_production_data():
    """Purga todas las bitácoras, actividades y usuarios de prueba dejando el sistema limpio en producción con sólo el admin"""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE actividades SET parent_task_id = NULL")
        cursor.execute("UPDATE users SET team_id = NULL")
        cursor.execute("UPDATE teams SET lider_id = NULL")
        
        cursor.execute("DELETE FROM actividades")
        cursor.execute("DELETE FROM bitacoras")
        
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

@app.route('/api/upload', methods=['POST', 'OPTIONS'])
def upload_file():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    try:
        # Caso 1: Archivo enviado vía multipart/form-data (explorador o drag & drop)
        if 'file' in request.files:
            file = request.files['file']
            if not file or file.filename == '':
                return jsonify({"error": "No se seleccionó ningún archivo"}), 400
                
            orig_filename = secure_filename(file.filename) or 'archivo'
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_name = f"{timestamp}_{orig_filename}"
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

        # Caso 2: Imagen pegada como Base64 (capturas con Ctrl+V)
        data = request.get_json() or {}
        base64_data = data.get('base64')
        if base64_data:
            nombre = data.get('nombre') or 'captura_pantalla.png'
            safe_nombre = secure_filename(nombre) or 'captura.png'
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_name = f"{timestamp}_{safe_nombre}"
            filepath = os.path.join(UPLOAD_FOLDER, unique_name)
            
            if ',' in base64_data:
                header, base64_str = base64_data.split(',', 1)
                mime_type = header.split(';')[0].replace('data:', '') if 'data:' in header else 'image/png'
            else:
                base64_str = base64_data
                mime_type = 'image/png'
                
            binary_bytes = base64.b64decode(base64_str)
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
    return send_from_directory(UPLOAD_FOLDER, filename)

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
        
    conn = get_db()
    cursor = conn.cursor()
    user = cursor.execute('''
        SELECT u.id, u.username, u.email, u.password_hash, u.full_name, u.role, u.is_active, u.team_id,
               t.nombre as team_name, t.lider_id
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE LOWER(u.username) = ?
    ''', (username,)).fetchone()
    conn.close()
    
    if not user:
        return jsonify({"error": "Credenciales inválidas"}), 401
        
    if not user['is_active']:
        return jsonify({"error": "Usuario desactivado. Contacta al administrador"}), 403
        
    stored_hash = user['password_hash']
    # Comprobar contraseña con Werkzeug o fallback para desarrollo
    password_matches = False
    try:
        password_matches = check_password_hash(stored_hash, password)
    except Exception:
        password_matches = (stored_hash == password)
        
    if not password_matches and stored_hash == password:
        password_matches = True
        
    if not password_matches:
        return jsonify({"error": "Contraseña incorrecta"}), 401
        
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
        "is_leader": is_leader
    }
    
    return jsonify({
        "message": "Autenticación exitosa",
        "user": user_dict,
        "token": f"session-{user['id']}-{user['username']}"
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
        
    if not new_password or len(new_password) < 4:
        return jsonify({"error": "La nueva contraseña debe tener al menos 4 caracteres"}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    user = cursor.execute("SELECT id, username, password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
    
    if not user:
        conn.close()
        return jsonify({"error": "Usuario no encontrado"}), 404
        
    stored_hash = user['password_hash']
    # Si se envía contraseña actual, validarla
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
            
    new_hash = generate_password_hash(new_password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "message": "Contraseña actualizada exitosamente"
    }), 200

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
        
    # Si desea cambiar contraseña
    if new_password:
        if len(new_password) < 4:
            conn.close()
            return jsonify({"error": "La nueva contraseña debe tener al menos 4 caracteres"}), 400
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
            SET full_name = ?, email = ?, phone = ?, password_hash = ?
            WHERE id = ?
        """, (full_name, email, phone, new_hash, user_id))
    else:
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
    
    return jsonify({
        "success": True,
        "message": "Perfil actualizado correctamente",
        "user": dict(updated_u)
    }), 200

# ==================== USERS CRUD ====================

@app.route('/api/users', methods=['GET'])
def get_users_list():
    conn = get_db()
    users = conn.execute('''
        SELECT u.id, u.username, u.email, u.full_name, u.role, u.phone, u.team_id, u.is_active,
               t.nombre as team_name,
               CASE WHEN t.lider_id = u.id THEN 1 ELSE 0 END as is_team_leader
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.is_active = 1
        ORDER BY u.full_name ASC
    ''').fetchall()
    conn.close()
    return jsonify([dict(u) for u in users])

@app.route('/api/admin/users', methods=['GET', 'POST', 'OPTIONS'])
def admin_users():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        users = cursor.execute('''
            SELECT u.id, u.username, u.email, u.full_name, u.role, u.phone, u.team_id, u.is_active, u.created_at,
                   t.nombre as team_name,
                   CASE WHEN t.lider_id = u.id THEN 1 ELSE 0 END as is_team_leader
            FROM users u
            LEFT JOIN teams t ON u.team_id = t.id
            ORDER BY u.id ASC
        ''').fetchall()
        conn.close()
        return jsonify([dict(u) for u in users])
        
    elif request.method == 'POST':
        data = request.get_json() or {}
        username = (data.get('username') or '').strip().lower()
        full_name = (data.get('full_name') or '').strip()
        email = (data.get('email') or '').strip()
        phone = (data.get('phone') or '').strip()
        password = data.get('password') or '123456'
        role = data.get('role') or 'analista'
        team_id = data.get('team_id') or None
        
        if not username or not full_name:
            conn.close()
            return jsonify({"error": "Usuario y Nombre completo son requeridos"}), 400
            
        existing = cursor.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            conn.close()
            return jsonify({"error": f"El nombre de usuario '{username}' ya existe"}), 400
            
        p_hash = generate_password_hash(password)
        cursor.execute('''
            INSERT INTO users (username, email, phone, password_hash, full_name, role, team_id, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ''', (username, email, phone, p_hash, full_name, role, team_id))
        user_id = cursor.lastrowid
        conn.commit()
        
        new_u = cursor.execute("SELECT id, username, email, phone, full_name, role, team_id FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        return jsonify({"message": "Usuario creado con éxito", "user": dict(new_u)}), 201

@app.route('/api/admin/users/<int:user_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
def admin_user_detail(user_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'PUT':
        data = request.get_json() or {}
        raw_username = (data.get('username') or '').strip().lower()
        full_name = data.get('full_name')
        email = data.get('email')
        phone = data.get('phone')
        role = data.get('role')
        team_id = data.get('team_id')
        is_active = data.get('is_active', 1)
        password = data.get('password')
        
        current_u = cursor.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
        if not current_u:
            conn.close()
            return jsonify({"error": "Usuario no encontrado"}), 404
            
        target_username = current_u['username']
        if raw_username and raw_username != current_u['username'].lower():
            if current_u['username'] == 'admin':
                conn.close()
                return jsonify({"error": "No se puede renombrar el usuario de la cuenta root admin"}), 400
            # Validar que no exista otro con ese username
            dup = cursor.execute("SELECT id FROM users WHERE LOWER(username) = ? AND id != ?", (raw_username, user_id)).fetchone()
            if dup:
                conn.close()
                return jsonify({"error": f"El nombre de usuario '{raw_username}' ya está en uso por otro colaborador"}), 400
            target_username = raw_username

        if password and len(password.strip()) > 0:
            p_hash = generate_password_hash(password.strip())
            cursor.execute('''
                UPDATE users SET
                    username = ?,
                    full_name = COALESCE(?, full_name),
                    email = COALESCE(?, email),
                    phone = COALESCE(?, phone),
                    role = COALESCE(?, role),
                    team_id = ?,
                    is_active = ?,
                    password_hash = ?
                WHERE id = ?
            ''', (target_username, full_name, email, phone, role, team_id, is_active, p_hash, user_id))
        else:
            cursor.execute('''
                UPDATE users SET
                    username = ?,
                    full_name = COALESCE(?, full_name),
                    email = COALESCE(?, email),
                    phone = COALESCE(?, phone),
                    role = COALESCE(?, role),
                    team_id = ?,
                    is_active = ?
                WHERE id = ?
            ''', (target_username, full_name, email, phone, role, team_id, is_active, user_id))
            
        conn.commit()
        updated = cursor.execute("SELECT id, username, email, phone, full_name, role, team_id, is_active FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        return jsonify({"message": "Usuario actualizado con éxito", "user": dict(updated)})
        
    elif request.method == 'DELETE':
        if user_id == 1:
            conn.close()
            return jsonify({"error": "No se puede eliminar ni desactivar al Administrador Principal"}), 400
            
        permanent = request.args.get('permanent', 'false').lower() in ('true', '1', 'yes')
        mode = request.args.get('mode', '')
        if mode == 'permanent':
            permanent = True
            
        if permanent:
            try:
                # 1. Desvincular liderazgo en equipos
                cursor.execute("UPDATE teams SET lider_id = NULL WHERE lider_id = ?", (user_id,))
                # 2. Desvincular dependencias en actividades
                cursor.execute('''
                    UPDATE actividades SET parent_task_id = NULL 
                    WHERE bitacora_id IN (SELECT id FROM bitacoras WHERE user_id = ?)
                ''', (user_id,))
                # 3. Eliminar actividades y bitácoras asociadas
                cursor.execute('''
                    DELETE FROM actividades 
                    WHERE bitacora_id IN (SELECT id FROM bitacoras WHERE user_id = ?)
                ''', (user_id,))
                cursor.execute("DELETE FROM bitacoras WHERE user_id = ?", (user_id,))
                
                for tbl in ['tasks', 'audit_logs', 'notifications']:
                    try:
                        cursor.execute(f"DELETE FROM {tbl} WHERE user_id = ?", (user_id,))
                    except Exception:
                        pass
                        
                # 4. Eliminar el usuario definitivamente
                cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
                conn.commit()
                conn.close()
                return jsonify({"success": True, "message": "Usuario eliminado definitivamente del sistema"})
            except Exception as e:
                conn.rollback()
                conn.close()
                return jsonify({"error": f"Error al eliminar usuario: {str(e)}"}), 500
        else:
            # Alternar o desactivar
            curr = cursor.execute("SELECT is_active FROM users WHERE id = ?", (user_id,)).fetchone()
            if not curr:
                conn.close()
                return jsonify({"error": "Usuario no encontrado"}), 404
            new_active = 0 if curr['is_active'] == 1 else 1
            msg = "Usuario desactivado correctamente" if new_active == 0 else "Usuario reactivado correctamente"
            cursor.execute("UPDATE users SET is_active = ? WHERE id = ?", (new_active, user_id))
            conn.commit()
            conn.close()
            return jsonify({"success": True, "message": msg, "is_active": new_active})

# ==================== TEAMS CRUD ====================

@app.route('/api/admin/teams', methods=['GET', 'POST', 'OPTIONS'])
def admin_teams():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        teams = cursor.execute('''
            SELECT t.id, t.nombre, t.descripcion, t.lider_id, t.created_at,
                   u.full_name as lider_nombre, u.username as lider_username
            FROM teams t
            LEFT JOIN users u ON t.lider_id = u.id
            ORDER BY t.nombre ASC
        ''').fetchall()
        
        result = []
        for t in teams:
            t_dict = dict(t)
            members = cursor.execute('''
                SELECT id, username, full_name, role, email, phone
                FROM users
                WHERE team_id = ? AND is_active = 1
            ''', (t['id'],)).fetchall()
            t_dict['members'] = [dict(m) for m in members]
            t_dict['members_count'] = len(members)
            result.append(t_dict)
            
        conn.close()
        return jsonify(result)
        
    elif request.method == 'POST':
        data = request.get_json() or {}
        nombre = (data.get('nombre') or '').strip()
        descripcion = data.get('descripcion', '')
        lider_id = data.get('lider_id') or None
        
        if not nombre:
            conn.close()
            return jsonify({"error": "El nombre del equipo es requerido"}), 400
            
        cursor.execute('''
            INSERT INTO teams (nombre, descripcion, lider_id)
            VALUES (?, ?, ?)
        ''', (nombre, descripcion, lider_id))
        team_id = cursor.lastrowid
        
        # Si se asignó un líder, actualizar su rol a líder si no es admin
        if lider_id:
            cursor.execute('''
                UPDATE users SET team_id = ?, role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'lider' END
                WHERE id = ?
            ''', (team_id, lider_id))
            
        conn.commit()
        conn.close()
        return jsonify({"message": "Equipo creado con éxito", "team_id": team_id}), 201

@app.route('/api/admin/teams/<int:team_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
def admin_team_detail(team_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'PUT':
        data = request.get_json() or {}
        nombre = data.get('nombre')
        descripcion = data.get('descripcion')
        lider_id = data.get('lider_id')
        member_ids = data.get('member_ids') # opcional lista de IDs para asignar
        
        cursor.execute('''
            UPDATE teams SET
                nombre = COALESCE(?, nombre),
                descripcion = COALESCE(?, descripcion),
                lider_id = ?
            WHERE id = ?
        ''', (nombre, descripcion, lider_id, team_id))
        
        if lider_id:
            cursor.execute('''
                UPDATE users SET team_id = ?, role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'lider' END
                WHERE id = ?
            ''', (team_id, lider_id))
            
        if member_ids is not None and isinstance(member_ids, list):
            # Asignar miembros indicados a este equipo
            cursor.execute("UPDATE users SET team_id = NULL WHERE team_id = ?", (team_id,))
            if member_ids:
                placeholders = ','.join(['?'] * len(member_ids))
                cursor.execute(f"UPDATE users SET team_id = ? WHERE id IN ({placeholders})", [team_id] + member_ids)
                
        conn.commit()
        conn.close()
        return jsonify({"message": "Equipo actualizado correctamente"})
        
    elif request.method == 'DELETE':
        cursor.execute("UPDATE users SET team_id = NULL WHERE team_id = ?", (team_id,))
        cursor.execute("DELETE FROM teams WHERE id = ?", (team_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Equipo eliminado correctamente"})

# ==================== BITACORAS CRUD & TEAM SUPERVISION ====================

@app.route('/api/bitacoras', methods=['GET'])
def get_bitacoras():
    conn = get_db()
    cursor = conn.cursor()
    
    fecha = request.args.get('fecha')
    colaborador = request.args.get('colaborador')
    team_id = request.args.get('team_id')
    user_id = request.args.get('user_id')
    requesting_user_id = request.args.get('requesting_user_id')
    
    query = '''
        SELECT b.*, u.team_id, t.nombre as team_name
        FROM bitacoras b
        LEFT JOIN users u ON COALESCE(b.user_id, (SELECT id FROM users WHERE LOWER(full_name) = LOWER(b.colaborador) OR LOWER(username) = LOWER(b.colaborador) LIMIT 1)) = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE 1=1
    '''
    params = []
    
    # PRIVACIDAD ESTRICTA POR ROL:
    if requesting_user_id:
        req_u = cursor.execute("SELECT id, role, team_id, full_name, username FROM users WHERE id = ?", (requesting_user_id,)).fetchone()
        if req_u:
            r_role = req_u['role']
            if r_role in ('analista', 'operador'):
                # Los analistas/operadores SOLO pueden ver sus propias bitácoras
                query += " AND (b.user_id = ? OR LOWER(b.colaborador) = LOWER(?) OR LOWER(b.colaborador) = LOWER(?))"
                params.extend([req_u['id'], req_u['full_name'], req_u['username']])
            # Si es lider o admin, pueden ver todas las bitácoras o filtrar por team_id si se pasa como parámetro
    
    if fecha:
        query += " AND b.fecha = ?"
        params.append(fecha)
    if colaborador:
        query += " AND (b.colaborador LIKE ? OR u.username LIKE ?)"
        params.extend([f"%{colaborador}%", f"%{colaborador}%"])
    if team_id:
        query += " AND u.team_id = ?"
        params.append(team_id)
    if user_id:
        query += " AND (b.user_id = ? OR u.id = ?)"
        params.extend([user_id, user_id])
    if fecha:
        query += " ORDER BY b.fecha DESC, b.id DESC LIMIT 500"
    else:
        query += " ORDER BY b.fecha DESC, b.id DESC LIMIT 200"
    bitacoras = cursor.execute(query, params).fetchall()
    users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
    
    result = []
    for b in bitacoras:
        b_dict = dict(b)
        acts = cursor.execute('''
            SELECT a.*,
              COALESCE((
                WITH RECURSIVE lineage AS (
                  SELECT id, parent_task_id, duracion_min FROM actividades WHERE id = a.id
                  UNION ALL
                  SELECT prev.id, prev.parent_task_id, prev.duracion_min
                  FROM actividades prev
                  JOIN lineage l ON prev.id = l.parent_task_id
                )
                SELECT SUM(duracion_min) FROM lineage
              ), a.duracion_min) AS tiempo_acumulado_min
            FROM actividades a
            WHERE a.bitacora_id = ? AND (a.is_deleted IS NULL OR a.is_deleted = 0)
            ORDER BY a.orden ASC, a.id ASC
        ''', (b['id'],)).fetchall()
        b_dict['actividades'] = [format_actividad_dict(a, users_map) for a in acts]
        result.append(b_dict)
        
    conn.close()
    return jsonify(result)

@app.route('/api/bitacoras/<int:bitacora_id>', methods=['GET'])
def get_bitacora(bitacora_id):
    conn = get_db()
    cursor = conn.cursor()
    b = cursor.execute("SELECT * FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone()
    if not b:
        conn.close()
        return jsonify({"error": "Bitácora no encontrada"}), 404
        
    b_dict = dict(b)
    users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
    acts = cursor.execute('''
        SELECT a.*,
          COALESCE((
            WITH RECURSIVE lineage AS (
              SELECT id, parent_task_id, duracion_min FROM actividades WHERE id = a.id
              UNION ALL
              SELECT prev.id, prev.parent_task_id, prev.duracion_min
              FROM actividades prev
              JOIN lineage l ON prev.id = l.parent_task_id
            )
            SELECT SUM(duracion_min) FROM lineage
          ), a.duracion_min) AS tiempo_acumulado_min
        FROM actividades a
        WHERE a.bitacora_id = ? AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        ORDER BY a.orden ASC, a.id ASC
    ''', (bitacora_id,)).fetchall()
    b_dict['actividades'] = [format_actividad_dict(a, users_map) for a in acts]
    conn.close()
    return jsonify(b_dict)

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
    
    # Canonicalizar user_id y colaborador con la tabla users
    if not user_id:
        u_match = cursor.execute(
            "SELECT id, full_name FROM users WHERE LOWER(full_name) = LOWER(?) OR LOWER(username) = LOWER(?)",
            (colaborador, colaborador)
        ).fetchone()
        if u_match:
            user_id = u_match['id']
            colaborador = u_match['full_name']
    else:
        u_by_id = cursor.execute("SELECT id, full_name FROM users WHERE id = ?", (user_id,)).fetchone()
        if u_by_id:
            colaborador = u_by_id['full_name']

    try:
        now_peru = get_peru_now_str()
        actividades_data = data.get('actividades', [])
        tiempo_total = sum(int(a.get('duracion_min', 0) or 0) for a in actividades_data)
        bitacora_id = data.get('id')
        
        if bitacora_id:
            existing_b = cursor.execute("SELECT id FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone()
            if existing_b:
                cursor.execute('''
                    UPDATE bitacoras SET
                        user_id = COALESCE(?, user_id),
                        fecha = ?,
                        hora_inicio = ?,
                        colaborador = ?,
                        area = ?,
                        pendientes = ?,
                        necesita_apoyo = ?,
                        apoyo_detalle = ?,
                        prioridad_siguiente = ?,
                        tiempo_total_min = ?,
                        resumen_texto = ?,
                        estado = ?,
                        updated_at = ?
                    WHERE id = ?
                ''', (
                    user_id,
                    fecha,
                    data.get('hora_inicio', ''),
                    colaborador,
                    area,
                    data.get('pendientes', ''),
                    data.get('necesita_apoyo', 'No'),
                    data.get('apoyo_detalle', ''),
                    data.get('prioridad_siguiente', ''),
                    tiempo_total,
                    data.get('resumen_texto', ''),
                    data.get('estado', 'generada'),
                    now_peru,
                    bitacora_id
                ))
            else:
                bitacora_id = None

        if not bitacora_id:
            # Si ya existe una bitácora para este colaborador y fecha, actualizarla para no duplicar
            existing_by_date = cursor.execute(
                "SELECT id FROM bitacoras WHERE (user_id = ? OR LOWER(colaborador) = LOWER(?)) AND fecha = ?",
                (user_id, colaborador, fecha)
            ).fetchone()
            if existing_by_date:
                bitacora_id = existing_by_date['id']
                cursor.execute('''
                    UPDATE bitacoras SET
                        user_id = COALESCE(?, user_id),
                        hora_inicio = ?,
                        colaborador = ?,
                        area = ?,
                        pendientes = ?,
                        necesita_apoyo = ?,
                        apoyo_detalle = ?,
                        prioridad_siguiente = ?,
                        tiempo_total_min = ?,
                        resumen_texto = ?,
                        estado = ?,
                        updated_at = ?
                    WHERE id = ?
                ''', (
                    user_id,
                    data.get('hora_inicio', ''),
                    colaborador,
                    area,
                    data.get('pendientes', ''),
                    data.get('necesita_apoyo', 'No'),
                    data.get('apoyo_detalle', ''),
                    data.get('prioridad_siguiente', ''),
                    tiempo_total,
                    data.get('resumen_texto', ''),
                    data.get('estado', 'generada'),
                    now_peru,
                    bitacora_id
                ))
            else:
                cursor.execute('''
                    INSERT INTO bitacoras (
                        user_id, fecha, hora_inicio, colaborador, area, pendientes,
                        necesita_apoyo, apoyo_detalle, prioridad_siguiente,
                        tiempo_total_min, resumen_texto, estado, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    fecha,
                    data.get('hora_inicio', ''),
                    colaborador,
                    area,
                    data.get('pendientes', ''),
                    data.get('necesita_apoyo', 'No'),
                    data.get('apoyo_detalle', ''),
                    data.get('prioridad_siguiente', ''),
                    tiempo_total,
                    data.get('resumen_texto', ''),
                    data.get('estado', 'generada'),
                    now_peru,
                    now_peru
                ))
                bitacora_id = cursor.lastrowid


        # Mapeo de actividades previas para actualización quirúrgica (conserva IDs y evita duplicados al editar)
        existing_acts_list = [dict(r) for r in cursor.execute(
            "SELECT id, orden, hora_inicio, tipo_trabajo, descripcion, shared_uuid FROM actividades WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY orden ASC, id ASC",
            (bitacora_id,)
        ).fetchall()]
        existing_acts_by_id = {r['id']: r for r in existing_acts_list}
        kept_ids = set()
        matched_target_ids = {}

        # Fase 1: Coincidencia exacta por ID numérico en la base de datos
        for idx, act in enumerate(actividades_data):
            act_id = act.get('id')
            act_id_num = None
            try:
                act_id_num = int(act_id)
            except (ValueError, TypeError):
                pass
            if act_id_num and act_id_num in existing_acts_by_id and act_id_num not in kept_ids:
                matched_target_ids[idx] = act_id_num
                kept_ids.add(act_id_num)

        # Fase 2: Coincidencia por shared_uuid para actividades sincronizadas entre usuarios
        for idx, act in enumerate(actividades_data):
            if idx in matched_target_ids:
                continue
            shared_uuid = act.get('shared_uuid')
            if shared_uuid:
                for ex in existing_acts_list:
                    if ex['id'] not in kept_ids and ex.get('shared_uuid') == shared_uuid:
                        matched_target_ids[idx] = ex['id']
                        kept_ids.add(ex['id'])
                        break

        # Fase 3: Coincidencia por posición (orden) para actividades que vienen sin ID numérico (ej. borrador local o ediciones en vuelo)
        # Esto PREVIENE que una edición de actividad genere un duplicado y mande la original a la papelera
        for idx, act in enumerate(actividades_data):
            if idx in matched_target_ids:
                continue
            act_orden = act.get('orden', idx)
            for ex in existing_acts_list:
                if ex['id'] not in kept_ids and ex.get('orden') == act_orden:
                    matched_target_ids[idx] = ex['id']
                    kept_ids.add(ex['id'])
                    break

        # Fase 4: Si la cantidad de actividades es >= a las existentes, emparejar unassigned por índice
        unmatched_existing = [ex['id'] for ex in existing_acts_list if ex['id'] not in kept_ids]
        unmatched_incoming = [idx for idx in range(len(actividades_data)) if idx not in matched_target_ids]
        if len(actividades_data) >= len(existing_acts_list):
            for i, idx in enumerate(unmatched_incoming):
                if i < len(unmatched_existing):
                    target_id = unmatched_existing[i]
                    matched_target_ids[idx] = target_id
                    kept_ids.add(target_id)

        for idx, act in enumerate(actividades_data):
            evidencias_val = act.get('evidencias', [])
            evidencias_json = json.dumps(evidencias_val) if isinstance(evidencias_val, (list, dict)) else (evidencias_val or '[]')
            
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

            target_act_id = matched_target_ids.get(idx)

            if target_act_id:
                cursor.execute('''
                    UPDATE actividades SET
                        orden = ?, hora_inicio = ?, duracion_min = ?,
                        tipo_trabajo = ?, descripcion = ?, para_cliente = ?,
                        estado = ?, evidencias = ?, shared_with = ?,
                        shared_uuid = COALESCE(?, shared_uuid),
                        updated_at = ?
                    WHERE id = ?
                ''', (
                    idx,
                    act.get('hora_inicio', ''),
                    int(act.get('duracion_min', 0) or 0),
                    act.get('tipo_trabajo', ''),
                    act.get('descripcion', ''),
                    act.get('para_cliente', ''),
                    act.get('estado', 'completada'),
                    evidencias_json,
                    shared_with_json,
                    shared_uuid,
                    now_peru,
                    target_act_id
                ))
                kept_ids.add(target_act_id)
            else:
                cursor.execute('''
                    INSERT INTO actividades (
                        bitacora_id, orden, hora_inicio, duracion_min,
                        tipo_trabajo, descripcion, para_cliente, estado, evidencias,
                        shared_with, shared_uuid, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    bitacora_id,
                    idx,
                    act.get('hora_inicio', ''),
                    int(act.get('duracion_min', 0) or 0),
                    act.get('tipo_trabajo', ''),
                    act.get('descripcion', ''),
                    act.get('para_cliente', ''),
                    act.get('estado', 'completada'),
                    evidencias_json,
                    shared_with_json,
                    shared_uuid,
                    now_peru,
                    now_peru
                ))
                kept_ids.add(cursor.lastrowid)

            # Sincronización automática de tarea compartida en paralelo con el otro usuario
            if shared_with_val and shared_uuid:
                for target_uid in shared_with_val:
                    if target_uid != user_id:
                        target_u = cursor.execute("SELECT id, full_name FROM users WHERE id = ?", (target_uid,)).fetchone()
                        if target_u:
                            target_b = cursor.execute(
                                "SELECT id FROM bitacoras WHERE (user_id = ? OR LOWER(colaborador) = LOWER(?)) AND fecha = ?",
                                (target_u['id'], target_u['full_name'], fecha)
                            ).fetchone()
                            if not target_b:
                                cursor.execute('''
                                    INSERT INTO bitacoras (
                                        user_id, fecha, hora_inicio, colaborador, area,
                                        pendientes, necesita_apoyo, prioridad_siguiente,
                                        tiempo_total_min, estado, created_at, updated_at
                                    ) VALUES (?, ?, ?, ?, 'Sistemas', '', 'No', '', 0, 'generada', ?, ?)
                                ''', (target_u['id'], fecha, act.get('hora_inicio') or get_default_hora_inicio(), target_u['full_name'], now_peru, now_peru))
                                target_b_id = cursor.lastrowid
                            else:
                                target_b_id = target_b['id']

                            existing_sync_act = cursor.execute(
                                "SELECT id FROM actividades WHERE bitacora_id = ? AND shared_uuid = ?",
                                (target_b_id, shared_uuid)
                            ).fetchone()
                            
                            counterpart_shared = json.dumps([user_id])
                            
                            if existing_sync_act:
                                cursor.execute('''
                                    UPDATE actividades SET
                                        hora_inicio = ?,
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
                                    act.get('hora_inicio', ''),
                                    int(act.get('duracion_min', 0) or 0),
                                    act.get('tipo_trabajo', ''),
                                    act.get('descripcion', ''),
                                    act.get('para_cliente', ''),
                                    act.get('estado', 'en_proceso'),
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
                                        bitacora_id, orden, hora_inicio, duracion_min,
                                        tipo_trabajo, descripcion, para_cliente, estado,
                                        evidencias, shared_with, shared_uuid, created_at, updated_at
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                ''', (
                                    target_b_id,
                                    next_ord,
                                    act.get('hora_inicio', ''),
                                    int(act.get('duracion_min', 0) or 0),
                                    act.get('tipo_trabajo', ''),
                                    act.get('descripcion', ''),
                                    act.get('para_cliente', ''),
                                    act.get('estado', 'en_proceso'),
                                    evidencias_json,
                                    counterpart_shared,
                                    shared_uuid,
                                    now_peru,
                                    now_peru
                                ))
                                
                            # Recalcular el tiempo_total_min de la bitácora del colaborador
                            cursor.execute('''
                                UPDATE bitacoras SET tiempo_total_min = (
                                    SELECT COALESCE(SUM(duracion_min), 0) FROM actividades WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
                                ), updated_at = ? WHERE id = ?
                            ''', (now_peru, target_b_id, target_b_id))

        # Safeguard de integridad: si vienen 0 actividades pero la bitácora ya tenía actividades previas,
        # NO borrarlas todas a menos que venga explícitamente confirm_empty=True
        # Esto previene pérdida accidental de datos por fallas de red, debounce o cambios rápidos de fecha
        if len(actividades_data) == 0 and len(existing_acts_by_id) > 0 and not data.get('confirm_empty'):
            kept_ids = set(existing_acts_by_id.keys())

        # Mover a papelera únicamente actividades removidas conscientemente por el usuario
        for old_id in existing_acts_by_id:
            if old_id not in kept_ids:
                cursor.execute("UPDATE actividades SET parent_task_id = NULL WHERE parent_task_id = ?", (old_id,))
                cursor.execute("UPDATE actividades SET is_deleted = 1, deleted_at = ? WHERE id = ?", (now_peru, old_id))


        conn.commit()
        
        users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
        b = cursor.execute("SELECT * FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone()
        b_dict = dict(b)
        acts = cursor.execute("SELECT * FROM actividades WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0) ORDER BY orden ASC, id ASC", (bitacora_id,)).fetchall()
        b_dict['actividades'] = [format_actividad_dict(a, users_map) for a in acts]
        
        conn.close()
        return jsonify({"message": "Bitácora guardada con éxito", "bitacora": b_dict}), 200
        
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
    act = cursor.execute("SELECT shared_uuid FROM actividades WHERE id = ?", (act_id,)).fetchone()
    if act and act['shared_uuid']:
        cursor.execute("UPDATE actividades SET estado = ?, updated_at = ? WHERE shared_uuid = ?", (nuevo_estado, now_peru, act['shared_uuid']))
    else:
        cursor.execute("UPDATE actividades SET estado = ?, updated_at = ? WHERE id = ?", (nuevo_estado, now_peru, act_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "id": act_id, "nuevo_estado": nuevo_estado})

@app.route('/api/actividades/<int:act_id>', methods=['PUT', 'OPTIONS'])
def update_actividad_detalle(act_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.get_json() or {}
    
    evidencias_json = None
    if 'evidencias' in data:
        ev_val = data['evidencias']
        evidencias_json = json.dumps(ev_val) if isinstance(ev_val, (list, dict)) else str(ev_val)
        
    conn = get_db()
    cursor = conn.cursor()
    now_peru = get_peru_now_str()
    act = cursor.execute("SELECT shared_uuid FROM actividades WHERE id = ?", (act_id,)).fetchone()
    
    shared_with_val = data.get('shared_with')
    shared_with_json = json.dumps(shared_with_val) if isinstance(shared_with_val, list) else None

    if act and act['shared_uuid']:
        cursor.execute('''
            UPDATE actividades SET
                hora_inicio = COALESCE(?, hora_inicio),
                duracion_min = COALESCE(?, duracion_min),
                tipo_trabajo = COALESCE(?, tipo_trabajo),
                descripcion = COALESCE(?, descripcion),
                para_cliente = COALESCE(?, para_cliente),
                estado = COALESCE(?, estado),
                evidencias = COALESCE(?, evidencias),
                shared_with = COALESCE(?, shared_with),
                updated_at = ?
            WHERE shared_uuid = ?
        ''', (
            data.get('hora_inicio'),
            data.get('duracion_min'),
            data.get('tipo_trabajo'),
            data.get('descripcion'),
            data.get('para_cliente'),
            data.get('estado'),
            evidencias_json,
            shared_with_json,
            now_peru,
            act['shared_uuid']
        ))
    else:
        cursor.execute('''
            UPDATE actividades SET
                hora_inicio = COALESCE(?, hora_inicio),
                duracion_min = COALESCE(?, duracion_min),
                tipo_trabajo = COALESCE(?, tipo_trabajo),
                descripcion = COALESCE(?, descripcion),
                para_cliente = COALESCE(?, para_cliente),
                estado = COALESCE(?, estado),
                evidencias = COALESCE(?, evidencias),
                shared_with = COALESCE(?, shared_with),
                updated_at = ?
            WHERE id = ?
        ''', (
            data.get('hora_inicio'),
            data.get('duracion_min'),
            data.get('tipo_trabajo'),
            data.get('descripcion'),
            data.get('para_cliente'),
            data.get('estado'),
            evidencias_json,
            shared_with_json,
            now_peru,
            act_id
        ))
        
    conn.commit()
    users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
    updated_act = cursor.execute("SELECT * FROM actividades WHERE id = ?", (act_id,)).fetchone()
    conn.close()
    return jsonify({"success": True, "actividad": format_actividad_dict(updated_act, users_map) if updated_act else None})


@app.route('/api/actividades/pendientes', methods=['GET'])
def get_actividades_pendientes():
    colaborador = request.args.get('colaborador')
    user_id = request.args.get('user_id')
    
    conn = get_db()
    cursor = conn.cursor()
    
    query = '''
        SELECT a.*, b.fecha, b.colaborador
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE a.estado != 'completada' AND (a.is_deleted IS NULL OR a.is_deleted = 0)
    '''
    params = []
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

@app.route('/api/bitacoras/<int:bitacora_id>', methods=['DELETE', 'OPTIONS'])
def delete_bitacora(bitacora_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    conn = get_db()
    cursor = conn.cursor()
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
    cursor = conn.cursor()
    
    # Auto-purga de actividades con más de 15 días en papelera
    cursor.execute("DELETE FROM actividades WHERE is_deleted = 1 AND deleted_at < datetime('now', '-15 days')")
    
    # Auto-purga de duplicados en papelera generados accidentalmente por ediciones previas
    cursor.execute('''
        DELETE FROM actividades 
        WHERE is_deleted = 1 
          AND id IN (
              SELECT a_del.id
              FROM actividades a_del
              JOIN actividades a_act ON a_del.bitacora_id = a_act.bitacora_id 
                  AND TRIM(LOWER(a_del.descripcion)) = TRIM(LOWER(a_act.descripcion))
                  AND (a_act.is_deleted IS NULL OR a_act.is_deleted = 0)
              WHERE a_del.is_deleted = 1
          )
    ''')
    conn.commit()
    
    user_id = request.args.get('user_id')
    requesting_user_id = request.args.get('requesting_user_id')
    
    query = '''
        SELECT a.*, b.fecha as bitacora_fecha, b.colaborador as bitacora_colaborador, b.user_id as bitacora_user_id,
               u.team_id, t.nombre as team_name
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        LEFT JOIN users u ON COALESCE(b.user_id, (SELECT id FROM users WHERE LOWER(full_name) = LOWER(b.colaborador) OR LOWER(username) = LOWER(b.colaborador) LIMIT 1)) = u.id
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
            # Admin y líderes pueden supervisar la papelera del equipo
    elif user_id:
        query += " AND (b.user_id = ? OR u.id = ?)"
        params.extend([user_id, user_id])
        
    query += " ORDER BY a.deleted_at DESC, a.id DESC"
    deleted_rows = cursor.execute(query, params).fetchall()
    users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
    
    items = []
    now_utc = datetime.utcnow()

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
        
    conn.close()
    return jsonify({
        "success": True,
        "items": items,
        "total": len(items)
    })

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

    # Si se especificó una bitácora destino puntual
    if target_bitacora_id and target_bitacora_id != old_bitacora_id:
        target_b = cursor.execute("SELECT id FROM bitacoras WHERE id = ?", (target_bitacora_id,)).fetchone()
        if target_b:
            new_bitacora_id = target_bitacora_id
    # O si se especificó una fecha destino (ej. hoy) para un usuario
    elif target_fecha and target_user_id:
        existing_b = cursor.execute("SELECT id FROM bitacoras WHERE user_id = ? AND fecha = ?", (target_user_id, target_fecha)).fetchone()
        if existing_b:
            new_bitacora_id = existing_b['id']

    # Restaurar actividad
    cursor.execute('''
        UPDATE actividades 
        SET is_deleted = 0, deleted_at = NULL, bitacora_id = ?, updated_at = ? 
        WHERE id = ?
    ''', (new_bitacora_id, now_peru, act_id))
    
    # Recalcular tiempo total de la bitácora antigua
    cursor.execute('''
        UPDATE bitacoras SET tiempo_total_min = (
            SELECT COALESCE(SUM(duracion_min), 0) FROM actividades 
            WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
        ), updated_at = ? WHERE id = ?
    ''', (old_bitacora_id, now_peru, old_bitacora_id))

    # Si cambió de bitácora, recalcular también la nueva
    if new_bitacora_id != old_bitacora_id:
        cursor.execute('''
            UPDATE bitacoras SET tiempo_total_min = (
                SELECT COALESCE(SUM(duracion_min), 0) FROM actividades 
                WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
            ), updated_at = ? WHERE id = ?
        ''', (new_bitacora_id, now_peru, new_bitacora_id))
    
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
    cursor.execute("UPDATE actividades SET parent_task_id = NULL WHERE parent_task_id = ?", (act_id,))
    cursor.execute("DELETE FROM actividades WHERE id = ?", (act_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": "Actividad eliminada definitivamente"})

@app.route('/api/papelera/vaciar', methods=['POST', 'OPTIONS'])
def vaciar_papelera():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    data = request.get_json() or {}
    user_id = data.get('user_id')
    role = data.get('role')
    
    conn = get_db()
    cursor = conn.cursor()
    
    if role == 'admin' and not user_id:
        cursor.execute("DELETE FROM actividades WHERE is_deleted = 1")
    elif user_id:
        cursor.execute('''
            DELETE FROM actividades 
            WHERE is_deleted = 1 AND bitacora_id IN (
                SELECT id FROM bitacoras WHERE user_id = ? OR colaborador = (SELECT full_name FROM users WHERE id = ?)
            )
        ''', (user_id, user_id))
    else:
        cursor.execute("DELETE FROM actividades WHERE is_deleted = 1")
        
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Papelera vaciada correctamente"})

@app.route('/api/actividades/<int:act_id>/eliminar', methods=['POST', 'DELETE', 'OPTIONS'])
def soft_delete_actividad(act_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    conn = get_db()
    cursor = conn.cursor()
    act = cursor.execute("SELECT bitacora_id FROM actividades WHERE id = ?", (act_id,)).fetchone()
    if not act:
        conn.close()
        return jsonify({"error": "Actividad no encontrada"}), 404
        
    now_peru = get_peru_now_str()
    cursor.execute("UPDATE actividades SET is_deleted = 1, deleted_at = ? WHERE id = ?", (now_peru, act_id))
    
    # Recalcular tiempo_total_min
    cursor.execute('''
        UPDATE bitacoras SET tiempo_total_min = (
            SELECT COALESCE(SUM(duracion_min), 0) FROM actividades 
            WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
        ), updated_at = ? WHERE id = ?
    ''', (act['bitacora_id'], now_peru, act['bitacora_id']))

    
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Actividad movida a la papelera (retención 15 días)"})

# ==================== SUPERVISIÓN EN VIVO: FEED DE EQUIPO ====================

@app.route('/api/equipo/actividades-en-vivo', methods=['GET', 'OPTIONS'])
def get_equipo_actividades_en_vivo():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    conn = get_db()
    cursor = conn.cursor()
    
    fecha = request.args.get('fecha') or get_peru_today_str()
    requesting_user_id = request.args.get('requesting_user_id')
    team_id = request.args.get('team_id')
    
    query = '''
        SELECT a.*, b.fecha as bitacora_fecha, b.colaborador, b.user_id, b.area,
               b.necesita_apoyo, b.apoyo_detalle,
               u.team_id, t.nombre as team_name, u.full_name as user_full_name, u.phone as colaborador_phone
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        LEFT JOIN users u ON COALESCE(b.user_id, (SELECT id FROM users WHERE LOWER(full_name) = LOWER(b.colaborador) OR LOWER(username) = LOWER(b.colaborador) LIMIT 1)) = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE b.fecha = ? AND (a.is_deleted IS NULL OR a.is_deleted = 0)
    '''
    params = [fecha]
    
    if requesting_user_id:
        req_u = cursor.execute("SELECT id, role, team_id, full_name, username FROM users WHERE id = ?", (requesting_user_id,)).fetchone()
        if req_u:
            if req_u['role'] in ('analista', 'operador'):
                query += " AND (b.user_id = ? OR LOWER(b.colaborador) = LOWER(?) OR LOWER(b.colaborador) = LOWER(?))"
                params.extend([req_u['id'], req_u['full_name'], req_u['username']])
            # Admin y líderes pueden ver las actividades de todo el equipo o filtrar por team_id
                    
    if team_id and team_id != 'all':
        query += " AND u.team_id = ?"
        params.append(team_id)
        
    query += " ORDER BY a.updated_at DESC, a.id DESC"
    rows = cursor.execute(query, params).fetchall()
    users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
    
    feed = [format_actividad_dict(r, users_map) for r in rows]
    conn.close()
    
    return jsonify({
        "success": True,
        "fecha": fecha,
        "total": len(feed),
        "actividades": feed
    })

# ==================== DASHBOARD & ANALYTICS ====================

@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    team_id = request.args.get('team_id')
    user_id = request.args.get('user_id')
    fecha = request.args.get('fecha')
    requesting_user_id = request.args.get('requesting_user_id')
    
    conn = get_db()
    cursor = conn.cursor()

    # Validación de privacidad por rol
    if requesting_user_id:
        req_u = cursor.execute("SELECT id, role, team_id FROM users WHERE id = ?", (requesting_user_id,)).fetchone()
        if req_u:
            if req_u['role'] in ('analista', 'operador'):
                user_id = req_u['id']
            elif req_u['role'] == 'lider':
                if req_u['team_id'] and not team_id:
                    team_id = req_u['team_id']
    
    base_filter = "WHERE 1=1"
    params = []
    
    if team_id:
        base_filter += " AND u.team_id = ?"
        params.append(team_id)
    if user_id:
        base_filter += " AND (b.user_id = ? OR u.id = ?)"
        params.extend([user_id, user_id])
    if fecha:
        base_filter += " AND b.fecha = ?"
        params.append(fecha)
        
    # 1. Totales generales
    total_query = f'''
        SELECT COUNT(DISTINCT b.id) as total_bitacoras,
               COALESCE(SUM(b.tiempo_total_min), 0) as total_minutos,
               COUNT(DISTINCT b.colaborador) as total_colaboradores
        FROM bitacoras b
        LEFT JOIN users u ON COALESCE(b.user_id, (SELECT id FROM users WHERE full_name = b.colaborador LIMIT 1)) = u.id
        {base_filter}
    '''
    totales = cursor.execute(total_query, params).fetchone()
    
    # 2. Desglose de actividades por estado
    act_filter_query = f'''
        SELECT a.estado, COUNT(a.id) as cantidad, COALESCE(SUM(a.duracion_min), 0) as minutos
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        LEFT JOIN users u ON COALESCE(b.user_id, (SELECT id FROM users WHERE full_name = b.colaborador LIMIT 1)) = u.id
        {base_filter} AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        GROUP BY a.estado
    '''
    act_stats = cursor.execute(act_filter_query, params).fetchall()
    
    # 3. Desglose por tipo de trabajo
    tipo_query = f'''
        SELECT COALESCE(NULLIF(a.tipo_trabajo, ''), 'No clasificado') as tipo,
               COUNT(a.id) as cantidad,
               COALESCE(SUM(a.duracion_min), 0) as minutos
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        LEFT JOIN users u ON COALESCE(b.user_id, (SELECT id FROM users WHERE full_name = b.colaborador LIMIT 1)) = u.id
        {base_filter} AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        GROUP BY tipo
        ORDER BY minutos DESC
    '''
    tipo_stats = cursor.execute(tipo_query, params).fetchall()
    
    # 4. Desglose por colaborador (calcula duración real desde actividades y evita inflación cartesiana)
    colab_query = f'''
        SELECT b.colaborador,
               u.id as user_id,
               u.team_id,
               t.nombre as team_name,
               COUNT(DISTINCT b.id) as bitacoras_count,
               COALESCE(SUM(a.duracion_min), 0) as total_minutos,
               COUNT(a.id) as total_actividades,
               SUM(CASE WHEN a.estado = 'completada' THEN 1 ELSE 0 END) as actividades_completadas
        FROM bitacoras b
        LEFT JOIN users u ON COALESCE(b.user_id, (SELECT id FROM users WHERE full_name = b.colaborador LIMIT 1)) = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        LEFT JOIN actividades a ON a.bitacora_id = b.id AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        {base_filter}
        GROUP BY b.colaborador
        ORDER BY total_minutos DESC
    '''
    colab_stats = cursor.execute(colab_query, params).fetchall()
    
    # 5. Colaboradores que requieren apoyo / bloqueos activos
    apoyo_query = f'''
        SELECT b.id, b.fecha, b.colaborador, b.apoyo_detalle, b.pendientes, t.nombre as team_name
        FROM bitacoras b
        LEFT JOIN users u ON COALESCE(b.user_id, (SELECT id FROM users WHERE full_name = b.colaborador LIMIT 1)) = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        {base_filter} AND b.necesita_apoyo = 'Si'
        ORDER BY b.fecha DESC, b.id DESC
        LIMIT 10
    '''
    alertas_apoyo = cursor.execute(apoyo_query, params).fetchall()

    # 6. Tendencia cronológica diaria (últimas fechas para gráfico Spline/Líneas)
    tendencia_query = f'''
        SELECT b.fecha,
               COUNT(a.id) as actividades,
               COALESCE(SUM(a.duracion_min), 0) as minutos,
               SUM(CASE WHEN a.estado = 'completada' THEN 1 ELSE 0 END) as completadas
        FROM bitacoras b
        LEFT JOIN actividades a ON a.bitacora_id = b.id AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        LEFT JOIN users u ON COALESCE(b.user_id, (SELECT id FROM users WHERE full_name = b.colaborador LIMIT 1)) = u.id
        {base_filter}
        GROUP BY b.fecha
        ORDER BY b.fecha ASC
        LIMIT 30
    '''
    tendencia_diaria = cursor.execute(tendencia_query, params).fetchall()

    # 7. Distribución por franja horaria del día
    horaria_query = f'''
        SELECT 
            CASE 
                WHEN a.hora_inicio < '10:00' THEN '08:00 - 10:00'
                WHEN a.hora_inicio < '12:00' THEN '10:00 - 12:00'
                WHEN a.hora_inicio < '14:00' THEN '12:00 - 14:00'
                WHEN a.hora_inicio < '16:00' THEN '14:00 - 16:00'
                WHEN a.hora_inicio < '18:00' THEN '16:00 - 18:00'
                ELSE '18:00+'
            END as franja,
            COUNT(a.id) as cantidad,
            COALESCE(SUM(a.duracion_min), 0) as minutos
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        LEFT JOIN users u ON COALESCE(b.user_id, (SELECT id FROM users WHERE full_name = b.colaborador LIMIT 1)) = u.id
        {base_filter} AND (a.is_deleted IS NULL OR a.is_deleted = 0) AND a.hora_inicio IS NOT NULL AND a.hora_inicio != ''
        GROUP BY franja
        ORDER BY MIN(a.hora_inicio) ASC
    '''
    distribucion_horaria = cursor.execute(horaria_query, params).fetchall()

    # 8. Métricas y KPIs de telemetría operativa
    tot_min = totales['total_minutos'] if totales else 0
    tot_bit = totales['total_bitacoras'] if totales else 0
    promedio_jornada = round(tot_min / tot_bit) if tot_bit > 0 else 0

    total_acts = sum(r['cantidad'] for r in act_stats) if act_stats else 0
    completed_acts = sum(r['cantidad'] for r in act_stats if r['estado'] == 'completada') if act_stats else 0
    eficiencia = round((completed_acts / total_acts) * 100) if total_acts > 0 else 0

    planificadas_min = sum(r['minutos'] for r in tipo_stats if 'planificad' in (r['tipo'] or '').lower()) if tipo_stats else 0
    ratio_planificado = round((planificadas_min / tot_min) * 100) if tot_min > 0 else 0
    
    conn.close()
    
    return jsonify({
        "resumen": dict(totales) if totales else {},
        "por_estado": [dict(r) for r in act_stats],
        "por_tipo": [dict(r) for r in tipo_stats],
        "por_colaborador": [dict(r) for r in colab_stats],
        "alertas_apoyo": [dict(r) for r in alertas_apoyo],
        "tendencia_diaria": [dict(r) for r in tendencia_diaria],
        "distribucion_horaria": [dict(r) for r in distribucion_horaria],
        "kpis_adicionales": {
            "promedio_minutos_jornada": promedio_jornada,
            "eficiencia": eficiencia,
            "ratio_planificado": ratio_planificado,
            "total_actividades": total_acts,
            "actividades_completadas": completed_acts
        }
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
        # 0. Auto-purga permanente de actividades eliminadas con más de 15 días de antigüedad según horario de Perú
        purge_threshold = (get_peru_now() - timedelta(days=15)).strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("DELETE FROM actividades WHERE is_deleted = 1 AND deleted_at < ?", (purge_threshold,))

        # 1. Auto-cerrar bitácoras de días pasados (< today_str) que no estén formalmente cerradas
        past_open = cursor.execute('''
            SELECT id, user_id, colaborador, fecha, pendientes
            FROM bitacoras
            WHERE fecha < ? AND estado NOT IN ('cerrada', 'cerrada_sistema')
        ''', (today_str,)).fetchall()
        
        for b in past_open:
            dur = cursor.execute(
                "SELECT COALESCE(SUM(duracion_min), 0) FROM actividades WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0)", 
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

        # 2. Arrastre de actividades abiertas hacia el día de hoy
        active_users = cursor.execute("SELECT id, full_name FROM users WHERE is_active = 1").fetchall()
        
        for u in active_users:
            u_id = u['id']
            u_name = u['full_name']
            
            # Buscar tareas de días previos que no se completaron, no estén eliminadas y no hayan sido transferidas
            open_tasks = cursor.execute('''
                SELECT a.*, b.fecha, b.area
                FROM actividades a
                JOIN bitacoras b ON a.bitacora_id = b.id
                WHERE (b.user_id = ? OR b.colaborador = ?)
                  AND b.fecha < ?
                  AND a.estado != 'completada'
                  AND (a.is_deleted IS NULL OR a.is_deleted = 0)
                  AND a.id NOT IN (
                    SELECT parent_task_id FROM actividades 
                    WHERE parent_task_id IS NOT NULL AND (is_deleted IS NULL OR is_deleted = 0)
                  )
                ORDER BY a.id ASC
            ''', (u_id, u_name, today_str)).fetchall()
            
            if not open_tasks:
                continue
                
            # Buscar si ya existe bitácora de hoy para este colaborador
            today_b = cursor.execute('''
                SELECT id FROM bitacoras
                WHERE (user_id = ? OR colaborador = ?) AND fecha = ?
            ''', (u_id, u_name, today_str)).fetchone()
            
            today_b_id = None
            if today_b:
                today_b_id = today_b['id']
            else:
                last_b = cursor.execute('''
                    SELECT area FROM bitacoras
                    WHERE (user_id = ? OR colaborador = ?)
                    ORDER BY fecha DESC, id DESC LIMIT 1
                ''', (u_id, u_name)).fetchone()
                area_val = last_b['area'] if last_b else 'Sistemas'
                
                cursor.execute('''
                    INSERT INTO bitacoras (
                        user_id, fecha, hora_inicio, colaborador, area,
                        pendientes, necesita_apoyo, prioridad_siguiente,
                        tiempo_total_min, estado, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, '', 'No', '', 0, 'generada', ?, ?)
                ''', (u_id, today_str, get_default_hora_inicio(), u_name, area_val, now_peru, now_peru))
                today_b_id = cursor.lastrowid

                
            # IDs de tareas que ya fueron arrastradas a hoy
            existing_parent_ids = [
                r[0] for r in cursor.execute(
                    "SELECT parent_task_id FROM actividades WHERE bitacora_id = ? AND parent_task_id IS NOT NULL AND (is_deleted IS NULL OR is_deleted = 0)",
                    (today_b_id,)
                ).fetchall()
            ]
            
            current_order = cursor.execute(
                "SELECT COALESCE(MAX(orden), 0) FROM actividades WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0)",
                (today_b_id,)
            ).fetchone()[0] + 1
            
            for task in open_tasks:
                if task['id'] not in existing_parent_ids:
                    # Preservar fecha original de creación y última actualización para trazabilidad de antigüedad
                    orig_created = task['created_at'] or get_peru_now().strftime('%Y-%m-%d %H:%M:%S')
                    orig_updated = task['updated_at'] or orig_created
                    ev_val = task['evidencias'] if ('evidencias' in task.keys() and task['evidencias']) else '[]'
                    sw_val = task['shared_with'] if ('shared_with' in task.keys() and task['shared_with']) else '[]'
                    sw_uuid = task['shared_uuid'] if ('shared_uuid' in task.keys() and task['shared_uuid']) else None
                    cursor.execute('''
                        INSERT INTO actividades (
                            bitacora_id, orden, hora_inicio, duracion_min,
                            tipo_trabajo, descripcion, para_cliente, estado,
                            parent_task_id, created_at, updated_at, evidencias,
                            shared_with, shared_uuid, is_deleted
                        ) VALUES (?, ?, '', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
                        sw_uuid
                    ))
                    current_order += 1
                    rolled_count += 1
                    
        conn.commit()
    except Exception as e:
        conn.rollback()
        print("Error en execute_daily_rollover:", e)
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
    date_arg = request.args.get('date')
    res = execute_daily_rollover(today_str=date_arg)
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
            WITH RECURSIVE lineage AS (
              SELECT id, parent_task_id, duracion_min FROM actividades WHERE id = a.id
              UNION ALL
              SELECT prev.id, prev.parent_task_id, prev.duracion_min
              FROM actividades prev
              JOIN lineage l ON prev.id = l.parent_task_id
            )
            SELECT SUM(duracion_min) FROM lineage
          ), a.duracion_min) AS tiempo_acumulado_min
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE (b.user_id = ? OR b.colaborador = ?)
          AND b.fecha < ?
          AND a.estado != 'completada'
          AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        ORDER BY a.id ASC
    '''
    tasks = cursor.execute(query, (user_id, colaborador, target_fecha)).fetchall()
    conn.close()
    
    return jsonify({
        "success": True,
        "pendientes": [format_actividad_dict(t) for t in tasks],
        "count": len(tasks)
    })

LAST_ROLLOVER_DATE = None
rollover_lock = threading.Lock()

def ensure_daily_rollover(target_date=None):
    global LAST_ROLLOVER_DATE
    today_str = target_date or get_peru_today_str()
    if LAST_ROLLOVER_DATE != today_str:
        with rollover_lock:
            if LAST_ROLLOVER_DATE != today_str:
                print(f"[Scheduler] Verificando y ejecutando rollover para {today_str}...")
                execute_daily_rollover(today_str)
                LAST_ROLLOVER_DATE = today_str

@app.before_request
def check_rollover_on_request():
    if request.path.startswith('/api/') and not request.path.startswith('/api/uploads'):
        ensure_daily_rollover()

def start_midnight_scheduler():
    """Inicia el hilo en background para ejecutar el rollover y catch-up periódico cada 30 segundos."""
    def run_scheduler():
        while True:
            try:
                ensure_daily_rollover()
            except Exception as e:
                print("[Scheduler] Error en ciclo periódico:", e)
            time.sleep(30)

    t = threading.Thread(target=run_scheduler, daemon=True)
    t.start()

# Inicializar base de datos y scheduler tanto en modo directo como con Gunicorn
try:
    init_db()
    cleanup_synthetic_historical_data()
    fix_mock_data_jayala()
    start_midnight_scheduler()
except Exception as e:

    print("[Startup] Error inicializando DB o scheduler:", e)

if __name__ == '__main__':
    print("Iniciando servidor Flask de Bitácoras con soporte de Usuarios, Equipos, Dashboard y Rollover 00:00 en http://localhost:5000...")
    app.run(host='0.0.0.0', port=5000, debug=False)
