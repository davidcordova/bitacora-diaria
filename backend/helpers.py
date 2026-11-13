import os
import json
import re
import html
import secrets
from datetime import datetime

from database import (
    get_db,
    get_peru_now,
    get_peru_now_str,
    MIN_PASSWORD_LENGTH,
    WEAK_DEFAULT_PASSWORDS,
)
from crypto_utils import decrypt_vault_secret
from activity_lifecycle import enrich_activities_with_net_info


def validate_new_password(password):
    """Devuelve un mensaje de error si la contraseña no cumple la política mínima, o None."""
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        return f"La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres"
    if password in WEAK_DEFAULT_PASSWORDS or password.lower() in ('12345678', '123456789', 'password', 'contraseña'):
        return "Esa contraseña es demasiado común. Elige otra"
    return None


def generate_temp_password():
    return 'Tmp-' + secrets.token_urlsafe(8)


def is_dia_laborable(fecha_str=None):
    if not fecha_str:
        return True
    try:
        d = datetime.strptime(str(fecha_str).strip()[:10], '%Y-%m-%d')
        return d.weekday() < 5
    except Exception:
        return True


def calculate_hora_fin(hora_inicio, duracion_min, fecha=None):
    if not hora_inicio:
        return ''
    try:
        parts = str(hora_inicio).strip().split(':')
        h = int(parts[0])
        m = int(parts[1])
        dur = int(duracion_min or 0)
        start_min = h * 60 + m
        refrig_inicio = 13 * 60  # 13:00 -> 780
        refrig_fin = 14 * 60     # 14:00 -> 840
        refrig_dur = 60

        laborable = is_dia_laborable(fecha)
        if not laborable or dur <= 0:
            total = start_min + max(0, dur)
        else:
            effective_start = start_min
            if effective_start < refrig_fin and effective_start >= refrig_inicio:
                effective_start = refrig_fin

            end_min = effective_start + dur
            if start_min < refrig_inicio and end_min > refrig_inicio:
                end_min += refrig_dur
            total = end_min

        final_h = (total // 60) % 24
        final_m = total % 60
        return f"{final_h:02d}:{final_m:02d}"
    except Exception:
        return ''


def sanitize_evidencias(evidencias_input, descripcion):
    """
    Elimina evidencias duplicadas y filtra aquellas cuyas URLs o nombres de archivo
    ya se encuentran incrustados en el HTML de la descripción (WYSIWYG inline).
    """
    if not evidencias_input:
        return []
    if isinstance(evidencias_input, str):
        try:
            evidencias_input = json.loads(evidencias_input)
        except Exception:
            return []
    if not isinstance(evidencias_input, list):
        return []

    desc = descripcion or ''
    cleaned = []
    seen = set()
    for ev in evidencias_input:
        if not isinstance(ev, dict):
            continue
        url = (ev.get('url') or '').strip()
        if not url or url in seen:
            continue
        seen.add(url)
        filename = os.path.basename(url).split('?')[0]
        if (url and url in desc) or (filename and filename in desc):
            continue
        if '_' in filename:
            parts = filename.split('_')
            if len(parts) >= 2 and len(parts[0]) == 8 and len(parts[1]) == 6:
                ts_prefix = f"{parts[0]}_{parts[1]}"
                if ts_prefix in desc:
                    continue
        cleaned.append(ev)
    return cleaned


def strip_html_text(raw_html):
    if not raw_html:
        return ''
    clean = re.sub(r'<[^>]+>', ' ', str(raw_html))
    return re.sub(r'\s+', ' ', html.unescape(clean)).strip()


def format_actividad_dict(act_row, users_map=None, fecha=None):
    a_dict = dict(act_row)
    act_fecha = fecha or a_dict.get('fecha')
    if not a_dict.get('hora_fin') and a_dict.get('hora_inicio'):
        a_dict['hora_fin'] = calculate_hora_fin(a_dict.get('hora_inicio'), a_dict.get('duracion_min'), act_fecha)

    a_dict['evidencias'] = sanitize_evidencias(a_dict.get('evidencias'), a_dict.get('descripcion', ''))

    raw_parent_desc = a_dict.get('parent_task_desc')
    if raw_parent_desc:
        a_dict['parent_task_desc'] = strip_html_text(raw_parent_desc)

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

    if users_map:
        if isinstance(a_dict.get('shared_with'), list):
            a_dict['shared_with_names'] = [
                users_map[uid] for uid in a_dict['shared_with'] if uid in users_map
            ]
        creator_id = a_dict.get('created_by_user_id')
        if creator_id and creator_id in users_map:
            a_dict['created_by_name'] = users_map[creator_id]
        updater_id = a_dict.get('updated_by_user_id')
        if updater_id and updater_id in users_map:
            a_dict['updated_by_name'] = users_map[updater_id]
        reviewer_id = a_dict.get('revisado_por')
        if reviewer_id and reviewer_id in users_map:
            a_dict['revisado_por_nombre'] = users_map[reviewer_id]

    now_dt = get_peru_now().replace(tzinfo=None)
    last_touch_str = a_dict.get('updated_at') or a_dict.get('created_at') or (f"{act_fecha} 12:00:00" if act_fecha else None)
    days_inactive = 0
    if last_touch_str and a_dict.get('estado') != 'completada':
        try:
            clean_ts = str(last_touch_str).strip()
            if 'T' in clean_ts:
                clean_ts = clean_ts.replace('T', ' ').split('.')[0].split('+')[0]
            else:
                clean_ts = clean_ts.split('.')[0]
            if len(clean_ts) == 10:
                clean_ts += ' 12:00:00'
            dt = datetime.strptime(clean_ts[:19], '%Y-%m-%d %H:%M:%S')
            days_inactive = max(0, (now_dt - dt).days)
        except Exception:
            days_inactive = 0

    a_dict['dias_sin_cambio'] = days_inactive
    a_dict['is_stagnant'] = bool(days_inactive >= 7 and a_dict.get('estado') != 'completada')
    return a_dict


def slim_actividad_for_summary(act_dict):
    """Aligera una actividad enriquecida para listados paginados de historial (sin adjuntos pesados ni HTML crudo)."""
    slim = dict(act_dict)
    evs = slim.get('evidencias') or []
    slim['evidencias_count'] = len(evs) if isinstance(evs, list) else 0
    slim['evidencias'] = []
    plain_desc = strip_html_text(slim.get('descripcion', ''))
    slim['descripcion'] = (plain_desc[:297] + '...') if len(plain_desc) > 300 else plain_desc
    return slim


def fetch_enriched_bitacora_activities(cursor, bitacora_id, fecha=None, users_map=None):
    """Obtiene y enriquece las actividades activas de una bitácora con cálculo neto recursivo."""
    if not bitacora_id:
        return []
    if users_map is None:
        users_map = {u['id']: u['full_name'] for u in cursor.execute("SELECT id, full_name FROM users").fetchall()}
    if fecha is None:
        b_row = cursor.execute("SELECT fecha FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone()
        fecha = b_row['fecha'] if b_row else None

    rows = cursor.execute('''
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
        WHERE a.bitacora_id = ? AND (a.is_deleted IS NULL OR a.is_deleted = 0)
        ORDER BY a.orden ASC, a.id ASC
    ''', (bitacora_id,)).fetchall()
    formatted = [format_actividad_dict(r, users_map, fecha) for r in rows]
    return enrich_activities_with_net_info(formatted, fecha=fecha)


def check_and_notify_stagnant_activities(user_id=None, cursor=None, conn=None):
    """
    Detecta actividades sin avance/cambio en estado != 'completada' durante >= 7 días.
    Emite una notificación de advertencia al cumplir 7 días y de forma recurrente cada 7 días mientras no cambie de estado.
    """
    should_close = False
    if not cursor:
        if not conn:
            conn = get_db()
            should_close = True
        cursor = conn.cursor()

    now_dt = get_peru_now().replace(tzinfo=None)
    now_peru_str = get_peru_now_str()

    query = '''
        SELECT a.id, a.bitacora_id, a.descripcion, a.estado, a.created_at, a.updated_at,
               a.last_stagnant_notified_at, a.created_by_user_id,
               b.user_id as bitacora_user_id, b.colaborador, b.fecha as bitacora_fecha
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
    if user_id:
        query += ' AND (b.user_id = ? OR a.created_by_user_id = ?)'
        params.extend([user_id, user_id])

    query += ' ORDER BY a.id ASC'
    rows = cursor.execute(query, params).fetchall()

    notified_items = []
    stagnant_items = []

    for r in rows:
        act = dict(r)
        last_touch_str = act.get('updated_at') or act.get('created_at')
        if not last_touch_str and act.get('bitacora_fecha'):
            last_touch_str = f"{act['bitacora_fecha']} 12:00:00"

        last_touch_dt = None
        if last_touch_str:
            try:
                clean_ts = str(last_touch_str).strip()
                if 'T' in clean_ts:
                    clean_ts = clean_ts.replace('T', ' ').split('.')[0].split('+')[0]
                else:
                    clean_ts = clean_ts.split('.')[0]
                if len(clean_ts) == 10:
                    clean_ts += ' 12:00:00'
                last_touch_dt = datetime.strptime(clean_ts[:19], '%Y-%m-%d %H:%M:%S')
            except Exception:
                pass

        if not last_touch_dt:
            continue

        days_inactive = (now_dt - last_touch_dt).days
        if days_inactive >= 7:
            act['dias_estancada'] = days_inactive
            stagnant_items.append(act)

            last_notif_str = act.get('last_stagnant_notified_at')
            should_notify = False

            if not last_notif_str:
                should_notify = True
            else:
                try:
                    clean_n = str(last_notif_str).strip().split('.')[0]
                    last_notif_dt = datetime.strptime(clean_n[:19], '%Y-%m-%d %H:%M:%S')
                    days_since_notif = (now_dt - last_notif_dt).days
                    if days_since_notif >= 7:
                        should_notify = True
                except Exception:
                    should_notify = True

            if should_notify:
                target_user = act.get('created_by_user_id') or act.get('bitacora_user_id')
                if target_user:
                    raw_desc = act.get('descripcion') or 'Actividad sin descripción'
                    clean_desc = strip_html_text(raw_desc)
                    if len(clean_desc) > 80:
                        clean_desc = clean_desc[:77] + '...'

                    st_label = act.get('estado', 'pendiente').replace('_', ' ').capitalize()
                    notif_title = f"⚠️ Tarea pendiente sin cambios ({days_inactive} días)"
                    notif_msg = (
                        f'La actividad "{clean_desc}" se encuentra en estado "{st_label}" '
                        f'desde hace {days_inactive} días sin registrar avances ni modificaciones. '
                        f'Por favor, actualiza su avance o cambia su estado.'
                    )

                    cursor.execute('''
                        INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                        VALUES (?, ?, ?, 'warning', 0, ?)
                    ''', (target_user, notif_title, notif_msg, now_peru_str))

                    cursor.execute('''
                        UPDATE actividades SET last_stagnant_notified_at = ? WHERE id = ?
                    ''', (now_peru_str, act['id']))

                    notified_items.append({
                        'actividad_id': act['id'],
                        'user_id': target_user,
                        'dias_inactiva': days_inactive,
                        'title': notif_title
                    })

    if conn:
        try:
            conn.commit()
        except Exception:
            pass
        if should_close:
            conn.close()

    return {
        'stagnant_count': len(stagnant_items),
        'notified_count': len(notified_items),
        'stagnant_activities': stagnant_items,
        'notified': notified_items
    }


def get_default_hora_inicio(cursor=None):
    if cursor:
        try:
            row = cursor.execute("SELECT value FROM system_settings WHERE key = 'hora_inicio_default'").fetchone()
            if row and row['value']:
                return row['value']
        except Exception:
            pass
        return '08:30'
    try:
        conn = get_db()
        row = conn.execute("SELECT value FROM system_settings WHERE key = 'hora_inicio_default'").fetchone()
        if row and row['value']:
            return row['value']
    except Exception:
        pass
    return '08:30'


def _mask_vault_secrets(item, fields, unlocked):
    """Descifra los secretos solo si la bóveda está desbloqueada; si no, los oculta."""
    item['secret_locked'] = not unlocked
    for f in fields:
        raw = item.get(f)
        item[f'has_{f}'] = bool(raw)
        if not raw:
            continue
        item[f] = decrypt_vault_secret(raw) if unlocked else None
