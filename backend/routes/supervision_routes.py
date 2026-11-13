from datetime import timedelta
from flask import Blueprint, request, jsonify

from database import get_db, get_peru_now, get_peru_today_str
from helpers import format_actividad_dict

supervision_bp = Blueprint('supervision_routes', __name__)


@supervision_bp.route('/api/equipo/actividades-en-vivo', methods=['GET', 'OPTIONS'])
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
        LEFT JOIN users u ON b.user_id = u.id
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
            elif req_u['role'] == 'lider':
                leader_teams = [r['id'] for r in cursor.execute("SELECT id FROM teams WHERE lider_id = ? OR id = ?", (req_u['id'], req_u['team_id'])).fetchall()]
                if not team_id or team_id == 'all':
                    if leader_teams:
                        placeholders = ','.join(['?'] * len(leader_teams))
                        query += f" AND (u.team_id IN ({placeholders}) OR u.id = ? OR b.user_id = ? OR EXISTS (SELECT 1 FROM teams tl WHERE tl.id IN ({placeholders}) AND tl.lider_id = u.id))"
                        params.extend(leader_teams + [req_u['id'], req_u['id']] + leader_teams)
                    else:
                        query += " AND (b.user_id = ? OR LOWER(b.colaborador) = LOWER(?))"
                        params.extend([req_u['id'], req_u['full_name']])

    if team_id and team_id != 'all':
        query += " AND (u.team_id = ? OR EXISTS (SELECT 1 FROM teams tl WHERE tl.id = ? AND tl.lider_id = u.id))"
        params.extend([team_id, team_id])

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


