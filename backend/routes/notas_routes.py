import json
import logging
import time
from flask import Blueprint, request, jsonify, g

from database import get_db, get_peru_now_str, get_peru_today_str
from security import user_can_access_owner
from helpers import (
    strip_html_text,
    sanitize_evidencias,
    calculate_hora_fin,
    fetch_enriched_bitacora_activities,
    get_default_hora_inicio,
    _sync_note_activity_links,
)
from routes.system_routes import normalize_client_name
from activity_lifecycle import recalculate_bitacora_durations, propagate_completion_across_lineage

logger = logging.getLogger('bitacora.notas')
notas_bp = Blueprint('notas_routes', __name__)

VALID_TIPOS_NOTA = ('apunte', 'checklist', 'reunion', 'tecnica')
VALID_VISIBILIDAD = ('personal', 'compartida', 'equipo')
VALID_COLORES = ('slate', 'sky', 'emerald', 'amber', 'rose')
VALID_ESTADOS = ('activa', 'archivada')


def _parse_json_list(val):
    if isinstance(val, list):
        return val
    if isinstance(val, str) and val.strip():
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _normalize_checklist(items):
    raw_list = _parse_json_list(items)
    cleaned = []
    for idx, item in enumerate(raw_list):
        if isinstance(item, str):
            txt = item.strip()
            if txt:
                cleaned.append({
                    'id': f'chk-{idx + 1}-{int(time.time() * 1000) % 100000}',
                    'texto': txt,
                    'completado': False,
                    'actividad_id': None,
                })
        elif isinstance(item, dict):
            txt = str(item.get('texto') or item.get('text') or '').strip()
            if not txt:
                continue
            item_id = str(item.get('id') or f'chk-{idx + 1}-{int(time.time() * 1000) % 100000}')[:64]
            act_id = item.get('actividad_id')
            act_id_num = int(act_id) if act_id is not None and str(act_id).isdigit() else None
            cleaned.append({
                'id': item_id,
                'texto': txt[:500],
                'completado': bool(item.get('completado')),
                'actividad_id': act_id_num,
            })
    return cleaned


def _normalize_etiquetas(tags):
    raw = _parse_json_list(tags) if not isinstance(tags, str) or tags.strip().startswith('[') else [
        t.strip() for t in str(tags).split(',')
    ]
    seen = set()
    cleaned = []
    for t in raw:
        val = str(t or '').strip().lower()[:40]
        if val and val not in seen:
            seen.add(val)
            cleaned.append(val)
    return cleaned[:20]


def _normalize_shared_with(sw, owner_id=None):
    raw = _parse_json_list(sw)
    seen = set()
    cleaned = []
    for x in raw:
        if x is not None and str(x).isdigit():
            uid = int(x)
            if (owner_id is None or uid != int(owner_id)) and uid not in seen:
                seen.add(uid)
                cleaned.append(uid)
    return cleaned


def _get_acting_user(cursor, fallback_uid=None):
    u = getattr(g, 'current_user', None)
    if u and u.get('id'):
        return u
    if fallback_uid:
        row = cursor.execute(
            "SELECT id, username, full_name, role, team_id FROM users WHERE id = ?",
            (int(fallback_uid),),
        ).fetchone()
        if row:
            return dict(row)
    return None


def _get_leader_team_ids(cursor, user):
    if not user:
        return set()
    rows = cursor.execute(
        "SELECT id FROM teams WHERE lider_id = ? OR id = ?",
        (user['id'], user.get('team_id')),
    ).fetchall()
    return {int(r['id']) for r in rows}


def _can_read_nota(cursor, user, nota_row):
    if not user or not nota_row:
        return False
    uid = int(user['id'])
    owner_id = int(nota_row['user_id'])
    vis = nota_row['visibilidad'] or 'personal'

    # Notas personales: privacidad estricta para el autor (ni líderes ni admins las leen)
    if vis == 'personal':
        return owner_id == uid

    if owner_id == uid:
        return True

    if vis == 'compartida':
        sw = _parse_json_list(nota_row['shared_with'])
        return uid in [int(x) for x in sw if str(x).isdigit()]

    if vis == 'equipo':
        if user.get('role') == 'admin':
            return True
        team_id = nota_row['team_id']
        if team_id and int(team_id) in _get_leader_team_ids(cursor, user):
            return True
        # También permitir si el dueño pertenece al mismo equipo
        owner_row = cursor.execute("SELECT team_id FROM users WHERE id = ?", (owner_id,)).fetchone()
        if owner_row and owner_row['team_id'] and int(owner_row['team_id']) in _get_leader_team_ids(cursor, user):
            return True
        return False

    return False


