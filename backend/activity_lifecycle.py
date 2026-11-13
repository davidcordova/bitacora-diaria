"""
Motor de ciclo de vida de actividades y cálculo inteligente de solapamientos (anidamiento recursivo).

Garantiza dos invariantes clave del negocio sin pérdida de datos históricos:
1. Resta jerárquica/recursiva de solapamientos dentro de una misma jornada:
   - Si una actividad larga abarca el horario de tareas más cortas (y estas a su vez contienen
     micro-tareas internas a cualquier nivel de profundidad), cada tarea conserva su ventana
     horaria real (`hora_inicio` - `hora_fin`) pero descuenta de su `duracion_min` el tiempo
     efectivamente ocupado por las tareas más específicas realizadas dentro de ese rango.
2. Propagación limpia de cierre en cadenas multi-día (`continuacion`):
   - Cuando una tarea arrastrada o continuada durante varios días pasa a `completada`,
     sus eslabones previos abiertos del mismo colaborador se marcan como `completada`
     (conservando intactos los minutos trabajados en cada día), evitando que reaparezcan
     o fuercen a cerrar manualmente día por día.
   - Cuando el usuario envía a la papelera una tarea arrastrada, se marca `rollover_dismissed = 1`
     en sus ancestros de continuación para que nunca resurja automáticamente.
"""

import re
from datetime import datetime

_HTML_TAG_RE = re.compile(r'<[^>]+>')


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
            if refrig_inicio <= effective_start < refrig_fin:
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


def normalize_desc_key(text):
    """Normaliza una descripción HTML/texto para comparación semántica segura."""
    if not text:
        return ''
    cleaned = _HTML_TAG_RE.sub(' ', str(text))
    cleaned = (
        cleaned.replace('&nbsp;', ' ')
        .replace('&amp;', '&')
        .replace('&lt;', '<')
        .replace('&gt;', '>')
        .replace('&quot;', '"')
    )
    return ' '.join(cleaned.split()).strip().lower()


def _parse_hhmm_to_min(hhmm):
    if not hhmm:
        return None
    try:
        parts = str(hhmm).strip().split(':')
        if len(parts) < 2:
            return None
        h = int(parts[0])
        m = int(parts[1])
        if h < 0 or h > 23 or m < 0 or m > 59:
            return None
        return h * 60 + m
    except Exception:
        return None


def _subtract_interval(intervals, sub_start, sub_end):
    if sub_end <= sub_start:
        return intervals
    out = []
    for a, b in intervals:
        if sub_end <= a or sub_start >= b:
            out.append((a, b))
        else:
            if a < sub_start:
                out.append((a, sub_start))
            if sub_end < b:
                out.append((sub_end, b))
    return out


def _base_working_intervals(start_min, end_min, fecha=None):
    """
    Calcula los tramos laborales efectivos [(s, e), ...] entre start_min y end_min.
    De lunes a viernes descuenta el refrigerio (13:00-14:00) cuando la ventana lo cruza,
    respetando tareas registradas explícita e íntegramente dentro de 13:00-14:00.
    """
    if start_min is None or end_min is None:
        return []
    e = end_min
    if e < start_min:
        e += 24 * 60
    if e <= start_min:
        return []
    base = [(start_min, e)]
    if is_dia_laborable(fecha):
        lunch_s, lunch_e = 13 * 60, 14 * 60  # 780, 840
        if start_min < lunch_s or e > lunch_e:
            base = _subtract_interval(base, lunch_s, lunch_e)
    return base


