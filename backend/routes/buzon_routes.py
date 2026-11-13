import json
import logging
from flask import Blueprint, request, jsonify

from database import get_db, get_peru_now_str
from helpers import check_and_notify_stagnant_activities

logger = logging.getLogger('bitacora')
buzon_bp = Blueprint('buzon_routes', __name__)


def serialize_sugerencia_dict(row_dict):
    d = dict(row_dict)
    if d.get('es_anonimo'):
        d['colaborador'] = 'Colaborador Anónimo'
        d['user_id'] = None
    ev_val = d.get('evidencias')
    if ev_val:
        try:
            d['evidencias'] = json.loads(ev_val) if isinstance(ev_val, str) else ev_val
        except Exception:
            d['evidencias'] = []
    else:
        d['evidencias'] = []
    return d


@buzon_bp.route('/api/sugerencias', methods=['GET', 'POST', 'OPTIONS'])
def handle_sugerencias():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    now_peru = get_peru_now_str()

    if request.method == 'POST':
        data = request.get_json() or {}
        user_id = data.get('user_id')
        colaborador = (data.get('colaborador') or '').strip()
        es_anonimo = 1 if data.get('es_anonimo') else 0
        categoria = data.get('categoria') or 'sistema'
        titulo = (data.get('titulo') or '').strip()
        descripcion = (data.get('descripcion') or '').strip()
        impacto = data.get('impacto') or 'medio'
        evidencias_raw = data.get('evidencias', [])
        evidencias_json = json.dumps(evidencias_raw) if isinstance(evidencias_raw, (list, dict)) else (evidencias_raw or '[]')

        if not titulo or not descripcion:
            conn.close()
            return jsonify({"error": "Título y descripción son requeridos"}), 400

        cursor.execute('''
            INSERT INTO buzon_sugerencias (
                user_id, colaborador, es_anonimo, categoria,
                titulo, descripcion, impacto, estado, votos, evidencias, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', 0, ?, ?, ?)
        ''', (user_id, colaborador, es_anonimo, categoria, titulo, descripcion, impacto, evidencias_json, now_peru, now_peru))
        sug_id = cursor.lastrowid
        conn.commit()

        try:
            author_label = "Un colaborador (Anónimo)" if es_anonimo else (colaborador or "Un colaborador")
            cursor.execute('''
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                SELECT id, 'Nueva sugerencia en el buzón', ?, 'info', 0, ?
                FROM users WHERE role IN ('admin', 'lider')
            ''', (f'{author_label} propuso: "{titulo}"', now_peru))
            conn.commit()
        except Exception as e:
            logger.warning("[Buzón] Error creando notificación: %s", e)

        sug = cursor.execute("SELECT * FROM buzon_sugerencias WHERE id = ?", (sug_id,)).fetchone()
        conn.close()
        return jsonify({"message": "Sugerencia enviada exitosamente", "sugerencia": serialize_sugerencia_dict(sug)}), 201

    categoria = request.args.get('categoria')
    estado = request.args.get('estado')
    user_id = request.args.get('user_id')
    current_uid = request.args.get('requesting_user_id') or user_id

    query = '''
        SELECT s.*,
               CASE WHEN bv.id IS NOT NULL THEN 1 ELSE 0 END as user_has_voted
        FROM buzon_sugerencias s
        LEFT JOIN buzon_votos bv ON s.id = bv.sugerencia_id AND bv.user_id = ?
        WHERE 1=1
    '''
    params = [current_uid]

    if categoria and categoria != 'todas':
        query += " AND s.categoria = ?"
        params.append(categoria)
    if estado and estado != 'todas':
        query += " AND s.estado = ?"
        params.append(estado)
    if request.args.get('mine') == 'true' and user_id:
        query += " AND s.user_id = ?"
        params.append(user_id)

    order_by = request.args.get('sort', 'reciente')
    if order_by == 'popular':
        query += " ORDER BY s.votos DESC, s.created_at DESC"
    else:
        query += " ORDER BY s.created_at DESC, s.id DESC"

    rows = cursor.execute(query, params).fetchall()
    results = [serialize_sugerencia_dict(r) for r in rows]

    conn.close()
    return jsonify(results), 200


