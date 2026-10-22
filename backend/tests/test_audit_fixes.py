"""Pruebas de regresión y auditoría: papelera aislada, scoping de privacidad y rollover con revisión."""
import os
import sqlite3
import pytest

from database import get_db


def _db():
    conn = sqlite3.connect(os.environ['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    return conn


def _make_team(lider_id, nombre="Equipo Test"):
    conn = _db()
    cur = conn.execute("INSERT INTO teams (nombre, lider_id) VALUES (?, ?)", (nombre, lider_id))
    team_id = cur.lastrowid
    conn.execute("UPDATE users SET team_id = ? WHERE id = ?", (team_id, lider_id))
    conn.commit()
    conn.close()
    return team_id


def test_vaciar_papelera_analista_no_borra_papelera_ajena(client, make_user, admin):
    """Un analista enviando cuerpo vacío {} jamás debe vaciar la papelera de otros usuarios."""
    u1 = make_user()
    u2 = make_user()

    # u1 crea y borra una actividad
    r1 = client.post('/api/bitacoras', json={
        'fecha': '2026-10-21', 'colaborador': u1['user']['full_name'], 'user_id': u1['user']['id'],
        'actividades': [{'id': 'act-u1', 'descripcion': 'Tarea secreta u1', 'duracion_min': 10, 'hora_inicio': '08:30'}],
    }, headers=u1['h'])
    act1_id = r1.json['bitacora']['actividades'][0]['id']
    client.post(f'/api/actividades/{act1_id}/eliminar', headers=u1['h'])

    # u2 crea y borra una actividad
    r2 = client.post('/api/bitacoras', json={
        'fecha': '2026-10-21', 'colaborador': u2['user']['full_name'], 'user_id': u2['user']['id'],
        'actividades': [{'id': 'act-u2', 'descripcion': 'Tarea secreta u2', 'duracion_min': 20, 'hora_inicio': '09:00'}],
    }, headers=u2['h'])
    act2_id = r2.json['bitacora']['actividades'][0]['id']
    client.post(f'/api/actividades/{act2_id}/eliminar', headers=u2['h'])

    # u1 vacía su papelera enviando un cuerpo {} sin user_id
    rv = client.post('/api/papelera/vaciar', json={}, headers=u1['h'])
    assert rv.status_code == 200

    # La actividad de u1 fue borrada
    conn = _db()
    row1 = conn.execute("SELECT id FROM actividades WHERE id = ?", (act1_id,)).fetchone()
    # La actividad de u2 DEBE PERMANECER intacta en la papelera
    row2 = conn.execute("SELECT id FROM actividades WHERE id = ?", (act2_id,)).fetchone()
    conn.close()

    assert row1 is None, "La tarea de u1 debió ser eliminada"
    assert row2 is not None, "La tarea de u2 NO debió ser eliminada por u1"


def test_lider_papelera_scoped_a_su_equipo(client, make_user, admin):
    """Un líder de equipo solo debe ver elementos en papelera de su equipo, no de otros equipos."""
    lider1 = make_user(role='lider')
    team1_id = _make_team(lider1['user']['id'], "Equipo Alfa")
    colab1 = make_user(team_id=team1_id)

    lider2 = make_user(role='lider')
    team2_id = _make_team(lider2['user']['id'], "Equipo Beta")
    colab2 = make_user(team_id=team2_id)

    # colab1 borra tarea
    r1 = client.post('/api/bitacoras', json={
        'fecha': '2026-10-21', 'colaborador': colab1['user']['full_name'], 'user_id': colab1['user']['id'],
        'actividades': [{'id': 'act-c1', 'descripcion': 'Tarea Equipo Alfa', 'duracion_min': 15, 'hora_inicio': '08:30'}],
    }, headers=colab1['h'])
    act1_id = r1.json['bitacora']['actividades'][0]['id']
    client.post(f'/api/actividades/{act1_id}/eliminar', headers=colab1['h'])

    # colab2 borra tarea
    r2 = client.post('/api/bitacoras', json={
        'fecha': '2026-10-21', 'colaborador': colab2['user']['full_name'], 'user_id': colab2['user']['id'],
        'actividades': [{'id': 'act-c2', 'descripcion': 'Tarea Equipo Beta', 'duracion_min': 25, 'hora_inicio': '09:00'}],
    }, headers=colab2['h'])
    act2_id = r2.json['bitacora']['actividades'][0]['id']
    client.post(f'/api/actividades/{act2_id}/eliminar', headers=colab2['h'])

    # lider1 consulta papelera
    res1 = client.get('/api/papelera', headers=lider1['h'])
    assert res1.status_code == 200
    ids_lider1 = [item['id'] for item in res1.json.get('items', [])]
    assert act1_id in ids_lider1, "lider1 debe ver la tarea de su propio equipo"
    assert act2_id not in ids_lider1, "lider1 NO debe ver la tarea de Equipo Beta"


def test_rollover_preserva_datos_de_revision(client, make_user):
    """Al arrastrar tareas incompletas al día siguiente, se preservan la decisión y comentario de revisión."""
    colab = make_user()
    lider = make_user(role='lider')
    team_id = _make_team(lider['user']['id'], "Equipo Dev")
    conn = _db()
    conn.execute("UPDATE users SET team_id = ? WHERE id = ?", (team_id, colab['user']['id']))
    conn.commit()
    conn.close()

    # Crear actividad en día anterior
    past_date = '2026-10-14'
    today_date = '2026-10-15'
    r = client.post('/api/bitacoras', json={
        'fecha': past_date, 'colaborador': colab['user']['full_name'], 'user_id': colab['user']['id'],
        'actividades': [{'id': 'act-plan', 'descripcion': 'Plan de arquitectura', 'duracion_min': 60, 'hora_inicio': '09:00', 'estado': 'en_revision'}],
    }, headers=colab['h'])
    act_id = r.json['bitacora']['actividades'][0]['id']

    # Líder aprueba para continuar
    rev_res = client.post(f'/api/actividades/{act_id}/revision', json={
        'decision': 'aprobada_continuar',
        'comentario': 'Visto bueno: procede con la implementación'
    }, headers=lider['h'])
    assert rev_res.status_code == 200

    # Ejecutar rollover para el usuario
    import app as appmod
    conn = _db()
    cur = conn.cursor()
    rolled = appmod.rollover_user_open_tasks(cur, colab['user']['id'], colab['user']['full_name'], today_date, '2026-10-15 08:00:00')
    conn.commit()
    conn.close()
    assert rolled >= 1

    # Verificar que la tarea de hoy conserva los campos de revisión
    b_today = client.get(f'/api/bitacoras?fecha={today_date}&user_id={colab["user"]["id"]}', headers=colab['h'])
    assert b_today.status_code == 200
    acts_today = b_today.json[0]['actividades']
    rolled_act = [a for a in acts_today if a['parent_task_id'] == act_id][0]
    assert rolled_act['revision_decision'] == 'aprobada_continuar'
    assert rolled_act['revision_comentario'] == 'Visto bueno: procede con la implementación'
    assert rolled_act['revisado_por'] == lider['user']['id']


def test_pendientes_scoping_analista(client, make_user):
    """Un analista solo recibe sus tareas pendientes en /api/actividades/pendientes."""
    a1 = make_user()
    a2 = make_user()

    client.post('/api/bitacoras', json={
        'fecha': '2026-10-21', 'colaborador': a1['user']['full_name'], 'user_id': a1['user']['id'],
        'actividades': [{'id': 'p1', 'descripcion': 'Pendiente de a1', 'duracion_min': 10, 'hora_inicio': '08:30', 'estado': 'en_proceso'}],
    }, headers=a1['h'])

    client.post('/api/bitacoras', json={
        'fecha': '2026-10-21', 'colaborador': a2['user']['full_name'], 'user_id': a2['user']['id'],
        'actividades': [{'id': 'p2', 'descripcion': 'Pendiente de a2', 'duracion_min': 10, 'hora_inicio': '08:30', 'estado': 'en_proceso'}],
    }, headers=a2['h'])

    r = client.get('/api/actividades/pendientes', headers=a1['h'])
    assert r.status_code == 200
    descs = [item['descripcion'] for item in r.json]
    assert 'Pendiente de a1' in descs
    assert 'Pendiente de a2' not in descs