def compute_net_durations_for_list(act_dicts, fecha=None):
    """
    Evalúa recursivamente los solapamientos entre las actividades activas de una jornada.

    Regla de especificidad / precedencia (orden parcial estricto libre de ciclos):
      - Entre dos tareas con bloques laborales distintos (base_j != base_i):
        1) La tarea con MENOR duración bruta (`gross_j < gross_i`) tiene mayor especificidad
           y descuenta su tiempo de la tarea más larga (soporta N niveles de anidamiento:
           tarea macro -> subtarea -> interrupción rápida -> micro-tarea).
        2) Si ambas tienen igual duración bruta (`gross_j == gross_i`) pero distinto rango
           (ej. 09:00-10:00 y 09:30-10:30), la que inicia después conserva su bloque y
           recorta el tramo solapado de la anterior.
      - Si dos tareas comparten exactamente los mismos intervalos laborales (`base_j == base_i`),
        no se anulan mutuamente.

    Retorna una lista paralela a `act_dicts` con diccionarios:
      {
        'idx': int,
        'id': any,
        'hora_fin': str,
        'duracion_min': int,
        'duracion_bruta_min': int,
        'minutos_descontados': int,
        'is_timed': bool,
      }
    """
    parsed = []
    for idx, raw in enumerate(act_dicts):
        act_id = raw['id'] if 'id' in raw else None
        h_ini = (raw.get('hora_inicio') or '').strip()
        h_fin = (raw.get('hora_fin') or '').strip()
        try:
            cur_dur = max(0, int(raw.get('duracion_min') or 0))
        except (TypeError, ValueError):
            cur_dur = 0

        if not h_ini:
            parsed.append({
                'idx': idx,
                'id': act_id,
                'hora_fin': '',
                'base': [],
                'gross': cur_dur,
                'cur_dur': cur_dur,
                'is_timed': False,
            })
            continue

        if not h_fin and cur_dur > 0:
            h_fin = calculate_hora_fin(h_ini, cur_dur, fecha)

        s_min = _parse_hhmm_to_min(h_ini)
        e_min = _parse_hhmm_to_min(h_fin) if h_fin else None
        if s_min is None or e_min is None:
            parsed.append({
                'idx': idx,
                'id': act_id,
                'hora_fin': h_fin,
                'base': [],
                'gross': cur_dur,
                'cur_dur': cur_dur,
                'is_timed': False,
            })
            continue

        base = _base_working_intervals(s_min, e_min, fecha)
        gross = sum(b - a for a, b in base)
        if gross <= 0:
            parsed.append({
                'idx': idx,
                'id': act_id,
                'hora_fin': h_fin,
                'base': [],
                'gross': 0,
                'cur_dur': 0,
                'is_timed': True,
            })
            continue

        parsed.append({
            'idx': idx,
            'id': act_id,
            'hora_fin': h_fin,
            'base': base,
            'gross': gross,
            'cur_dur': cur_dur,
            'is_timed': True,
        })

    results = []
    for item in parsed:
        if not item['is_timed'] or not item['base']:
            results.append({
                'idx': item['idx'],
                'id': item['id'],
                'hora_fin': item['hora_fin'],
                'duracion_min': item['gross'] if item['is_timed'] else item['cur_dur'],
                'duracion_bruta_min': item['gross'] if item['is_timed'] else item['cur_dur'],
                'minutos_descontados': 0,
                'is_timed': item['is_timed'],
            })
            continue

        base_i = item['base']
        gross_i = item['gross']
        prio_i = (-gross_i, base_i[0][0], base_i[-1][1], item['idx'])

        eff = list(base_i)
        for other in parsed:
            if other['idx'] == item['idx'] or not other['is_timed'] or not other['base']:
                continue
            base_j = other['base']
            if base_j == base_i:
                continue
            gross_j = other['gross']
            prio_j = (-gross_j, base_j[0][0], base_j[-1][1], other['idx'])
            if prio_j > prio_i:
                for sj, ej in base_j:
                    eff = _subtract_interval(eff, sj, ej)
                if not eff:
                    break

        net_min = max(0, sum(b - a for a, b in eff))
        discounted = max(0, gross_i - net_min)
        results.append({
            'idx': item['idx'],
            'id': item['id'],
            'hora_fin': item['hora_fin'],
            'duracion_min': net_min,
            'duracion_bruta_min': gross_i,
            'minutos_descontados': discounted,
            'is_timed': True,
        })

    return results