def _can_edit_nota(cursor, user, nota_row):
    if not user or not nota_row:
        return False
    uid = int(user['id'])
    owner_id = int(nota_row['user_id'])
    vis = nota_row['visibilidad'] or 'personal'

    if vis == 'personal':
        return owner_id == uid
    if owner_id == uid:
        return True
    if vis == 'compartida':
        sw = _parse_json_list(nota_row['shared_with'])
        return uid in [int(x) for x in sw if str(x).isdigit()]
    if vis == 'equipo':
        if user.get('role') == 'admin':
            return True
        team_id = nota_row['team_id']
        if team_id and int(team_id) in _get_leader_team_ids(cursor, user):
            return True
    return False


def _fetch_nota_links_summary(cursor, nota_ids):
    if not nota_ids:
        return {}
    placeholders = ','.join('?' * len(nota_ids))
    rows = cursor.execute(
        f'''
        SELECT nav.nota_id, nav.actividad_id, nav.tipo_relacion, nav.checklist_item_id,
               a.estado, a.duracion_min
        FROM nota_actividad_vinculos nav
        JOIN actividades a ON nav.actividad_id = a.id
        WHERE nav.nota_id IN ({placeholders})
          AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        ''',
        list(nota_ids),
    ).fetchall()
    summary = {}
    for r in rows:
        nid = r['nota_id']
        st = summary.setdefault(nid, {
            'actividades_count': 0,
            'actividades_completadas': 0,
            'actividades_abiertas': 0,
            'tiempo_total_min': 0,
        })
        st['actividades_count'] += 1
        if r['estado'] == 'completada':
            st['actividades_completadas'] += 1
        else:
            st['actividades_abiertas'] += 1
        st['tiempo_total_min'] += int(r['duracion_min'] or 0)
    return summary


def _fetch_nota_linked_activities(cursor, nota_id):
    rows = cursor.execute(
        '''
        SELECT a.id, a.bitacora_id, a.hora_inicio, a.hora_fin, a.duracion_min,
               a.tipo_trabajo, a.descripcion, a.para_cliente, a.estado,
               b.fecha, b.colaborador, b.user_id,
               nav.tipo_relacion, nav.checklist_item_id, nav.created_at AS vinculado_at
        FROM nota_actividad_vinculos nav
        JOIN actividades a ON nav.actividad_id = a.id
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE nav.nota_id = ? AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        ORDER BY b.fecha DESC, a.id DESC
        ''',
        (nota_id,),
    ).fetchall()
    result = []
    for r in rows:
        plain = strip_html_text(r['descripcion'] or '')
        result.append({
            'id': r['id'],
            'bitacora_id': r['bitacora_id'],
            'fecha': r['fecha'],
            'hora_inicio': r['hora_inicio'] or '',
            'hora_fin': r['hora_fin'] or '',
            'duracion_min': int(r['duracion_min'] or 0),
            'tipo_trabajo': r['tipo_trabajo'] or '',
            'descripcion': r['descripcion'] or '',
            'descripcion_plana': (plain[:177] + '...') if len(plain) > 180 else plain,
            'para_cliente': r['para_cliente'] or '',
            'estado': r['estado'] or 'en_proceso',
            'colaborador': r['colaborador'] or '',
            'user_id': r['user_id'],
            'tipo_relacion': r['tipo_relacion'] or 'contexto',
            'checklist_item_id': r['checklist_item_id'],
            'vinculado_at': r['vinculado_at'],
        })
    return result


def _format_nota(cursor, row, users_map=None, links_summary=None, include_activities=False):
    d = dict(row)
    nid = d['id']
    d['checklist_json'] = _normalize_checklist(d.get('checklist_json'))
    d['etiquetas'] = _normalize_etiquetas(d.get('etiquetas'))
    d['shared_with'] = _normalize_shared_with(d.get('shared_with'), d.get('user_id'))
    d['evidencias'] = sanitize_evidencias(d.get('evidencias'), d.get('contenido') or '')
    d['is_pinned'] = bool(d.get('is_pinned'))
    d['is_deleted'] = bool(d.get('is_deleted'))
    d['contenido_plano'] = strip_html_text(d.get('contenido') or '')

    if users_map is None:
        users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}

    d['author_name'] = users_map.get(d.get('user_id'), '')
    d['shared_with_names'] = [users_map[uid] for uid in d['shared_with'] if uid in users_map]

    stats = (links_summary or {}).get(nid)
    if stats is None:
        stats = _fetch_nota_links_summary(cursor, [nid]).get(nid, {
            'actividades_count': 0,
            'actividades_completadas': 0,
            'actividades_abiertas': 0,
            'tiempo_total_min': 0,
        })

    d.update(stats)
    if d['is_deleted']:
        d['estado_operativo'] = 'papelera'
    elif d.get('estado') == 'archivada':
        d['estado_operativo'] = 'archivada'
    elif stats['actividades_abiertas'] > 0:
        d['estado_operativo'] = 'en_ejecucion'
    elif stats['actividades_count'] > 0:
        d['estado_operativo'] = 'convertida'
    else:
        d['estado_operativo'] = 'activa'

    if include_activities:
        d['actividades_vinculadas'] = _fetch_nota_linked_activities(cursor, nid)

    return d


