from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash

from database import get_db
from helpers import validate_new_password, generate_temp_password

admin_bp = Blueprint('admin_routes', __name__)


@admin_bp.route('/api/users', methods=['GET'])
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


@admin_bp.route('/api/admin/users', methods=['GET', 'POST', 'OPTIONS'])
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
        password = (data.get('password') or '').strip()
        temp_password = None
        if not password:
            temp_password = password = generate_temp_password()
        role = data.get('role') or 'analista'
        team_id = data.get('team_id') or None

        if not username or not full_name:
            conn.close()
            return jsonify({"error": "Usuario y Nombre completo son requeridos"}), 400

        existing = cursor.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            conn.close()
            return jsonify({"error": f"El nombre de usuario '{username}' ya existe"}), 400

        pw_error = validate_new_password(password)
        if pw_error:
            conn.close()
            return jsonify({"error": pw_error}), 400

        p_hash = generate_password_hash(password)
        cursor.execute('''
            INSERT INTO users (username, email, phone, password_hash, full_name, role, team_id, is_active, must_change_password, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
        ''', (username, email, phone, p_hash, full_name, role, team_id))
        user_id = cursor.lastrowid
        cursor.execute(
            "UPDATE OR IGNORE bitacoras SET user_id = ? WHERE user_id IS NULL AND (LOWER(TRIM(colaborador)) = LOWER(TRIM(?)) OR LOWER(TRIM(colaborador)) = LOWER(TRIM(?)))",
            (user_id, full_name, username),
        )
        conn.commit()

        new_u = cursor.execute("SELECT id, username, email, phone, full_name, role, team_id FROM users WHERE id = ?", (user_id,)).fetchone()
        conn.close()
        resp = {"message": "Usuario creado con éxito", "user": dict(new_u)}
        if temp_password:
            resp["temp_password"] = temp_password
        return jsonify(resp), 201