def enrich_activities_with_net_info(formatted_acts, fecha=None):
    """
    Añade `duracion_bruta_min` y `minutos_descontados` a una lista de actividades ya formateadas
    para su visualización en el frontend sin mutar registros históricos en lecturas GET.
    """
    if not formatted_acts:
        return formatted_acts
    calc = compute_net_durations_for_list(formatted_acts, fecha=fecha)
    for act, info in zip(formatted_acts, calc):
        gross = info['duracion_bruta_min']
        try:
            saved_dur = max(0, int(act.get('duracion_min') or 0))
        except (TypeError, ValueError):
            saved_dur = 0
        act['duracion_bruta_min'] = gross
        act['minutos_descontados'] = max(0, gross - saved_dur) if info['is_timed'] and gross > saved_dur else 0
    return formatted_acts


def recalculate_bitacora_durations(cursor, bitacora_id, fecha=None, now_peru=None):
    """
    Recalcula y persiste `duracion_min` (descontando solapamientos anidados),
    ancla `hora_fin` si faltaba, y actualiza `bitacoras.tiempo_total_min`.
    """
    if not bitacora_id:
        return 0
    if not fecha:
        b_row = cursor.execute("SELECT fecha FROM bitacoras WHERE id = ?", (bitacora_id,)).fetchone()
        if not b_row:
            return 0
        fecha = b_row['fecha'] if isinstance(b_row, dict) or hasattr(b_row, 'keys') else b_row[0]

    rows = cursor.execute(
        '''
        SELECT id, orden, hora_inicio, hora_fin, duracion_min
        FROM actividades
        WHERE bitacora_id = ? AND (is_deleted IS NULL OR is_deleted = 0)
        ORDER BY orden ASC, id ASC
        ''',
        (bitacora_id,),
    ).fetchall()

    row_dicts = [
        {
            'id': r['id'],
            'orden': r['orden'],
            'hora_inicio': r['hora_inicio'],
            'hora_fin': r['hora_fin'],
            'duracion_min': r['duracion_min'],
        }
        for r in rows
    ]
    calc = compute_net_durations_for_list(row_dicts, fecha=fecha)

    total_min = 0
    for orig, info in zip(row_dicts, calc):
        new_dur = int(info['duracion_min'] or 0)
        new_hfin = info['hora_fin'] or ''
        old_dur = int(orig['duracion_min'] or 0)
        old_hfin = (orig['hora_fin'] or '').strip()
        total_min += new_dur

        if new_dur != old_dur or new_hfin != old_hfin:
            cursor.execute(
                "UPDATE actividades SET duracion_min = ?, hora_fin = ? WHERE id = ?",
                (new_dur, new_hfin, orig['id']),
            )

    if now_peru:
        cursor.execute(
            "UPDATE bitacoras SET tiempo_total_min = ?, updated_at = ? WHERE id = ?",
            (total_min, now_peru, bitacora_id),
        )
    else:
        cursor.execute(
            "UPDATE bitacoras SET tiempo_total_min = ? WHERE id = ?",
            (total_min, bitacora_id),
        )
    return total_min


def _is_continuation_link(tipo_vinculo):
    tv = (tipo_vinculo or '').strip().lower()
    return tv in ('', 'continuacion')