@notas_bp.route('/api/notas', methods=['GET', 'POST', 'OPTIONS'])
def handle_notas():
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    user = _get_acting_user(cursor, request.args.get('requesting_user_id'))
    if not user:
        conn.close()
        return jsonify({"error": "Usuario no autenticado"}), 401

    uid = int(user['id'])
    now_peru = get_peru_now_str()

    if request.method == 'POST':
        data = request.get_json() or {}
        titulo = (data.get('titulo') or '').strip()
        if not titulo:
            conn.close()
            return jsonify({"error": "El título de la nota es obligatorio"}), 400

        contenido = data.get('contenido') or ''
        tipo_nota = (data.get('tipo_nota') or 'apunte').strip().lower()
        if tipo_nota not in VALID_TIPOS_NOTA:
            tipo_nota = 'apunte'
        visibilidad = (data.get('visibilidad') or 'personal').strip().lower()
        if visibilidad not in VALID_VISIBILIDAD:
            visibilidad = 'personal'
        color_acento = (data.get('color_acento') or 'slate').strip().lower()
        if color_acento not in VALID_COLORES:
            color_acento = 'slate'
        estado = (data.get('estado') or 'activa').strip().lower()
        if estado not in VALID_ESTADOS:
            estado = 'activa'

        checklist = _normalize_checklist(data.get('checklist_json'))
        etiquetas = _normalize_etiquetas(data.get('etiquetas'))
        shared_with = _normalize_shared_with(data.get('shared_with'), uid) if visibilidad == 'compartida' else []
        evidencias = sanitize_evidencias(data.get('evidencias', []), contenido)
        para_cliente = normalize_client_name(data.get('para_cliente') or '')
        is_pinned = 1 if data.get('is_pinned') else 0
        fecha_recordatorio = (data.get('fecha_recordatorio') or '').strip()[:10] or None

        team_id = None
        if visibilidad == 'equipo':
            req_tid = data.get('team_id')
            if req_tid and str(req_tid).isdigit():
                team_id = int(req_tid)
            else:
                u_row = cursor.execute("SELECT team_id FROM users WHERE id = ?", (uid,)).fetchone()
                team_id = u_row['team_id'] if u_row else None

        cursor.execute(
            '''
            INSERT INTO notas (
                user_id, team_id, titulo, contenido, tipo_nota, checklist_json,
                para_cliente, etiquetas, color_acento, visibilidad, shared_with,
                evidencias, estado, is_pinned, fecha_recordatorio, is_deleted,
                created_by_user_id, updated_by_user_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
            ''',
            (
                uid, team_id, titulo[:250], contenido, tipo_nota, json.dumps(checklist),
                para_cliente, json.dumps(etiquetas), color_acento, visibilidad, json.dumps(shared_with),
                json.dumps(evidencias), estado, is_pinned, fecha_recordatorio,
                uid, uid, now_peru, now_peru,
            ),
        )
        nota_id = cursor.lastrowid

        # Vínculos opcionales iniciales
        act_ids = data.get('actividad_ids') or []
        if isinstance(act_ids, list):
            for raw_aid in act_ids:
                if raw_aid is not None and str(raw_aid).isdigit():
                    aid = int(raw_aid)
                    act_row = cursor.execute(
                        "SELECT a.id, b.user_id FROM actividades a JOIN bitacoras b ON a.bitacora_id = b.id WHERE a.id = ?",
                        (aid,),
                    ).fetchone()
                    if act_row and user_can_access_owner(user, act_row['user_id']):
                        cursor.execute(
                            '''
                            INSERT OR IGNORE INTO nota_actividad_vinculos
                            (nota_id, actividad_id, tipo_relacion, created_by, created_at)
                            VALUES (?, ?, ?, ?, ?)
                            ''',
                            (nota_id, aid, data.get('tipo_relacion') or 'contexto', uid, now_peru),
                        )

        conn.commit()
        created_row = cursor.execute("SELECT * FROM notas WHERE id = ?", (nota_id,)).fetchone()
        formatted = _format_nota(cursor, created_row, include_activities=True)
        conn.close()
        return jsonify({"success": True, "nota": formatted}), 201

    # GET /api/notas — Búsqueda global y filtros combinados
    q = (request.args.get('q') or '').strip().lower()
    estado_filter = (request.args.get('estado') or 'activas_y_ejecucion').strip().lower()
    alcance = (request.args.get('alcance') or 'todas').strip().lower()
    tipo_nota = (request.args.get('tipo_nota') or '').strip().lower()
    cliente = (request.args.get('cliente') or '').strip().lower()
    etiqueta = (request.args.get('etiqueta') or '').strip().lower()
    fecha_desde = (request.args.get('fecha_desde') or '').strip()[:10]
    fecha_hasta = (request.args.get('fecha_hasta') or '').strip()[:10]
    fecha_recordatorio = (request.args.get('fecha_recordatorio') or '').strip()[:10]
    actividad_id = request.args.get('actividad_id', type=int)

    try:
        limit = max(1, min(200, int(request.args.get('limit') or 50)))
    except (TypeError, ValueError):
        limit = 50
    try:
        offset = max(0, int(request.args.get('offset') or 0))
    except (TypeError, ValueError):
        offset = 0

    where_sql = "WHERE 1=1"
    params = []

    if estado_filter == 'papelera':
        where_sql += " AND n.is_deleted = 1"
    else:
        where_sql += " AND (n.is_deleted IS NULL OR n.is_deleted = 0)"
        if estado_filter == 'archivada':
            where_sql += " AND n.estado = 'archivada'"
        elif estado_filter in ('activa', 'activas_y_ejecucion', 'en_ejecucion', 'convertida'):
            where_sql += " AND n.estado = 'activa'"

    if alcance == 'mis':
        where_sql += " AND n.user_id = ?"
        params.append(uid)
    elif alcance == 'compartidas':
        where_sql += " AND n.visibilidad = 'compartida' AND n.user_id != ?"
        params.append(uid)
    elif alcance == 'equipo':
        where_sql += " AND n.visibilidad = 'equipo'"

    if tipo_nota and tipo_nota in VALID_TIPOS_NOTA:
        where_sql += " AND n.tipo_nota = ?"
        params.append(tipo_nota)
    if cliente:
        where_sql += " AND LOWER(COALESCE(n.para_cliente, '')) LIKE ?"
        params.append(f"%{cliente}%")
    if fecha_desde:
        where_sql += " AND substr(n.created_at, 1, 10) >= ?"
        params.append(fecha_desde)
    if fecha_hasta:
        where_sql += " AND substr(n.created_at, 1, 10) <= ?"
        params.append(fecha_hasta)
    if fecha_recordatorio:
        where_sql += " AND n.fecha_recordatorio = ?"
        params.append(fecha_recordatorio)
    if actividad_id:
        where_sql += " AND EXISTS (SELECT 1 FROM nota_actividad_vinculos nav WHERE nav.nota_id = n.id AND nav.actividad_id = ?)"
        params.append(actividad_id)

    rows = cursor.execute(
        f'''
        SELECT n.* FROM notas n
        {where_sql}
        ORDER BY n.is_pinned DESC, n.updated_at DESC, n.id DESC
        ''',
        params,
    ).fetchall()

    # Filtrar visibilidad estricta y búsqueda de texto libre / etiquetas / estado_operativo
    visible_rows = [r for r in rows if _can_read_nota(cursor, user, r)]
    links_summary = _fetch_nota_links_summary(cursor, [r['id'] for r in visible_rows])
    users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}

    formatted_all = []
    for r in visible_rows:
        item = _format_nota(cursor, r, users_map=users_map, links_summary=links_summary, include_activities=False)

        if estado_filter == 'en_ejecucion' and item['estado_operativo'] != 'en_ejecucion':
            continue
        if estado_filter == 'convertida' and item['estado_operativo'] != 'convertida':
            continue

        if etiqueta and etiqueta not in item['etiquetas']:
            continue

        if q:
            chk_text = ' '.join(c.get('texto', '') for c in item['checklist_json']).lower()
            tags_text = ' '.join(item['etiquetas']).lower()
            haystack = ' '.join([
                item['titulo'].lower(),
                item['contenido_plano'].lower(),
                chk_text,
                (item.get('para_cliente') or '').lower(),
                tags_text,
                (item.get('author_name') or '').lower(),
            ])
            if q not in haystack:
                continue

        formatted_all.append(item)

    total_count = len(formatted_all)
    paged = formatted_all[offset:offset + limit]
    conn.close()

    resp = jsonify(paged)
    resp.headers['X-Total-Count'] = str(total_count)
    resp.headers['X-Has-More'] = '1' if (offset + len(paged)) < total_count else '0'
    return resp, 200