@admin_bp.route('/api/admin/users/<int:user_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
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
            dup = cursor.execute("SELECT id FROM users WHERE LOWER(username) = ? AND id != ?", (raw_username, user_id)).fetchone()
            if dup:
                conn.close()
                return jsonify({"error": f"El nombre de usuario '{raw_username}' ya está en uso por otro colaborador"}), 400
            target_username = raw_username

        if password and len(password.strip()) > 0:
            pw_error = validate_new_password(password.strip())
            if pw_error:
                conn.close()
                return jsonify({"error": pw_error}), 400
            p_hash = generate_password_hash(password.strip())
            acting = getattr(g, 'current_user', None) or {}
            must_change = 0 if int(acting.get('id', -1)) == int(user_id) else 1
            cursor.execute('''
                UPDATE users SET
                    username = ?,
                    full_name = COALESCE(?, full_name),
                    email = COALESCE(?, email),
                    phone = COALESCE(?, phone),
                    role = COALESCE(?, role),
                    team_id = ?,
                    is_active = ?,
                    password_hash = ?,
                    must_change_password = ?
                WHERE id = ?
            ''', (target_username, full_name, email, phone, role, team_id, is_active, p_hash, must_change, user_id))
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
                cursor.execute("UPDATE teams SET lider_id = NULL WHERE lider_id = ?", (user_id,))
                cursor.execute('''
                    UPDATE actividades SET parent_task_id = NULL 
                    WHERE parent_task_id IN (SELECT id FROM actividades WHERE bitacora_id IN (SELECT id FROM bitacoras WHERE user_id = ?))
                ''', (user_id,))
                cursor.execute('''
                    UPDATE actividades SET parent_task_id = NULL 
                    WHERE bitacora_id IN (SELECT id FROM bitacoras WHERE user_id = ?)
                ''', (user_id,))
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

                cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
                conn.commit()
                conn.close()
                return jsonify({"success": True, "message": "Usuario eliminado definitivamente del sistema"})
            except Exception as e:
                conn.rollback()
                conn.close()
                return jsonify({"error": f"Error al eliminar usuario: {str(e)}"}), 500
        else:
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


@admin_bp.route('/api/admin/teams', methods=['GET', 'POST', 'OPTIONS'])
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

        member_ids = data.get('member_ids')
        effective_members = set()
        if member_ids and isinstance(member_ids, list):
            effective_members.update(member_ids)

        if lider_id:
            cursor.execute('''
                UPDATE users SET team_id = ?, role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'lider' END
                WHERE id = ?
            ''', (team_id, lider_id))
            effective_members.add(lider_id)

        if effective_members:
            placeholders = ','.join(['?'] * len(effective_members))
            cursor.execute(f"UPDATE users SET team_id = ? WHERE id IN ({placeholders})", [team_id] + list(effective_members))

        conn.commit()
        conn.close()
        return jsonify({"message": "Equipo creado con éxito", "team_id": team_id}), 201


@admin_bp.route('/api/admin/teams/<int:team_id>', methods=['PUT', 'DELETE', 'OPTIONS'])
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
        member_ids = data.get('member_ids')

        cursor.execute('''
            UPDATE teams SET
                nombre = COALESCE(?, nombre),
                descripcion = COALESCE(?, descripcion),
                lider_id = ?
            WHERE id = ?
        ''', (nombre, descripcion, lider_id, team_id))

        effective_lider_id = lider_id
        if effective_lider_id is None:
            team_row = cursor.execute("SELECT lider_id FROM teams WHERE id = ?", (team_id,)).fetchone()
            if team_row:
                effective_lider_id = team_row['lider_id']

        if effective_lider_id:
            cursor.execute('''
                UPDATE users SET team_id = ?, role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'lider' END
                WHERE id = ?
            ''', (team_id, effective_lider_id))

        if member_ids is not None and isinstance(member_ids, list):
            cursor.execute("UPDATE users SET team_id = NULL WHERE team_id = ?", (team_id,))
            effective_members = set(member_ids)
            if effective_lider_id:
                effective_members.add(effective_lider_id)
            if effective_members:
                placeholders = ','.join(['?'] * len(effective_members))
                cursor.execute(f"UPDATE users SET team_id = ? WHERE id IN ({placeholders})", [team_id] + list(effective_members))

        conn.commit()
        conn.close()
        return jsonify({"message": "Equipo actualizado correctamente"})

    elif request.method == 'DELETE':
        cursor.execute("UPDATE users SET team_id = NULL WHERE team_id = ?", (team_id,))
        cursor.execute("DELETE FROM teams WHERE id = ?", (team_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Equipo eliminado correctamente"})


@admin_bp.route('/api/admin/delegations', methods=['GET', 'POST', 'OPTIONS'])
def handle_delegations():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    if request.method == 'GET':
        conn = get_db()
        cursor = conn.cursor()
        try:
            rows = cursor.execute('''
                SELECT d.*, 
                       u_del.full_name as delegate_name, u_del.username as delegate_username,
                       u_tar.full_name as target_name, u_tar.username as target_username,
                       t.nombre as team_name,
                       u_asg.full_name as assigned_by_name
                FROM user_delegations d
                JOIN users u_del ON d.delegate_user_id = u_del.id
                JOIN users u_tar ON d.target_user_id = u_tar.id
                LEFT JOIN teams t ON d.team_id = t.id
                LEFT JOIN users u_asg ON d.assigned_by = u_asg.id
                ORDER BY d.id DESC
            ''').fetchall()
            res = [dict(r) for r in rows]
            conn.close()
            return jsonify(res), 200
        except Exception as e:
            conn.close()
            return jsonify({"error": str(e)}), 500

    data = request.get_json() or {}
    delegate_id = data.get('delegate_user_id')
    target_ids = data.get('target_user_ids')
    target_id = data.get('target_user_id')
    assigned_by = data.get('assigned_by', 1)
    motivo = data.get('motivo', 'Apoyo en registro de actividades')

    if target_ids is None and target_id is not None:
        target_ids = [target_id]
    elif not isinstance(target_ids, list):
        target_ids = [target_ids] if target_ids else []

    valid_target_ids = []
    for tid in target_ids:
        try:
            n_tid = int(tid)
            if delegate_id and n_tid != int(delegate_id):
                valid_target_ids.append(n_tid)
        except (ValueError, TypeError):
            pass

    valid_target_ids = list(dict.fromkeys(valid_target_ids))

    if not delegate_id or len(valid_target_ids) == 0:
        return jsonify({"error": "Debe especificar el usuario de apoyo y al menos un colaborador destinatario válido"}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        created_count = 0
        names_assigned = []
        for t_id in valid_target_ids:
            target_user = cursor.execute("SELECT team_id, full_name FROM users WHERE id = ?", (t_id,)).fetchone()
            if not target_user:
                continue

            team_id = target_user['team_id']
            existing = cursor.execute('''
                SELECT id FROM user_delegations 
                WHERE delegate_user_id = ? AND target_user_id = ?
            ''', (delegate_id, t_id)).fetchone()

            if existing:
                cursor.execute('''
                    UPDATE user_delegations 
                    SET is_active = 1, motivo = ?, assigned_by = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (motivo, assigned_by, existing['id']))
            else:
                cursor.execute('''
                    INSERT INTO user_delegations (delegate_user_id, target_user_id, team_id, motivo, is_active, assigned_by)
                    VALUES (?, ?, ?, ?, 1, ?)
                ''', (delegate_id, t_id, team_id, motivo, assigned_by))

            created_count += 1
            names_assigned.append(target_user['full_name'])

        if created_count > 0:
            if created_count == 1:
                notif_msg = f"Has sido designado como apoyo para registrar actividades de {names_assigned[0]}."
            else:
                notif_msg = f"Has sido designado como apoyo para {created_count} colaboradores: {', '.join(names_assigned[:3])}{' y otros más' if created_count > 3 else ''}."

            cursor.execute('''
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                VALUES (?, 'Designación de Apoyo', ?, 'info', 0, CURRENT_TIMESTAMP)
            ''', (delegate_id, notif_msg))

        conn.commit()
        conn.close()
        return jsonify({
            "message": f"Se han asignado {created_count} colaborador(es) como apoyo exitosamente",
            "count": created_count
        }), 201
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/admin/delegations/<int:del_id>', methods=['DELETE', 'OPTIONS'])
def delete_delegation(del_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM user_delegations WHERE id = ?", (del_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Delegación eliminada exitosamente"}), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/admin/delegations/by-delegate/<int:del_user_id>', methods=['DELETE', 'OPTIONS'])
def delete_delegations_by_delegate(del_user_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM user_delegations WHERE delegate_user_id = ?", (del_user_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Todas las asignaciones de apoyo han sido eliminadas"}), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/api/delegations/my-targets', methods=['GET', 'OPTIONS'])
def get_my_delegated_targets():
    if request.method == 'OPTIONS':
        return jsonify([]), 200
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify([]), 200
    conn = get_db()
    cursor = conn.cursor()
    try:
        u = cursor.execute("SELECT id, role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not u:
            conn.close()
            return jsonify([]), 200

        if u['role'] == 'admin':
            rows = cursor.execute('''
                SELECT u.id, u.username, u.full_name, u.role, u.team_id, t.nombre as team_name, 'Acceso Administrativo' as motivo
                FROM users u
                LEFT JOIN teams t ON u.team_id = t.id
                WHERE u.is_active = 1 AND u.id != ?
                ORDER BY u.full_name ASC
            ''', (user_id,)).fetchall()
        else:
            rows = cursor.execute('''
                SELECT u.id, u.username, u.full_name, u.role, u.team_id, t.nombre as team_name, d.motivo
                FROM user_delegations d
                JOIN users u ON d.target_user_id = u.id
                LEFT JOIN teams t ON u.team_id = t.id
                WHERE d.delegate_user_id = ? AND d.is_active = 1 AND u.is_active = 1
                ORDER BY u.full_name ASC
            ''', (user_id,)).fetchall()

        res = [dict(r) for r in rows]
        conn.close()
        return jsonify(res), 200
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500
