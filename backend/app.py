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
from database import get_db, init_db

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
    return jsonify({"status": "ok", "service": "Bitácora API", "version": "2.1.0"})

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
            'login_bg_url', 'login_bg_type', 'login_heading', 'login_subheading'
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
        'login_subheading': 'Marketing Alterno Perú'
    }
    for k, v in defaults.items():
        if k not in settings:
            settings[k] = v

    conn.close()
    return jsonify(settings), 200

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
        full_name = data.get('full_name')
        email = data.get('email')
        phone = data.get('phone')
        role = data.get('role')
        team_id = data.get('team_id')
        is_active = data.get('is_active', 1)
        password = data.get('password')
        
        if password and len(password.strip()) > 0:
            p_hash = generate_password_hash(password.strip())
            cursor.execute('''
                UPDATE users SET
                    full_name = COALESCE(?, full_name),
                    email = COALESCE(?, email),
                    phone = COALESCE(?, phone),
                    role = COALESCE(?, role),
                    team_id = ?,
                    is_active = ?,
                    password_hash = ?
                WHERE id = ?
            ''', (full_name, email, phone, role, team_id, is_active, p_hash, user_id))
        else:
            cursor.execute('''
                UPDATE users SET
                    full_name = COALESCE(?, full_name),
                    email = COALESCE(?, email),
                    phone = COALESCE(?, phone),
                    role = COALESCE(?, role),
                    team_id = ?,
                    is_active = ?
                WHERE id = ?
            ''', (full_name, email, phone, role, team_id, is_active, user_id))
            
        conn.commit()
        updated = cursor.execute("SELECT id, username, email, phone, full_name, role, team_id, is_active FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        return jsonify({"message": "Usuario actualizado", "user": dict(updated)})
        
    elif request.method == 'DELETE':
        if user_id == 1:
            conn.close()
            return jsonify({"error": "No se puede desactivar al Administrador Principal"}), 400
        # Soft delete / toggle active
        cursor.execute("UPDATE users SET is_active = 0 WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Usuario desactivado correctamente"})

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
                SELECT id, username, full_name, role, email
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
        LEFT JOIN users u ON COALESCE(b.user_id, (SELECT id FROM users WHERE full_name = b.colaborador LIMIT 1)) = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE 1=1
    '''
    params = []
    
    # PRIVACIDAD ESTRICTA POR ROL:
    if requesting_user_id:
        req_u = cursor.execute("SELECT id, role, team_id, full_name FROM users WHERE id = ?", (requesting_user_id,)).fetchone()
        if req_u:
            r_role = req_u['role']
            if r_role in ('analista', 'operador'):
                # Los analistas SOLO pueden ver sus propias bitácoras
                query += " AND (b.user_id = ? OR b.colaborador = ?)"
                params.extend([req_u['id'], req_u['full_name']])
            elif r_role == 'lider':
                # Los líderes pueden ver bitácoras de los miembros de su equipo o las suyas
                if req_u['team_id']:
                    query += " AND (u.team_id = ? OR b.user_id = ? OR b.colaborador = ?)"
                    params.extend([req_u['team_id'], req_u['id'], req_u['full_name']])
                else:
                    query += " AND (b.user_id = ? OR b.colaborador = ?)"
                    params.extend([req_u['id'], req_u['full_name']])
            # Si es admin, no se aplica restricción automática
    
    if fecha:
        query += " AND b.fecha = ?"
        params.append(fecha)
    if colaborador:
        query += " AND b.colaborador LIKE ?"
        params.append(f"%{colaborador}%")
    if team_id:
        query += " AND u.team_id = ?"
        params.append(team_id)
    if user_id:
        query += " AND (b.user_id = ? OR u.id = ?)"
        params.extend([user_id, user_id])
        
    query += " ORDER BY b.fecha DESC, b.id DESC LIMIT 100"
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
            WHERE a.bitacora_id = ?
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
        WHERE a.bitacora_id = ?
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
    
    # Si no viene user_id, buscarlo por nombre
    if not user_id:
        u_match = cursor.execute("SELECT id FROM users WHERE full_name = ?", (colaborador,)).fetchone()
        if u_match:
            user_id = u_match['id']

    try:
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
                        updated_at = CURRENT_TIMESTAMP
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
                    bitacora_id
                ))
            else:
                bitacora_id = None

        if not bitacora_id:
            # Si ya existe una bitácora para este colaborador y fecha, actualizarla para no duplicar
            existing_by_date = cursor.execute(
                "SELECT id FROM bitacoras WHERE (user_id = ? OR colaborador = ?) AND fecha = ?",
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
                        updated_at = CURRENT_TIMESTAMP
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
                    bitacora_id
                ))
            else:
                cursor.execute('''
                    INSERT INTO bitacoras (
                        user_id, fecha, hora_inicio, colaborador, area, pendientes,
                        necesita_apoyo, apoyo_detalle, prioridad_siguiente,
                        tiempo_total_min, resumen_texto, estado
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    data.get('estado', 'generada')
                ))
                bitacora_id = cursor.lastrowid

        # Mapeo de actividades previas para actualización quirúrgica (conserva IDs y árbol genealógico)
        existing_acts = {r['id']: r for r in cursor.execute("SELECT id FROM actividades WHERE bitacora_id = ?", (bitacora_id,)).fetchall()}
        kept_ids = set()

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

            act_id = act.get('id')
            if act_id and act_id in existing_acts:
                cursor.execute('''
                    UPDATE actividades SET
                        orden = ?, hora_inicio = ?, duracion_min = ?,
                        tipo_trabajo = ?, descripcion = ?, para_cliente = ?,
                        estado = ?, evidencias = ?, shared_with = ?,
                        shared_uuid = COALESCE(?, shared_uuid),
                        updated_at = CURRENT_TIMESTAMP
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
                    act_id
                ))
                kept_ids.add(act_id)
            else:
                cursor.execute('''
                    INSERT INTO actividades (
                        bitacora_id, orden, hora_inicio, duracion_min,
                        tipo_trabajo, descripcion, para_cliente, estado, evidencias,
                        shared_with, shared_uuid, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
                    shared_uuid
                ))
                kept_ids.add(cursor.lastrowid)

        # Eliminar únicamente actividades removidas por el usuario, desvinculando referencias hijas
        for old_id in existing_acts:
            if old_id not in kept_ids:
                cursor.execute("UPDATE actividades SET parent_task_id = NULL WHERE parent_task_id = ?", (old_id,))
                cursor.execute("DELETE FROM actividades WHERE id = ?", (old_id,))
            
            # Sincronización automática de tarea compartida en paralelo con el otro usuario
            if shared_with_val and shared_uuid:
                for target_uid in shared_with_val:
                    if target_uid != user_id:
                        target_u = cursor.execute("SELECT id, full_name FROM users WHERE id = ?", (target_uid,)).fetchone()
                        if target_u:
                            target_b = cursor.execute(
                                "SELECT id FROM bitacoras WHERE (user_id = ? OR colaborador = ?) AND fecha = ?",
                                (target_u['id'], target_u['full_name'], fecha)
                            ).fetchone()
                            if not target_b:
                                cursor.execute('''
                                    INSERT INTO bitacoras (
                                        user_id, fecha, hora_inicio, colaborador, area,
                                        pendientes, necesita_apoyo, prioridad_siguiente,
                                        tiempo_total_min, estado, created_at, updated_at
                                    ) VALUES (?, ?, ?, ?, 'Sistemas', '', 'No', '', 0, 'generada', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                                ''', (target_u['id'], fecha, act.get('hora_inicio') or get_default_hora_inicio(), target_u['full_name']))
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
                                        updated_at = CURRENT_TIMESTAMP
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
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
                                    shared_uuid
                                ))
                                
                            # Recalcular el tiempo_total_min de la bitácora del colaborador
                            cursor.execute('''
                                UPDATE bitacoras SET tiempo_total_min = (
                                    SELECT COALESCE(SUM(duracion_min), 0) FROM actividades WHERE bitacora_id = ?
                                ), updated_at = CURRENT_TIMESTAMP WHERE id = ?
                            ''', (target_b_id, target_b_id))

        conn.commit()
        
        users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
        b = cursor.execute("SELECT * FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone()
        b_dict = dict(b)
        acts = cursor.execute("SELECT * FROM actividades WHERE bitacora_id = ? ORDER BY orden ASC, id ASC", (bitacora_id,)).fetchall()
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
    act = cursor.execute("SELECT shared_uuid FROM actividades WHERE id = ?", (act_id,)).fetchone()
    if act and act['shared_uuid']:
        cursor.execute("UPDATE actividades SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE shared_uuid = ?", (nuevo_estado, act['shared_uuid']))
    else:
        cursor.execute("UPDATE actividades SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (nuevo_estado, act_id))
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
                updated_at = CURRENT_TIMESTAMP
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
                updated_at = CURRENT_TIMESTAMP
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
        WHERE a.estado != 'completada'
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
        {base_filter}
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
        {base_filter}
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
        LEFT JOIN actividades a ON a.bitacora_id = b.id
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
        LEFT JOIN actividades a ON a.bitacora_id = b.id
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
        {base_filter} AND a.hora_inicio IS NOT NULL AND a.hora_inicio != ''
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
    """
    if not today_str:
        today_str = datetime.now().strftime('%Y-%m-%d')
        
    conn = get_db()
    cursor = conn.cursor()
    closed_count = 0
    rolled_count = 0
    
    try:
        # 1. Auto-cerrar bitácoras de días pasados (< today_str) que no estén formalmente cerradas
        past_open = cursor.execute('''
            SELECT id, user_id, colaborador, fecha, pendientes
            FROM bitacoras
            WHERE fecha < ? AND estado NOT IN ('cerrada', 'cerrada_sistema')
        ''', (today_str,)).fetchall()
        
        for b in past_open:
            dur = cursor.execute("SELECT COALESCE(SUM(duracion_min), 0) FROM actividades WHERE bitacora_id = ?", (b['id'],)).fetchone()[0]
            incomp = cursor.execute("SELECT descripcion FROM actividades WHERE bitacora_id = ? AND estado != 'completada'", (b['id'],)).fetchall()
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
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (dur, auto_pend, b['id']))
            closed_count += 1

        # 2. Arrastre de actividades abiertas hacia el día de hoy
        active_users = cursor.execute("SELECT id, full_name FROM users WHERE is_active = 1").fetchall()
        
        for u in active_users:
            u_id = u['id']
            u_name = u['full_name']
            
            # Buscar tareas de días previos que no se completaron y que no hayan sido ya transferidas a otro día
            open_tasks = cursor.execute('''
                SELECT a.*, b.fecha, b.area
                FROM actividades a
                JOIN bitacoras b ON a.bitacora_id = b.id
                WHERE (b.user_id = ? OR b.colaborador = ?)
                  AND b.fecha < ?
                  AND a.estado != 'completada'
                  AND a.id NOT IN (
                    SELECT parent_task_id FROM actividades WHERE parent_task_id IS NOT NULL
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
                    ) VALUES (?, ?, ?, ?, ?, '', 'No', '', 0, 'generada', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ''', (u_id, today_str, get_default_hora_inicio(), u_name, area_val))
                today_b_id = cursor.lastrowid
                
            # IDs de tareas que ya fueron arrastradas a hoy
            existing_parent_ids = [
                r[0] for r in cursor.execute(
                    "SELECT parent_task_id FROM actividades WHERE bitacora_id = ? AND parent_task_id IS NOT NULL",
                    (today_b_id,)
                ).fetchall()
            ]
            
            current_order = cursor.execute(
                "SELECT COALESCE(MAX(orden), 0) FROM actividades WHERE bitacora_id = ?",
                (today_b_id,)
            ).fetchone()[0] + 1
            
            for task in open_tasks:
                if task['id'] not in existing_parent_ids:
                    # Preservar fecha original de creación y última actualización para trazabilidad de antigüedad
                    orig_created = task['created_at'] or datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    orig_updated = task['updated_at'] or orig_created
                    ev_val = task['evidencias'] if ('evidencias' in task.keys() and task['evidencias']) else '[]'
                    sw_val = task['shared_with'] if ('shared_with' in task.keys() and task['shared_with']) else '[]'
                    sw_uuid = task['shared_uuid'] if ('shared_uuid' in task.keys() and task['shared_uuid']) else None
                    cursor.execute('''
                        INSERT INTO actividades (
                            bitacora_id, orden, hora_inicio, duracion_min,
                            tipo_trabajo, descripcion, para_cliente, estado,
                            parent_task_id, created_at, updated_at, evidencias,
                            shared_with, shared_uuid
                        ) VALUES (?, ?, '', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    target_fecha = data.get('target_fecha') or datetime.now().strftime('%Y-%m-%d')
    
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
    today_str = target_date or datetime.now().strftime('%Y-%m-%d')
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

if __name__ == '__main__':
    init_db()
    start_midnight_scheduler()
    print("Iniciando servidor Flask de Bitácoras con soporte de Usuarios, Equipos, Dashboard y Rollover 00:00 en http://localhost:5000...")
    app.run(host='0.0.0.0', port=5000, debug=False)