@buzon_bp.route('/api/sugerencias/<int:sug_id>/votar', methods=['POST', 'OPTIONS'])
def votar_sugerencia(sug_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json() or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({"error": "user_id es requerido para votar"}), 400

    conn = get_db()
    cursor = conn.cursor()

    existing_vote = cursor.execute(
        "SELECT id FROM buzon_votos WHERE sugerencia_id = ? AND user_id = ?",
        (sug_id, user_id)
    ).fetchone()

    if existing_vote:
        cursor.execute("DELETE FROM buzon_votos WHERE id = ?", (existing_vote['id'],))
        cursor.execute("UPDATE buzon_sugerencias SET votos = MAX(0, votos - 1) WHERE id = ?", (sug_id,))
        voted = False
    else:
        cursor.execute("INSERT INTO buzon_votos (sugerencia_id, user_id) VALUES (?, ?)", (sug_id, user_id))
        cursor.execute("UPDATE buzon_sugerencias SET votos = votos + 1 WHERE id = ?", (sug_id,))
        voted = True

    conn.commit()
    sug = cursor.execute("SELECT votos FROM buzon_sugerencias WHERE id = ?", (sug_id,)).fetchone()
    conn.close()

    return jsonify({
        "success": True,
        "voted": voted,
        "votos": sug['votos'] if sug else 0
    }), 200


@buzon_bp.route('/api/sugerencias/<int:sug_id>/status', methods=['PUT', 'OPTIONS'])
def update_sugerencia_status(sug_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json() or {}
    nuevo_estado = data.get('estado')
    respuesta_admin = data.get('respuesta_admin')
    respondido_por = data.get('respondido_por') or 'Dirección'
    now_peru = get_peru_now_str()

    if not nuevo_estado:
        return jsonify({"error": "estado es requerido"}), 400

    conn = get_db()
    cursor = conn.cursor()
    sug = cursor.execute("SELECT * FROM buzon_sugerencias WHERE id = ?", (sug_id,)).fetchone()
    if not sug:
        conn.close()
        return jsonify({"error": "Sugerencia no encontrada"}), 404

    cursor.execute('''
        UPDATE buzon_sugerencias SET
            estado = ?,
            respuesta_admin = COALESCE(?, respuesta_admin),
            respondido_por = ?,
            respondido_at = ?,
            updated_at = ?
        WHERE id = ?
    ''', (nuevo_estado, respuesta_admin, respondido_por, now_peru, now_peru, sug_id))
    conn.commit()

    if sug['user_id'] and not sug['es_anonimo']:
        try:
            cursor.execute('''
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                VALUES (?, 'Actualización de tu sugerencia', ?, 'success', 0, ?)
            ''', (sug['user_id'], f'Tu propuesta "{sug["titulo"]}" ahora está: {nuevo_estado.upper()}', now_peru))
            conn.commit()
        except Exception:
            pass

    updated = cursor.execute("SELECT * FROM buzon_sugerencias WHERE id = ?", (sug_id,)).fetchone()
    conn.close()
    return jsonify({"success": True, "sugerencia": serialize_sugerencia_dict(updated)}), 200


@buzon_bp.route('/api/sugerencias/<int:sug_id>', methods=['DELETE', 'OPTIONS'])
def delete_sugerencia(sug_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    user_role = data.get('role')

    conn = get_db()
    cursor = conn.cursor()
    sug = cursor.execute("SELECT * FROM buzon_sugerencias WHERE id = ?", (sug_id,)).fetchone()
    if not sug:
        conn.close()
        return jsonify({"error": "Sugerencia no encontrada"}), 404

    if user_role != 'admin' and (not user_id or sug['user_id'] != user_id):
        conn.close()
        return jsonify({"error": "No tienes permiso para eliminar esta sugerencia"}), 403

    cursor.execute("DELETE FROM buzon_votos WHERE sugerencia_id = ?", (sug_id,))
    cursor.execute("DELETE FROM buzon_sugerencias WHERE id = ?", (sug_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Sugerencia eliminada correctamente"}), 200


@buzon_bp.route('/api/notifications', methods=['GET', 'DELETE', 'OPTIONS'])
def handle_notifications():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    user_id = request.args.get('user_id')

    if request.method == 'GET':
        if not user_id:
            conn.close()
            return jsonify([]), 200
        try:
            uid_num = int(user_id) if str(user_id).isdigit() else None
            check_and_notify_stagnant_activities(user_id=uid_num, cursor=cursor, conn=conn)
        except Exception as se:
            logger.warning("[Estancadas] Error verificando tareas: %s", se)

        rows = cursor.execute('''
            SELECT id, user_id, title, message, type, is_read, created_at as timestamp
            FROM notifications
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 50
        ''', (user_id,)).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d['id'] = str(d['id'])
            d['read'] = bool(d.pop('is_read', 0))
            result.append(d)
        conn.close()
        return jsonify(result), 200

    elif request.method == 'DELETE':
        if user_id:
            cursor.execute("DELETE FROM notifications WHERE user_id = ?", (user_id,))
            conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Notificaciones eliminadas"}), 200


@buzon_bp.route('/api/notifications/<int:notif_id>/read', methods=['PATCH', 'OPTIONS'])
def mark_notification_read(notif_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notif_id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True}), 200


@buzon_bp.route('/api/notifications/read-all', methods=['POST', 'OPTIONS'])
def mark_all_notifications_read():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    if user_id:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", (user_id,))
        conn.commit()
        conn.close()
    return jsonify({"success": True}), 200


@buzon_bp.route('/api/support/report-error', methods=['POST', 'OPTIONS'])
def report_support_error():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.get_json(silent=True) or {}
    user_name = data.get('user_name', 'Usuario anónimo')
    error_message = data.get('error_message', 'Error no especificado')
    context = data.get('context', 'General')
    screenshot_url = data.get('screenshot_url', '')

    conn = get_db()
    cursor = conn.cursor()
    try:
        admins = cursor.execute("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").fetchall()
        now_peru = get_peru_now_str()
        title = f"🚨 Incidencia Reportada: {user_name}"
        msg = f"[{context}] {error_message}"
        if screenshot_url:
            msg += f" | Captura: {screenshot_url}"

        for adm in admins:
            cursor.execute('''
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                VALUES (?, ?, ?, 'error', 0, ?)
            ''', (adm['id'], title, msg, now_peru))

        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Incidencia reportada con éxito a soporte técnico"}), 200
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500