@notas_bp.route('/api/notas/<int:nota_id>', methods=['GET', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'])
def handle_nota_detail(nota_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    user = _get_acting_user(cursor)
    if not user:
        conn.close()
        return jsonify({"error": "Usuario no autenticado"}), 401

    nota = cursor.execute("SELECT * FROM notas WHERE id = ?", (nota_id,)).fetchone()
    if not nota:
        conn.close()
        return jsonify({"error": "Nota no encontrada"}), 404

    if request.method == 'GET':
        if not _can_read_nota(cursor, user, nota):
            conn.close()
            return jsonify({"error": "No tienes permiso para ver esta nota"}), 403
        formatted = _format_nota(cursor, nota, include_activities=True)
        conn.close()
        return jsonify(formatted), 200

    if request.method in ('PATCH', 'PUT'):
        if not _can_edit_nota(cursor, user, nota):
            conn.close()
            return jsonify({"error": "No tienes permiso para editar esta nota"}), 403

        data = request.get_json() or {}
        now_peru = get_peru_now_str()
        uid = int(user['id'])
        is_owner = int(nota['user_id']) == uid

        updates = []
        params = []

        if 'titulo' in data:
            new_title = (data.get('titulo') or '').strip()
            if not new_title:
                conn.close()
                return jsonify({"error": "El título no puede quedar vacío"}), 400
            updates.append("titulo = ?")
            params.append(new_title[:250])

        if 'contenido' in data:
            updates.append("contenido = ?")
            params.append(data.get('contenido') or '')

        if 'tipo_nota' in data:
            tn = str(data.get('tipo_nota') or 'apunte').strip().lower()
            if tn in VALID_TIPOS_NOTA:
                updates.append("tipo_nota = ?")
                params.append(tn)

        if 'checklist_json' in data:
            chk = _normalize_checklist(data.get('checklist_json'))
            updates.append("checklist_json = ?")
            params.append(json.dumps(chk))

        if 'para_cliente' in data:
            updates.append("para_cliente = ?")
            params.append(normalize_client_name(data.get('para_cliente') or ''))

        if 'etiquetas' in data:
            tags = _normalize_etiquetas(data.get('etiquetas'))
            updates.append("etiquetas = ?")
            params.append(json.dumps(tags))

        if 'color_acento' in data:
            col = str(data.get('color_acento') or 'slate').strip().lower()
            if col in VALID_COLORES:
                updates.append("color_acento = ?")
                params.append(col)

        if 'evidencias' in data:
            ref_contenido = data.get('contenido') if 'contenido' in data else (nota['contenido'] or '')
            evs = sanitize_evidencias(data.get('evidencias'), ref_contenido)
            updates.append("evidencias = ?")
            params.append(json.dumps(evs))

        if 'estado' in data:
            st = str(data.get('estado') or 'activa').strip().lower()
            if st in VALID_ESTADOS:
                updates.append("estado = ?")
                params.append(st)

        if 'is_pinned' in data:
            updates.append("is_pinned = ?")
            params.append(1 if data.get('is_pinned') else 0)

        if 'fecha_recordatorio' in data:
            fr = (data.get('fecha_recordatorio') or '').strip()[:10] or None
            updates.append("fecha_recordatorio = ?")
            params.append(fr)

        # Solo el propietario (o admin en nota de equipo) cambia visibilidad y compartición
        if 'visibilidad' in data and (is_owner or (user.get('role') == 'admin' and nota['visibilidad'] == 'equipo')):
            vis = str(data.get('visibilidad') or 'personal').strip().lower()
            if vis in VALID_VISIBILIDAD:
                updates.append("visibilidad = ?")
                params.append(vis)
                if vis == 'equipo':
                    u_row = cursor.execute("SELECT team_id FROM users WHERE id = ?", (nota['user_id'],)).fetchone()
                    updates.append("team_id = ?")
                    params.append(u_row['team_id'] if u_row else None)
                elif vis == 'personal':
                    updates.append("shared_with = ?")
                    params.append('[]')

        if 'shared_with' in data and is_owner:
            sw = _normalize_shared_with(data.get('shared_with'), nota['user_id'])
            updates.append("shared_with = ?")
            params.append(json.dumps(sw))

        if updates:
            updates.extend(["updated_by_user_id = ?", "updated_at = ?"])
            params.extend([uid, now_peru, nota_id])
            cursor.execute(f"UPDATE notas SET {', '.join(updates)} WHERE id = ?", params)
            conn.commit()

        updated_row = cursor.execute("SELECT * FROM notas WHERE id = ?", (nota_id,)).fetchone()
        formatted = _format_nota(cursor, updated_row, include_activities=True)
        conn.close()
        return jsonify({"success": True, "nota": formatted}), 200

    # DELETE /api/notas/<id>
    is_owner = int(nota['user_id']) == int(user['id'])
    is_admin_team = user.get('role') == 'admin' and nota['visibilidad'] == 'equipo'
    if not (is_owner or is_admin_team):
        conn.close()
        return jsonify({"error": "Solo el autor de la nota puede eliminarla"}), 403

    permanent = str(request.args.get('permanent') or '').lower() in ('1', 'true', 'yes')
    if permanent and nota['is_deleted']:
        cursor.execute("DELETE FROM notas WHERE id = ?", (nota_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "deleted": "permanent", "id": nota_id}), 200

    now_peru = get_peru_now_str()
    cursor.execute(
        "UPDATE notas SET is_deleted = 1, deleted_at = ?, updated_at = ?, updated_by_user_id = ? WHERE id = ?",
        (now_peru, now_peru, user['id'], nota_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"success": True, "deleted": "soft", "id": nota_id}), 200


@notas_bp.route('/api/notas/<int:nota_id>/restaurar', methods=['POST', 'OPTIONS'])
def restaurar_nota(nota_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    conn = get_db()
    cursor = conn.cursor()
    user = _get_acting_user(cursor)
    if not user:
        conn.close()
        return jsonify({"error": "Usuario no autenticado"}), 401

    nota = cursor.execute("SELECT * FROM notas WHERE id = ?", (nota_id,)).fetchone()
    if not nota:
        conn.close()
        return jsonify({"error": "Nota no encontrada"}), 404
    if not _can_edit_nota(cursor, user, nota):
        conn.close()
        return jsonify({"error": "Sin permiso para restaurar esta nota"}), 403

    now_peru = get_peru_now_str()
    cursor.execute(
        "UPDATE notas SET is_deleted = 0, deleted_at = NULL, updated_at = ?, updated_by_user_id = ? WHERE id = ?",
        (now_peru, user['id'], nota_id),
    )
    conn.commit()
    restored = cursor.execute("SELECT * FROM notas WHERE id = ?", (nota_id,)).fetchone()
    formatted = _format_nota(cursor, restored, include_activities=True)
    conn.close()
    return jsonify({"success": True, "nota": formatted}), 200


@notas_bp.route('/api/notas/<int:nota_id>/checklist', methods=['PATCH', 'OPTIONS'])
def update_nota_checklist(nota_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    conn = get_db()
    cursor = conn.cursor()
    user = _get_acting_user(cursor)
    if not user:
        conn.close()
        return jsonify({"error": "Usuario no autenticado"}), 401

    nota = cursor.execute("SELECT * FROM notas WHERE id = ?", (nota_id,)).fetchone()
    if not nota:
        conn.close()
        return jsonify({"error": "Nota no encontrada"}), 404
    if not _can_edit_nota(cursor, user, nota):
        conn.close()
        return jsonify({"error": "Sin permiso para modificar este checklist"}), 403

    data = request.get_json() or {}
    if 'checklist_json' in data:
        checklist = _normalize_checklist(data.get('checklist_json'))
    elif 'item_id' in data:
        checklist = _normalize_checklist(nota['checklist_json'])
        target_id = str(data.get('item_id'))
        found = False
        for item in checklist:
            if item['id'] == target_id:
                if 'completado' in data:
                    item['completado'] = bool(data.get('completado'))
                if 'texto' in data and str(data.get('texto')).strip():
                    item['texto'] = str(data.get('texto')).strip()[:500]
                found = True
                break
        if not found:
            conn.close()
            return jsonify({"error": "Ítem de checklist no encontrado"}), 404
    else:
        conn.close()
        return jsonify({"error": "Se requiere checklist_json o item_id"}), 400

    now_peru = get_peru_now_str()
    cursor.execute(
        "UPDATE notas SET checklist_json = ?, updated_at = ?, updated_by_user_id = ? WHERE id = ?",
        (json.dumps(checklist), now_peru, user['id'], nota_id),
    )
    conn.commit()
    updated = cursor.execute("SELECT * FROM notas WHERE id = ?", (nota_id,)).fetchone()
    formatted = _format_nota(cursor, updated, include_activities=True)
    conn.close()
    return jsonify({"success": True, "nota": formatted}), 200


@notas_bp.route('/api/notas/<int:nota_id>/vinculos', methods=['POST', 'OPTIONS'])
def add_nota_actividad_vinculo(nota_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    conn = get_db()
    cursor = conn.cursor()
    user = _get_acting_user(cursor)
    if not user:
        conn.close()
        return jsonify({"error": "Usuario no autenticado"}), 401

    nota = cursor.execute("SELECT * FROM notas WHERE id = ? AND (is_deleted IS NULL OR is_deleted = 0)", (nota_id,)).fetchone()
    if not nota:
        conn.close()
        return jsonify({"error": "Nota no encontrada"}), 404
    if not _can_edit_nota(cursor, user, nota):
        conn.close()
        return jsonify({"error": "Sin permiso para vincular actividades a esta nota"}), 403

    data = request.get_json() or {}
    act_id = data.get('actividad_id')
    if not act_id or not str(act_id).isdigit():
        conn.close()
        return jsonify({"error": "actividad_id válido es obligatorio"}), 400
    act_id = int(act_id)

    act = cursor.execute(
        "SELECT a.id, b.user_id FROM actividades a JOIN bitacoras b ON a.bitacora_id = b.id WHERE a.id = ? AND (a.is_deleted IS NULL OR a.is_deleted = 0)",
        (act_id,),
    ).fetchone()
    if not act:
        conn.close()
        return jsonify({"error": "Actividad no encontrada"}), 404
    if not user_can_access_owner(user, act['user_id']):
        conn.close()
        return jsonify({"error": "Sin permiso para vincular esta actividad"}), 403

    tipo_relacion = (data.get('tipo_relacion') or 'contexto').strip()[:30]
    checklist_item_id = (data.get('checklist_item_id') or '').strip()[:64] or None
    now_peru = get_peru_now_str()

    cursor.execute(
        '''
        INSERT INTO nota_actividad_vinculos (nota_id, actividad_id, tipo_relacion, checklist_item_id, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(nota_id, actividad_id) DO UPDATE SET
            tipo_relacion = excluded.tipo_relacion,
            checklist_item_id = COALESCE(excluded.checklist_item_id, nota_actividad_vinculos.checklist_item_id)
        ''',
        (nota_id, act_id, tipo_relacion, checklist_item_id, user['id'], now_peru),
    )

    if checklist_item_id:
        checklist = _normalize_checklist(nota['checklist_json'])
        for item in checklist:
            if item['id'] == checklist_item_id:
                item['actividad_id'] = act_id
        cursor.execute(
            "UPDATE notas SET checklist_json = ?, updated_at = ?, updated_by_user_id = ? WHERE id = ?",
            (json.dumps(checklist), now_peru, user['id'], nota_id),
        )
    else:
        cursor.execute("UPDATE notas SET updated_at = ? WHERE id = ?", (now_peru, nota_id))

    conn.commit()
    updated = cursor.execute("SELECT * FROM notas WHERE id = ?", (nota_id,)).fetchone()
    formatted = _format_nota(cursor, updated, include_activities=True)
    conn.close()
    return jsonify({"success": True, "nota": formatted}), 200


@notas_bp.route('/api/notas/<int:nota_id>/vinculos/<int:actividad_id>', methods=['DELETE', 'OPTIONS'])
def remove_nota_actividad_vinculo(nota_id, actividad_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    conn = get_db()
    cursor = conn.cursor()
    user = _get_acting_user(cursor)
    if not user:
        conn.close()
        return jsonify({"error": "Usuario no autenticado"}), 401

    nota = cursor.execute("SELECT * FROM notas WHERE id = ?", (nota_id,)).fetchone()
    if not nota:
        conn.close()
        return jsonify({"error": "Nota no encontrada"}), 404
    if not _can_edit_nota(cursor, user, nota):
        conn.close()
        return jsonify({"error": "Sin permiso para desvincular actividades de esta nota"}), 403

    cursor.execute(
        "DELETE FROM nota_actividad_vinculos WHERE nota_id = ? AND actividad_id = ?",
        (nota_id, actividad_id),
    )
    checklist = _normalize_checklist(nota['checklist_json'])
    changed_chk = False
    for item in checklist:
        if item.get('actividad_id') == actividad_id:
            item['actividad_id'] = None
            changed_chk = True

    now_peru = get_peru_now_str()
    if changed_chk:
        cursor.execute(
            "UPDATE notas SET checklist_json = ?, updated_at = ?, updated_by_user_id = ? WHERE id = ?",
            (json.dumps(checklist), now_peru, user['id'], nota_id),
        )
    conn.commit()
    updated = cursor.execute("SELECT * FROM notas WHERE id = ?", (nota_id,)).fetchone()
    formatted = _format_nota(cursor, updated, include_activities=True)
    conn.close()
    return jsonify({"success": True, "nota": formatted}), 200


@notas_bp.route('/api/notas/<int:nota_id>/convertir', methods=['POST', 'OPTIONS'])
def convertir_nota_en_actividad(nota_id):
    """Convierte atómicamente una nota (o uno de sus ítems de checklist) en actividad de bitácora y la vincula."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    cursor = conn.cursor()
    user = _get_acting_user(cursor)
    if not user:
        conn.close()
        return jsonify({"error": "Usuario no autenticado"}), 401

    nota = cursor.execute("SELECT * FROM notas WHERE id = ? AND (is_deleted IS NULL OR is_deleted = 0)", (nota_id,)).fetchone()
    if not nota:
        conn.close()
        return jsonify({"error": "Nota no encontrada"}), 404
    if not _can_read_nota(cursor, user, nota):
        conn.close()
        return jsonify({"error": "Sin permiso para acceder a esta nota"}), 403

    data = request.get_json() or {}
    now_peru = get_peru_now_str()
    fecha = (data.get('fecha') or get_peru_today_str()).strip()[:10]
    checklist_item_id = (data.get('checklist_item_id') or '').strip()[:64] or None

    target_uid = data.get('target_user_id')
    if target_uid and str(target_uid).isdigit() and int(target_uid) != int(user['id']):
        target_uid = int(target_uid)
        if not user_can_access_owner(user, target_uid):
            conn.close()
            return jsonify({"error": "Sin permiso de apoyo para este colaborador"}), 403
        t_row = cursor.execute(
            "SELECT u.id, u.full_name, COALESCE(t.nombre, 'Sistemas') AS area FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ?",
            (target_uid,),
        ).fetchone()
        if not t_row:
            conn.close()
            return jsonify({"error": "Colaborador destino no encontrado"}), 404
        target_name = t_row['full_name']
        target_area = t_row['area']
    else:
        target_uid = int(user['id'])
        u_row = cursor.execute(
            "SELECT u.id, u.full_name, COALESCE(t.nombre, 'Sistemas') AS area FROM users u LEFT JOIN teams t ON u.team_id = t.id WHERE u.id = ?",
            (target_uid,),
        ).fetchone()
        target_name = u_row['full_name'] if u_row else user['full_name']
        target_area = u_row['area'] if u_row else 'Sistemas'

    checklist = _normalize_checklist(nota['checklist_json'])
    matched_item = next((c for c in checklist if checklist_item_id and c['id'] == checklist_item_id), None)

    descripcion = (data.get('descripcion') or '').strip()
    if not descripcion:
        if matched_item:
            descripcion = f"[{nota['titulo']}] {matched_item['texto']}"
        else:
            body_html = (nota['contenido'] or '').strip()
            descripcion = f"<p><strong>{nota['titulo']}</strong></p>{body_html}" if body_html else nota['titulo']

    para_cliente = normalize_client_name(data.get('para_cliente') if 'para_cliente' in data else (nota['para_cliente'] or ''))
    tipo_trabajo = (data.get('tipo_trabajo') or ('Desarrollo' if nota['tipo_nota'] == 'tecnica' else 'Gestión / Coordinación')).strip()
    estado = (data.get('estado') or 'en_proceso').strip()
    if estado not in ('completada', 'en_proceso', 'en_revision', 'pendiente'):
        estado = 'en_proceso'

    try:
        duracion = max(0, int(data.get('duracion_min') or 0))
    except (TypeError, ValueError):
        duracion = 0
    hora_inicio = (data.get('hora_inicio') or '').strip()
    hora_fin = (data.get('hora_fin') or '').strip()
    if hora_inicio and not hora_fin:
        hora_fin = calculate_hora_fin(hora_inicio, duracion, fecha)

    # Encontrar o crear bitácora del día
    b_row = cursor.execute(
        "SELECT id FROM bitacoras WHERE user_id = ? AND fecha = ? ORDER BY id ASC LIMIT 1",
        (target_uid, fecha),
    ).fetchone()
    if b_row:
        bitacora_id = b_row['id']
    else:
        cursor.execute(
            '''
            INSERT INTO bitacoras (
                user_id, fecha, hora_inicio, colaborador, area, pendientes,
                necesita_apoyo, prioridad_siguiente, tiempo_total_min, estado,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, '', 'No', '', 0, 'generada', ?, ?)
            ''',
            (target_uid, fecha, get_default_hora_inicio(cursor), target_name, target_area, now_peru, now_peru),
        )
        bitacora_id = cursor.lastrowid

    next_orden = cursor.execute(
        "SELECT COALESCE(MAX(orden), -1) + 1 FROM actividades WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0)",
        (bitacora_id,),
    ).fetchone()[0]

    ev_json = json.dumps(sanitize_evidencias(data.get('evidencias', []), descripcion))
    cursor.execute(
        '''
        INSERT INTO actividades (
            bitacora_id, orden, hora_inicio, hora_fin, duracion_min,
            tipo_trabajo, descripcion, para_cliente, estado, evidencias,
            shared_with, comentarios, created_by_user_id, updated_by_user_id,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)
        ''',
        (
            bitacora_id, next_orden, hora_inicio, hora_fin, duracion,
            tipo_trabajo, descripcion, para_cliente, estado, ev_json,
            data.get('comentarios') or '', user['id'], user['id'], now_peru, now_peru,
        ),
    )
    act_id = cursor.lastrowid

    # Crear vínculo nota <-> actividad y actualizar checklist si aplica
    _sync_note_activity_links(
        cursor, act_id, user,
        source_nota_id=nota_id,
        source_checklist_item_id=checklist_item_id,
        tipo_relacion='origen',
        now_peru=now_peru,
    )

    recalculate_bitacora_durations(cursor, bitacora_id, fecha=fecha, now_peru=now_peru)
    if estado == 'completada':
        propagate_completion_across_lineage(cursor, [act_id], now_peru)

    conn.commit()
    b_info = cursor.execute("SELECT tiempo_total_min FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone()
    users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
    enriched_acts = fetch_enriched_bitacora_activities(cursor, bitacora_id, fecha=fecha, users_map=users_map)
    created_act = next((a for a in enriched_acts if a.get('id') == act_id), None)
    updated_nota = _format_nota(
        cursor,
        cursor.execute("SELECT * FROM notas WHERE id = ?", (nota_id,)).fetchone(),
        users_map=users_map,
        include_activities=True,
    )
    conn.close()

    return jsonify({
        "success": True,
        "actividad": created_act,
        "nota": updated_nota,
        "bitacora_id": bitacora_id,
        "bitacora_actividades": enriched_acts,
        "tiempo_total_min": b_info['tiempo_total_min'] if b_info else 0,
    }), 201