def propagate_completion_across_lineage(cursor, act_ids, now_peru):
    """
    Cuando una o más actividades pasan a estado 'completada', cierra automáticamente:
      1) Todos los ancestros y descendientes de continuación (`tipo_vinculo = 'continuacion'`)
         del mismo colaborador.
      2) Cualquier instancia previa abierta (`b2.fecha <= seed_fecha`) del mismo colaborador con
         exactamente la misma descripción normalizada (cubre cadenas rotas históricamente).
    Conserva intactos `duracion_min`, `hora_inicio`, `hora_fin`, `descripcion` y `evidencias`.
    Retorna la lista de IDs adicionales que fueron actualizados a 'completada'.
    """
    if isinstance(act_ids, int):
        seed_ids = [act_ids]
    else:
        seed_ids = [int(x) for x in (act_ids or []) if x is not None and str(x).isdigit()]
    if not seed_ids:
        return []

    closed_extra_ids = set()
    visited = set()

    for seed_id in seed_ids:
        if seed_id in visited:
            continue
        seed = cursor.execute(
            '''
            SELECT a.id, a.parent_task_id, a.tipo_vinculo, a.descripcion, a.estado,
                   b.user_id, b.colaborador, b.fecha
            FROM actividades a
            JOIN bitacoras b ON a.bitacora_id = b.id
            WHERE a.id = ?
            ''',
            (seed_id,),
        ).fetchone()
        if not seed or seed['estado'] != 'completada':
            continue

        owner_uid = seed['user_id']
        owner_colab = (seed['colaborador'] or '').strip().lower()
        seed_fecha = seed['fecha'] or ''
        desc_key = normalize_desc_key(seed['descripcion'])

        def _same_owner(row_uid, row_colab):
            if owner_uid and row_uid:
                return int(owner_uid) == int(row_uid)
            if owner_colab and row_colab:
                return owner_colab == str(row_colab).strip().lower()
            return False

        # 1. Recorrer hacia arriba y hacia abajo los vínculos de continuación
        lineage_ids = set()
        queue = [(seed['id'], seed['parent_task_id'], seed['tipo_vinculo'])]
        depth = 0
        while queue and depth < 60:
            depth += 1
            cur_id, cur_parent_id, cur_tv = queue.pop(0)
            if cur_id in visited:
                continue
            visited.add(cur_id)
            lineage_ids.add(cur_id)

            # Ancestro directo si el eslabón actual es continuación
            if cur_parent_id and _is_continuation_link(cur_tv) and cur_parent_id not in visited:
                p_row = cursor.execute(
                    '''
                    SELECT a.id, a.parent_task_id, a.tipo_vinculo, b.user_id, b.colaborador
                    FROM actividades a
                    JOIN bitacoras b ON a.bitacora_id = b.id
                    WHERE a.id = ?
                    ''',
                    (cur_parent_id,),
                ).fetchone()
                if p_row and _same_owner(p_row['user_id'], p_row['colaborador']):
                    queue.append((p_row['id'], p_row['parent_task_id'], p_row['tipo_vinculo']))

            # Descendientes directos de continuación
            children = cursor.execute(
                '''
                SELECT a.id, a.parent_task_id, a.tipo_vinculo, b.user_id, b.colaborador
                FROM actividades a
                JOIN bitacoras b ON a.bitacora_id = b.id
                WHERE a.parent_task_id = ?
                  AND (a.is_deleted IS NULL OR a.is_deleted = 0)
                ''',
                (cur_id,),
            ).fetchall()
            for ch in children:
                if (
                    ch['id'] not in visited
                    and _is_continuation_link(ch['tipo_vinculo'])
                    and _same_owner(ch['user_id'], ch['colaborador'])
                ):
                    queue.append((ch['id'], ch['parent_task_id'], ch['tipo_vinculo']))

        # 2. Instancias previas del mismo colaborador con idéntico texto normalizado (cadenas rotas)
        if desc_key and seed_fecha:
            if owner_uid:
                cand_rows = cursor.execute(
                    '''
                    SELECT a.id, a.descripcion
                    FROM actividades a
                    JOIN bitacoras b ON a.bitacora_id = b.id
                    WHERE (b.user_id = ? OR LOWER(TRIM(b.colaborador)) = ?)
                      AND b.fecha <= ?
                      AND a.estado != 'completada'
                      AND (a.is_deleted IS NULL OR a.is_deleted = 0)
                    ''',
                    (owner_uid, owner_colab, seed_fecha),
                ).fetchall()
            else:
                cand_rows = cursor.execute(
                    '''
                    SELECT a.id, a.descripcion
                    FROM actividades a
                    JOIN bitacoras b ON a.bitacora_id = b.id
                    WHERE LOWER(TRIM(b.colaborador)) = ?
                      AND b.fecha <= ?
                      AND a.estado != 'completada'
                      AND (a.is_deleted IS NULL OR a.is_deleted = 0)
                    ''',
                    (owner_colab, seed_fecha),
                ).fetchall()
            for cr in cand_rows:
                if normalize_desc_key(cr['descripcion']) == desc_key:
                    lineage_ids.add(cr['id'])

        target_ids = [tid for tid in lineage_ids if tid != seed_id]
        if target_ids:
            placeholders = ','.join(['?'] * len(target_ids))
            open_targets = [
                r[0]
                for r in cursor.execute(
                    f"SELECT id FROM actividades WHERE id IN ({placeholders}) AND estado != 'completada'",
                    target_ids,
                ).fetchall()
            ]
            if open_targets:
                ph_open = ','.join(['?'] * len(open_targets))
                cursor.execute(
                    f'''
                    UPDATE actividades
                    SET estado = 'completada',
                        updated_at = ?,
                        last_stagnant_notified_at = NULL
                    WHERE id IN ({ph_open})
                    ''',
                    [now_peru] + open_targets,
                )
                closed_extra_ids.update(open_targets)

    return sorted(closed_extra_ids)


