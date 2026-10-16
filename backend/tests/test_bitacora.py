"""Guardado de bitácoras sin pérdida de datos, propiedad y arrastre diario (rollover)."""


def _payload(user, fecha, acts, **extra):
    return {'fecha': fecha, 'colaborador': user['user']['full_name'], 'user_id': user['user']['id'], 'actividades': acts, **extra}


def test_save_bitacora_lifecycle(client, make_user):
    ana = make_user()
    fecha = '2026-10-15'
    acts = [
        {'id': 'act-1-aaaa', 'descripcion': 'Tarea A', 'duracion_min': 30, 'hora_inicio': '08:30', 'estado': 'completada'},
        {'id': 'act-2-bbbb', 'descripcion': 'Tarea B', 'duracion_min': 45, 'hora_inicio': '09:00', 'estado': 'en_proceso'},
    ]
    b = _payload(ana, fecha, acts)
    r = client.post('/api/bitacoras', json=b, headers=ana['h'])
    assert r.status_code == 200
    srv = r.json['bitacora']
    saved = srv['actividades']
    assert len(saved) == 2 and all(a.get('client_uid') for a in saved)
    assert srv['tiempo_total_min'] == 75

    # Reintento con ids temporales (respuesta perdida): no duplica
    r = client.post('/api/bitacoras', json=b, headers=ana['h'])
    assert len(r.json['bitacora']['actividades']) == 2

    # Cliente desactualizado que envía solo una: la otra NO va a la papelera
    a0 = saved[0]
    r = client.post('/api/bitacoras', json={**b, 'id': srv['id'], 'actividades': [a0]}, headers=ana['h'])
    assert len(r.json['bitacora']['actividades']) == 2

    # Eliminación explícita
    r = client.post('/api/bitacoras', json={**b, 'id': srv['id'], 'actividades': [a0], 'deleted_ids': [saved[1]['id']]}, headers=ana['h'])
    assert len(r.json['bitacora']['actividades']) == 1

    # Un borrador viejo no resucita lo eliminado
    r = client.post('/api/bitacoras', json={**b, 'id': srv['id'], 'actividades': [a0, saved[1]]}, headers=ana['h'])
    assert len(r.json['bitacora']['actividades']) == 1

    # Un id de bitácora con otra fecha no mueve la bitácora original
    r = client.post('/api/bitacoras', json=_payload(ana, '2026-10-14', [], id=srv['id']), headers=ana['h'])
    assert r.json['bitacora']['id'] != srv['id']
    assert client.get('/api/bitacoras/%s' % srv['id'], headers=ana['h']).json['fecha'] == fecha

    # Modo merge: no pisa datos más nuevos del servidor
    a0_srv = client.get('/api/bitacoras/%s' % srv['id'], headers=ana['h']).json['actividades'][0]
    r = client.post('/api/bitacoras', json={**b, 'sync_mode': 'merge', 'actividades': [
        {**a0_srv, 'descripcion': 'stale', 'updated_at': '2000-01-01 00:00:00'}]}, headers=ana['h'])
    assert r.json['bitacora']['actividades'][0]['descripcion'] == 'Tarea A'
    assert r.json.get('conflicts') == 1


def test_cannot_write_other_users_bitacora(client, make_user):
    ana, beto = make_user(), make_user()
    r = client.post('/api/bitacoras', json=_payload(ana, '2026-10-15', [
        {'id': 'act-x', 'descripcion': 'Privada', 'duracion_min': 10, 'hora_inicio': '08:30', 'estado': 'completada'}]), headers=ana['h'])
    act_id = r.json['bitacora']['actividades'][0]['id']
    bit_id = r.json['bitacora']['id']

    assert client.post('/api/bitacoras', json=_payload(ana, '2026-10-15', []), headers=beto['h']).status_code == 403
    assert client.put('/api/actividades/%s' % act_id, json={'descripcion': 'hack'}, headers=beto['h']).status_code == 403
    assert client.get('/api/bitacoras/%s' % bit_id, headers=beto['h']).status_code == 403


def test_future_rollover_rejected(client, admin):
    assert client.get('/api/cron/rollover?date=2099-01-01', headers=admin['h']).status_code == 400


def test_rollover_carries_open_tasks_and_skips_weekends(client, admin, make_user):
    u = make_user()
    # Jueves 2026-10-08: una tarea abierta y una completada
    client.post('/api/bitacoras', json=_payload(u, '2026-10-08', [
        {'id': 'act-open', 'descripcion': 'Abierta', 'duracion_min': 60, 'hora_inicio': '08:30', 'estado': 'en_proceso'},
        {'id': 'act-done', 'descripcion': 'Cerrada', 'duracion_min': 30, 'hora_inicio': '09:30', 'estado': 'completada'},
    ]), headers=u['h'])

    r = client.get('/api/cron/rollover?date=2026-10-09', headers=admin['h'])  # viernes
    assert r.status_code == 200

    def bitacoras_on(fecha):
        return client.get('/api/bitacoras?fecha=%s&user_id=%s' % (fecha, u['user']['id']), headers=u['h']).json

    friday = bitacoras_on('2026-10-09')
    assert len(friday) == 1
    carried = friday[0]['actividades']
    assert [a['descripcion'] for a in carried] == ['Abierta']
    assert carried[0]['duracion_min'] == 0  # no duplica horas

    # Re-ejecutar no duplica
    client.get('/api/cron/rollover?date=2026-10-09', headers=admin['h'])
    assert len(bitacoras_on('2026-10-09')[0]['actividades']) == 1

    # Sábado: no se crean bitácoras vacías
    client.get('/api/cron/rollover?date=2026-10-10', headers=admin['h'])
    assert bitacoras_on('2026-10-10') == []

    # El jueves quedó cerrado por el sistema
    thursday = bitacoras_on('2026-10-08')[0]
    assert thursday['estado'] in ('cerrada_sistema', 'cerrada')