@supervision_bp.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    team_id = request.args.get('team_id')
    user_id = request.args.get('user_id')
    fecha = request.args.get('fecha')
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    requesting_user_id = request.args.get('requesting_user_id')

    conn = get_db()
    cursor = conn.cursor()

    if requesting_user_id:
        req_u = cursor.execute("SELECT id, role, team_id FROM users WHERE id = ?", (requesting_user_id,)).fetchone()
        if req_u:
            if req_u['role'] in ('analista', 'operador'):
                user_id = req_u['id']
                team_id = None
            elif req_u['role'] == 'lider':
                if not team_id:
                    leader_t = cursor.execute("SELECT id FROM teams WHERE lider_id = ? OR id = ? LIMIT 1", (req_u['id'], req_u['team_id'])).fetchone()
                    if leader_t:
                        team_id = leader_t['id']
                    elif req_u['team_id']:
                        team_id = req_u['team_id']

    base_filter = "WHERE 1=1"
    params = []

    if team_id:
        base_filter += " AND (u.team_id = ? OR EXISTS (SELECT 1 FROM teams tl WHERE tl.id = ? AND tl.lider_id = u.id))"
        params.extend([team_id, team_id])
    if user_id:
        base_filter += " AND (b.user_id = ? OR u.id = ?)"
        params.extend([user_id, user_id])
    if fecha:
        base_filter += " AND b.fecha = ?"
        params.append(fecha)
    if fecha_desde:
        base_filter += " AND b.fecha >= ?"
        params.append(fecha_desde)
    if fecha_hasta:
        base_filter += " AND b.fecha <= ?"
        params.append(fecha_hasta)

    total_query = f'''
        SELECT COUNT(DISTINCT b.id) as total_bitacoras,
               COALESCE(SUM(b.tiempo_total_min), 0) as total_minutos,
               COUNT(DISTINCT b.colaborador) as total_colaboradores
        FROM bitacoras b
        LEFT JOIN users u ON b.user_id = u.id
        {base_filter}
    '''
    totales = cursor.execute(total_query, params).fetchone()

    act_filter_query = f'''
        SELECT a.estado, COUNT(a.id) as cantidad, COALESCE(SUM(a.duracion_min), 0) as minutos
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        LEFT JOIN users u ON b.user_id = u.id
        {base_filter} AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        GROUP BY a.estado
    '''
    act_stats = cursor.execute(act_filter_query, params).fetchall()

    tipo_query = f'''
        SELECT COALESCE(NULLIF(a.tipo_trabajo, ''), 'No clasificado') as tipo,
               COUNT(a.id) as cantidad,
               COALESCE(SUM(a.duracion_min), 0) as minutos
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        LEFT JOIN users u ON b.user_id = u.id
        {base_filter} AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        GROUP BY tipo
        ORDER BY minutos DESC
    '''
    tipo_stats = cursor.execute(tipo_query, params).fetchall()

    cliente_query = f'''
        SELECT COALESCE(NULLIF(a.para_cliente, ''), 'General / Interno') as cliente,
               COUNT(a.id) as cantidad,
               COALESCE(SUM(a.duracion_min), 0) as minutos
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        LEFT JOIN users u ON b.user_id = u.id
        {base_filter} AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        GROUP BY cliente
        ORDER BY minutos DESC
        LIMIT 10
    '''
    cliente_stats = cursor.execute(cliente_query, params).fetchall()

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
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        LEFT JOIN actividades a ON a.bitacora_id = b.id AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        {base_filter}
        GROUP BY b.colaborador
        ORDER BY total_minutos DESC
    '''
    colab_stats = cursor.execute(colab_query, params).fetchall()

    seven_days_ago_peru = (get_peru_now() - timedelta(days=7)).strftime('%Y-%m-%d')
    apoyo_query = f'''
        SELECT b.id, b.fecha, b.colaborador, b.apoyo_detalle, b.pendientes, t.nombre as team_name
        FROM bitacoras b
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN teams t ON u.team_id = t.id
        {base_filter} AND b.necesita_apoyo = 'Si' AND b.fecha >= ?
        ORDER BY b.fecha DESC, b.id DESC
        LIMIT 10
    '''
    alertas_apoyo = cursor.execute(apoyo_query, [*params, seven_days_ago_peru]).fetchall()

    tendencia_query = f'''
        SELECT b.fecha,
               COUNT(a.id) as actividades,
               COALESCE(SUM(a.duracion_min), 0) as minutos,
               SUM(CASE WHEN a.estado = 'completada' THEN 1 ELSE 0 END) as completadas
        FROM bitacoras b
        LEFT JOIN actividades a ON a.bitacora_id = b.id AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        LEFT JOIN users u ON b.user_id = u.id
        {base_filter}
        GROUP BY b.fecha
        ORDER BY b.fecha ASC
        LIMIT 30
    '''
    tendencia_diaria = cursor.execute(tendencia_query, params).fetchall()

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
        LEFT JOIN users u ON b.user_id = u.id
        {base_filter} AND (a.is_deleted IS NULL OR a.is_deleted = 0) AND a.hora_inicio IS NOT NULL AND a.hora_inicio != ''
        GROUP BY franja
        ORDER BY MIN(a.hora_inicio) ASC
    '''
    distribucion_horaria = cursor.execute(horaria_query, params).fetchall()

    tot_min = totales['total_minutos'] if totales else 0
    tot_bit = totales['total_bitacoras'] if totales else 0
    promedio_jornada = round(tot_min / tot_bit) if tot_bit > 0 else 0

    total_acts = sum(r['cantidad'] for r in act_stats) if act_stats else 0
    completed_acts = sum(r['cantidad'] for r in act_stats if r['estado'] == 'completada') if act_stats else 0
    eficiencia = round((completed_acts / total_acts) * 100) if total_acts > 0 else 0

    planificadas_min = sum(r['minutos'] for r in tipo_stats if 'planificad' in (r['tipo'] or '').lower()) if tipo_stats else 0
    ratio_planificado = round((planificadas_min / tot_min) * 100) if tot_min > 0 else 0

    jornadas_usuario = []
    if user_id:
        jornadas_query = f'''
            SELECT b.id, b.fecha, b.tiempo_total_min, b.necesita_apoyo, b.apoyo_detalle,
                   COUNT(a.id) as total_actividades,
                   SUM(CASE WHEN a.estado = 'completada' THEN 1 ELSE 0 END) as actividades_completadas
            FROM bitacoras b
            LEFT JOIN actividades a ON a.bitacora_id = b.id AND (a.is_deleted IS NULL OR a.is_deleted = 0)
            LEFT JOIN users u ON b.user_id = u.id
            {base_filter}
            GROUP BY b.id
            ORDER BY b.fecha DESC
            LIMIT 15
        '''
        jornadas_usuario = cursor.execute(jornadas_query, params).fetchall()

    conn.close()

    return jsonify({
        "resumen": dict(totales) if totales else {},
        "por_estado": [dict(r) for r in act_stats],
        "por_tipo": [dict(r) for r in tipo_stats],
        "por_cliente": [dict(r) for r in cliente_stats],
        "por_colaborador": [dict(r) for r in colab_stats],
        "alertas_apoyo": [dict(r) for r in alertas_apoyo],
        "tendencia_diaria": [dict(r) for r in tendencia_diaria],
        "distribucion_horaria": [dict(r) for r in distribucion_horaria],
        "jornadas_recientes": [dict(r) for r in jornadas_usuario],
        "kpis_adicionales": {
            "promedio_minutos_jornada": promedio_jornada,
            "eficiencia": eficiencia,
            "ratio_planificado": ratio_planificado,
            "total_actividades": total_acts,
            "actividades_completadas": completed_acts
        }
    })