def mark_lineage_rollover_dismissed(cursor, act_ids):
    """
    Marca `rollover_dismissed = 1` en los ancestros de continuación cuando el usuario
    envía una tarea arrastrada a la papelera, evitando que vuelva a recrearse en el próximo rollover
    o después de vaciar la papelera.
    """
    if isinstance(act_ids, int):
        seed_ids = [act_ids]
    else:
        seed_ids = [int(x) for x in (act_ids or []) if x is not None and str(x).isdigit()]
    if not seed_ids:
        return

    ancestors = set()
    for sid in seed_ids:
        cur = cursor.execute(
            "SELECT id, parent_task_id, tipo_vinculo FROM actividades WHERE id = ?",
            (sid,),
        ).fetchone()
        depth = 0
        while cur and cur['parent_task_id'] and _is_continuation_link(cur['tipo_vinculo']) and depth < 40:
            depth += 1
            pid = cur['parent_task_id']
            if pid in ancestors or pid == sid:
                break
            ancestors.add(pid)
            cur = cursor.execute(
                "SELECT id, parent_task_id, tipo_vinculo FROM actividades WHERE id = ?",
                (pid,),
            ).fetchone()

    if ancestors:
        ph = ','.join(['?'] * len(ancestors))
        try:
            cursor.execute(
                f"UPDATE actividades SET rollover_dismissed = 1 WHERE id IN ({ph})",
                list(ancestors),
            )
        except Exception:
            pass


def relink_children_before_delete(cursor, del_ids):
    """
    Antes de eliminar definitivamente una o varias actividades, reconecta a sus hijos
    con el ancestro superior (`parent_task_id` del eliminado) en lugar de romper la cadena con NULL.
    """
    if isinstance(del_ids, int):
        ids_set = {del_ids}
    else:
        ids_set = {int(x) for x in (del_ids or []) if x is not None and str(x).isdigit()}
    if not ids_set:
        return

    for did in list(ids_set):
        # Buscar el primer ancestro que no esté siendo eliminado en el mismo lote
        cur_parent = None
        row = cursor.execute("SELECT parent_task_id FROM actividades WHERE id = ?", (did,)).fetchone()
        visited = {did}
        depth = 0
        cand = row[0] if row else None
        while cand and cand in ids_set and cand not in visited and depth < 40:
            visited.add(cand)
            depth += 1
            prow = cursor.execute("SELECT parent_task_id FROM actividades WHERE id = ?", (cand,)).fetchone()
            cand = prow[0] if prow else None
        if cand and cand not in ids_set:
            cur_parent = cand

        cursor.execute(
            "UPDATE actividades SET parent_task_id = CASE WHEN id = ? THEN NULL ELSE ? END WHERE parent_task_id = ?",
            (cur_parent or -1, cur_parent, did),
        )

