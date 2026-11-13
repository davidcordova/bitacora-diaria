"""
Pruebas integrales de:
1. Solapamiento inteligente recursivo / anidado (resta automática de tareas internas a cualquier profundidad).
2. Ciclo de vida multi-día (propagación automática de 'completada' a eslabones previos sin borrar horas históricas,
   y no-resurrección de tareas descartadas en papelera).
"""

import os
import sqlite3
from app import execute_daily_rollover


def _db():
    conn = sqlite3.connect(os.environ['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    return conn


def test_solapamiento_recursivo_tres_niveles_y_restauracion(client, make_user):
    """
    Tarea macro (08:30-13:00 = 270m) -> contiene tarea media (09:30-11:30 = 120m)
    -> contiene micro-tarea (10:00-10:30 = 30m).
    Esperado:
      - Macro: 270 - 120 = 150 min (hora_inicio=08:30, hora_fin=13:00 intactos, descontados=120)
      - Media: 120 - 30 = 90 min (hora_inicio=09:30, hora_fin=11:30 intactos, descontados=30)
      - Micro: 30 min (descontados=0)
      - Total bitácora: 150 + 90 + 30 = 270 min.
    Al eliminar la micro-tarea, la media recupera 120 min automáticamente.
    Al eliminar la media, la macro recupera sus 270 min originales.
    """
    u = make_user()
    fecha = '2026-11-11'  # Miércoles (día laborable)

    r = client.post('/api/bitacoras', json={
        'fecha': fecha,
        'colaborador': u['user']['full_name'],
        'user_id': u['user']['id'],
        'actividades': [
            {
                'id': 'macro-1',
                'hora_inicio': '08:30',
                'hora_fin': '13:00',
                'duracion_min': 270,
                'descripcion': 'Desarrollo de módulo principal',
                'tipo_trabajo': 'Desarrollo',
                'estado': 'en_proceso',
            },
            {
                'id': 'media-1',
                'hora_inicio': '09:30',
                'hora_fin': '11:30',
                'duracion_min': 120,
                'descripcion': 'Revisión técnica con arquitectura',
                'tipo_trabajo': 'Reunión',
                'estado': 'completada',
            },
            {
                'id': 'micro-1',
                'hora_inicio': '10:00',
                'hora_fin': '10:30',
                'duracion_min': 30,
                'descripcion': 'Soporte urgente en servidor',
                'tipo_trabajo': 'Soporte',
                'estado': 'completada',
            },
        ],
    }, headers=u['h'])

    assert r.status_code == 200
    b = r.json['bitacora']
    assert b['tiempo_total_min'] == 270

    by_desc = {a['descripcion']: a for a in b['actividades']}
    macro = by_desc['Desarrollo de módulo principal']
    media = by_desc['Revisión técnica con arquitectura']
    micro = by_desc['Soporte urgente en servidor']

    assert macro['hora_inicio'] == '08:30'
    assert macro['hora_fin'] == '13:00'
    assert macro['duracion_min'] == 150
    assert macro['duracion_bruta_min'] == 270
    assert macro['minutos_descontados'] == 120

    assert media['hora_inicio'] == '09:30'
    assert media['hora_fin'] == '11:30'
    assert media['duracion_min'] == 90
    assert media['duracion_bruta_min'] == 120
    assert media['minutos_descontados'] == 30

    assert micro['duracion_min'] == 30
    assert micro['minutos_descontados'] == 0

    # Eliminar la micro-tarea -> la tarea media debe recuperar sus 120 min
    del_micro = client.post(f"/api/actividades/{micro['id']}/eliminar", headers=u['h'])
    assert del_micro.status_code == 200

    b_after_1 = client.get(f"/api/bitacoras/{b['id']}", headers=u['h']).json
    assert b_after_1['tiempo_total_min'] == 270
    by_desc_1 = {a['descripcion']: a for a in b_after_1['actividades']}
    assert by_desc_1['Revisión técnica con arquitectura']['duracion_min'] == 120
    assert by_desc_1['Revisión técnica con arquitectura']['minutos_descontados'] == 0
    assert by_desc_1['Desarrollo de módulo principal']['duracion_min'] == 150

    # Eliminar la tarea media -> la tarea macro debe recuperar sus 270 min íntegros
    del_media = client.post(f"/api/actividades/{media['id']}/eliminar", headers=u['h'])
    assert del_media.status_code == 200

    b_after_2 = client.get(f"/api/bitacoras/{b['id']}", headers=u['h']).json
    assert b_after_2['tiempo_total_min'] == 270
    by_desc_2 = {a['descripcion']: a for a in b_after_2['actividades']}
    assert by_desc_2['Desarrollo de módulo principal']['duracion_min'] == 270
    assert by_desc_2['Desarrollo de módulo principal']['minutos_descontados'] == 0


def test_solapamiento_invariante_al_orden_y_refrigerio(client, make_user):
    """
    Si primero se registran tareas pequeñas (10:00-10:30 y 15:00-15:45) y después
    se registra una tarea de jornada completa (09:00-18:00 = 480m descontando 13:00-14:00),
    la tarea larga descuenta los 75m internos quedando en 405m (total = 480m).
    """
    u = make_user()
    fecha = '2026-11-12'  # Jueves (día laborable)

    r = client.post('/api/bitacoras', json={
        'fecha': fecha,
        'colaborador': u['user']['full_name'],
        'user_id': u['user']['id'],
        'actividades': [
            {
                'id': 'small-am',
                'hora_inicio': '10:00',
                'hora_fin': '10:30',
                'duracion_min': 30,
                'descripcion': 'Daily standup',
                'estado': 'completada',
            },
            {
                'id': 'small-pm',
                'hora_inicio': '15:00',
                'hora_fin': '15:45',
                'duracion_min': 45,
                'descripcion': 'Atención ticket cliente',
                'estado': 'completada',
            },
            {
                'id': 'jornada-full',
                'hora_inicio': '09:00',
                'hora_fin': '18:00',
                'duracion_min': 480,
                'descripcion': 'Migración de base de datos',
                'estado': 'en_proceso',
            },
        ],
    }, headers=u['h'])

    assert r.status_code == 200
    b = r.json['bitacora']
    assert b['tiempo_total_min'] == 480
    by_desc = {a['descripcion']: a for a in b['actividades']}
    assert by_desc['Daily standup']['duracion_min'] == 30
    assert by_desc['Atención ticket cliente']['duracion_min'] == 45
    assert by_desc['Migración de base de datos']['duracion_min'] == 405
    assert by_desc['Migración de base de datos']['minutos_descontados'] == 75


def test_completar_actividad_multidia_cierra_eslabones_previos_sin_borrar_horas(client, make_user):
    """
    Una actividad pasa por 3 días (Día 1 -> Día 2 -> Día 3) mediante rollover.
    Al completarse el Día 3:
      - Día 1 y Día 2 pasan automáticamente a 'completada' (sin obligar a completar cada día).
      - Los minutos trabajados en Día 1 (60m), Día 2 (45m) y Día 3 (30m) se conservan intactos.
      - En Día 4 ya NO vuelve a aparecer arrastrada ni en /api/actividades/pendientes.
    """
    u = make_user()
    uid = u['user']['id']
    uname = u['user']['full_name']

    # Día 1: crea tarea en_proceso con 60 min
    r1 = client.post('/api/bitacoras', json={
        'fecha': '2026-11-09',
        'colaborador': uname,
        'user_id': uid,
        'actividades': [{
            'id': 'd1',
            'hora_inicio': '09:00',
            'hora_fin': '10:00',
            'duracion_min': 60,
            'descripcion': 'Auditoría de gastos por plataformas',
            'para_cliente': 'Gerencia',
            'estado': 'en_proceso',
        }],
    }, headers=u['h'])
    act_d1_id = r1.json['bitacora']['actividades'][0]['id']

    # Rollover al Día 2 (martes 2026-11-10)
    execute_daily_rollover(today_str='2026-11-10')
    b_d2 = client.get(f'/api/bitacoras?fecha=2026-11-10&user_id={uid}', headers=u['h']).json[0]
    act_d2_id = b_d2['actividades'][0]['id']
    assert b_d2['actividades'][0]['parent_task_id'] == act_d1_id

    # En Día 2 registra 45 min pero sigue en_proceso
    upd_d2 = client.put(f'/api/actividades/{act_d2_id}', json={
        'hora_inicio': '11:00',
        'hora_fin': '11:45',
        'duracion_min': 45,
        'estado': 'en_proceso',
    }, headers=u['h'])
    assert upd_d2.status_code == 200

    # Rollover al Día 3 (miércoles 2026-11-11)
    execute_daily_rollover(today_str='2026-11-11')
    b_d3 = client.get(f'/api/bitacoras?fecha=2026-11-11&user_id={uid}', headers=u['h']).json[0]
    act_d3_id = b_d3['actividades'][0]['id']
    assert b_d3['actividades'][0]['parent_task_id'] == act_d2_id

    # En Día 3 registra 30 min y marca como COMPLETADA vía PATCH /estado
    client.put(f'/api/actividades/{act_d3_id}', json={
        'hora_inicio': '10:00',
        'hora_fin': '10:30',
        'duracion_min': 30,
    }, headers=u['h'])
    patch_res = client.patch(f'/api/actividades/{act_d3_id}/estado', json={'estado': 'completada'}, headers=u['h'])
    assert patch_res.status_code == 200
    assert set(patch_res.json['closed_lineage_ids']) == {act_d1_id, act_d2_id}

    # Verificar en BD que los 3 días quedaron en 'completada' conservando sus minutos exactos
    conn = _db()
    rows = {
        r['id']: dict(r)
        for r in conn.execute(
            "SELECT id, estado, duracion_min FROM actividades WHERE id IN (?, ?, ?)",
            (act_d1_id, act_d2_id, act_d3_id),
        ).fetchall()
    }
    conn.close()

    assert rows[act_d1_id]['estado'] == 'completada'
    assert rows[act_d1_id]['duracion_min'] == 60
    assert rows[act_d2_id]['estado'] == 'completada'
    assert rows[act_d2_id]['duracion_min'] == 45
    assert rows[act_d3_id]['estado'] == 'completada'
    assert rows[act_d3_id]['duracion_min'] == 30

    # Rollover al Día 4 (jueves 2026-11-12): NO debe arrastrarse nuevamente
    roll_d4 = execute_daily_rollover(today_str='2026-11-12')
    b_d4_list = client.get(f'/api/bitacoras?fecha=2026-11-12&user_id={uid}', headers=u['h']).json
    assert len(b_d4_list) == 0 or len(b_d4_list[0]['actividades']) == 0

    pendientes = client.get(f'/api/actividades/pendientes?user_id={uid}', headers=u['h']).json
    assert all(p['id'] not in (act_d1_id, act_d2_id, act_d3_id) for p in pendientes)


def test_eliminar_tarea_arrastrada_no_resucita_ancestro(client, make_user):
    """
    Si una tarea arrastrada a hoy es enviada a la papelera (e incluso si luego se vacía la papelera),
    el ancestro del día anterior NO debe volver a recrearse automáticamente.
    """
    u = make_user()
    uid = u['user']['id']
    uname = u['user']['full_name']

    r1 = client.post('/api/bitacoras', json={
        'fecha': '2026-11-09',
        'colaborador': uname,
        'user_id': uid,
        'actividades': [{
            'id': 'd1-del',
            'hora_inicio': '16:00',
            'hora_fin': '16:30',
            'duracion_min': 30,
            'descripcion': 'Tarea descartable de prueba',
            'estado': 'pendiente',
        }],
    }, headers=u['h'])
    act_d1_id = r1.json['bitacora']['actividades'][0]['id']

    execute_daily_rollover(today_str='2026-11-10')
    b_d2 = client.get(f'/api/bitacoras?fecha=2026-11-10&user_id={uid}', headers=u['h']).json[0]
    act_d2_id = b_d2['actividades'][0]['id']

    # Usuario envía la copia arrastrada del Día 2 a la papelera
    client.post(f'/api/actividades/{act_d2_id}/eliminar', headers=u['h'])

    # Vacía su papelera
    client.post('/api/papelera/vaciar', json={}, headers=u['h'])

    # Ni en Día 2 ni en Día 3 vuelve a aparecer
    execute_daily_rollover(today_str='2026-11-10')
    b_d2_after = client.get(f'/api/bitacoras?fecha=2026-11-10&user_id={uid}', headers=u['h']).json[0]
    assert len(b_d2_after['actividades']) == 0

    execute_daily_rollover(today_str='2026-11-11')
    b_d3_after = client.get(f'/api/bitacoras?fecha=2026-11-11&user_id={uid}', headers=u['h']).json
    assert len(b_d3_after) == 0 or len(b_d3_after[0]['actividades']) == 0

    # Y el registro histórico del Día 1 sigue intacto (30m) sin borrarse de producción
    conn = _db()
    d1_row = conn.execute("SELECT duracion_min, is_deleted FROM actividades WHERE id = ?", (act_d1_id,)).fetchone()
    conn.close()
    assert d1_row is not None
    assert d1_row['duracion_min'] == 30
    assert (d1_row['is_deleted'] or 0) == 0
