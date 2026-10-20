"""Flujo de aprobación del líder: tareas 'En revisión' -> continuar / cerrar / devolver."""
import os
import sqlite3

import pytest


def _db():
    conn = sqlite3.connect(os.environ['DATABASE_PATH'])
    conn.row_factory = sqlite3.Row
    return conn


def _make_team(lider_id):
    conn = _db()
    cur = conn.execute("INSERT INTO teams (nombre, lider_id) VALUES (?, ?)", (f'Equipo {lider_id}', lider_id))
    team_id = cur.lastrowid
    conn.execute("UPDATE users SET team_id = ? WHERE id = ?", (team_id, lider_id))
    conn.commit()
    conn.close()
    return team_id


def _notifs(user_id, title):
    conn = _db()
    rows = conn.execute("SELECT * FROM notifications WHERE user_id = ? AND title = ?", (user_id, title)).fetchall()
    conn.close()
    return rows


@pytest.fixture
def equipo(make_user):
    lider = make_user(role='lider')
    team_id = _make_team(lider['user']['id'])
    colab = make_user(team_id=team_id)
    externo = make_user(role='lider')  # líder de otro equipo (sin equipo asignado)
    return {'lider': lider, 'colab': colab, 'externo': externo}


def _crear_tarea(client, colab, fecha='2026-10-20', estado='en_proceso'):
    r = client.post('/api/bitacoras', json={
        'fecha': fecha, 'colaborador': colab['user']['full_name'], 'user_id': colab['user']['id'],
        'actividades': [{'id': 'tmp-plan', 'descripcion': '<p>Plan de trabajo migración</p>',
                         'duracion_min': 30, 'hora_inicio': '09:00', 'estado': estado}],
    }, headers=colab['h'])
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.json['bitacora']


def _pedir_revision(client, colab, act_id):
    r = client.patch(f'/api/actividades/{act_id}/estado', json={'estado': 'en_revision'}, headers=colab['h'])
    assert r.status_code == 200, r.get_data(as_text=True)


def test_solicitar_revision_notifica_al_lider(client, equipo):
    bit = _crear_tarea(client, equipo['colab'])
    act_id = bit['actividades'][0]['id']
    _pedir_revision(client, equipo['colab'], act_id)
    notifs = _notifs(equipo['lider']['user']['id'], 'Aprobación pendiente')
    assert len(notifs) == 1
    assert 'Plan de trabajo' in notifs[0]['message'] and '<p>' not in notifs[0]['message']


def test_dueno_y_lider_ajeno_no_pueden_aprobar(client, equipo):
    act_id = _crear_tarea(client, equipo['colab'])['actividades'][0]['id']
    _pedir_revision(client, equipo['colab'], act_id)
    for who in ('colab', 'externo'):
        r = client.post(f'/api/actividades/{act_id}/revision', json={'decision': 'aprobada_cerrada'},
                        headers=equipo[who]['h'])
        assert r.status_code == 403, who


@pytest.mark.parametrize('decision,estado', [
    ('aprobada_continuar', 'en_proceso'),
    ('aprobada_cerrada', 'completada'),
    ('devuelta', 'en_proceso'),
])
def test_decisiones_del_lider(client, equipo, decision, estado):
    colab, lider = equipo['colab'], equipo['lider']
    bit = _crear_tarea(client, colab)
    act_id = bit['actividades'][0]['id']
    _pedir_revision(client, colab, act_id)
    r = client.post(f'/api/actividades/{act_id}/revision',
                    json={'decision': decision, 'comentario': 'Falta el cronograma'}, headers=lider['h'])
    assert r.status_code == 200, r.get_data(as_text=True)
    assert r.json['nuevo_estado'] == estado
    assert r.json['revisado_por_nombre'] == lider['user']['full_name']

    act = client.get(f"/api/bitacoras/{bit['id']}", headers=colab['h']).json['actividades'][0]
    assert act['estado'] == estado
    assert act['revision_decision'] == decision
    assert act['revisado_por'] == lider['user']['id']
    assert act['revisado_por_nombre'] == lider['user']['full_name']
    assert act['revisado_at']
    assert len([n for n in _notifs(colab['user']['id'], n_title(decision))]) == 1

    # Ya no está en revisión: una segunda decisión choca
    r = client.post(f'/api/actividades/{act_id}/revision', json={'decision': 'aprobada_cerrada'}, headers=lider['h'])
    assert r.status_code == 409


def n_title(decision):
    import app as appmod
    return appmod.REVISION_DECISIONS[decision][1]


def test_admin_puede_aprobar_y_validaciones(client, admin, equipo):
    act_id = _crear_tarea(client, equipo['colab'])['actividades'][0]['id']
    _pedir_revision(client, equipo['colab'], act_id)
    url = f'/api/actividades/{act_id}/revision'
    assert client.post(url, json={'decision': 'xxx'}, headers=admin['h']).status_code == 400
    assert client.post(url, json={'decision': 'devuelta', 'comentario': '  '}, headers=admin['h']).status_code == 400
    assert client.post(url, json={'decision': 'aprobada_continuar'}, headers=admin['h']).status_code == 200


def test_autoguardado_viejo_no_pisa_la_decision(client, equipo):
    colab, lider = equipo['colab'], equipo['lider']
    bit = _crear_tarea(client, colab)
    act = bit['actividades'][0]
    _pedir_revision(client, colab, act['id'])
    client.post(f"/api/actividades/{act['id']}/revision", json={'decision': 'aprobada_cerrada'}, headers=lider['h'])

    # El navegador del colaborador aún tiene la versión 'en_revision' sin revisado_at
    stale = {**act, 'estado': 'en_revision', 'revisado_at': None}
    r = client.post('/api/bitacoras', json={
        'id': bit['id'], 'fecha': bit['fecha'], 'colaborador': colab['user']['full_name'],
        'user_id': colab['user']['id'], 'actividades': [stale],
    }, headers=colab['h'])
    assert r.status_code == 200
    assert r.json['bitacora']['actividades'][0]['estado'] == 'completada'
