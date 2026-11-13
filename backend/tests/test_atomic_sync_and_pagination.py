"""Pruebas de sincronización atómica (C2) y paginación ligera de historial (C3)."""


def test_atomic_create_patch_header_and_proxy_concurrency(client, admin, make_user):
    titular = make_user(role='analista')
    apoyo = make_user(role='analista')

    # Asignar delegación activa de apoyo -> titular
    r_del = client.post('/api/admin/delegations', json={
        'delegate_user_id': apoyo['user']['id'],
        'target_user_id': titular['user']['id'],
        'motivo': 'Soporte operativo simultáneo',
    }, headers=admin['h'])
    assert r_del.status_code == 201, r_del.get_data(as_text=True)

    fecha = '2026-11-10'

    # 1) El titular crea atómicamente una tarea contenedora de 120 min (09:00 - 11:00)
    r1 = client.post('/api/actividades', json={
        'fecha': fecha,
        'user_id': titular['user']['id'],
        'colaborador': titular['user']['full_name'],
        'hora_inicio_jornada': '08:30',
        'actividad': {
            'id': 'act-temp-owner-1',
            'hora_inicio': '09:00',
            'duracion_min': 120,
            'tipo_trabajo': 'Desarrollo',
            'descripcion': 'Desarrollo módulo principal',
            'para_cliente': 'Gerencia',
            'estado': 'en_proceso',
        },
    }, headers=titular['h'])
    assert r1.status_code == 201, r1.get_data(as_text=True)
    b_id = r1.json['bitacora_id']
    owner_act_id = r1.json['actividad']['id']
    assert r1.json['tiempo_total_min'] == 120

    # Idempotencia por client_uid: reintentar con el mismo id temporal no duplica la fila
    r1_dup = client.post('/api/actividades', json={
        'bitacora_id': b_id,
        'fecha': fecha,
        'user_id': titular['user']['id'],
        'actividad': {
            'client_uid': 'act-temp-owner-1',
            'hora_inicio': '09:00',
            'duracion_min': 120,
            'tipo_trabajo': 'Desarrollo',
            'descripcion': 'Desarrollo módulo principal (confirmado)',
            'para_cliente': 'Gerencia',
            'estado': 'en_proceso',
        },
    }, headers=titular['h'])
    assert r1_dup.status_code == 200
    assert r1_dup.json['actividad']['id'] == owner_act_id
    assert len(r1_dup.json['bitacora_actividades']) == 1

    # 2) El usuario en Modo Apoyo inserta una subtarea dentro del rango (10:00 - 10:30, 30m)
    #    sin conocer ni reenviar el arreglo de actividades del titular
    r2 = client.post('/api/actividades', json={
        'fecha': fecha,
        'user_id': titular['user']['id'],
        'colaborador': titular['user']['full_name'],
        'actividad': {
            'id': 'act-temp-proxy-1',
            'hora_inicio': '10:00',
            'duracion_min': 30,
            'tipo_trabajo': 'Reunión',
            'descripcion': 'Coordinación urgente con cliente',
            'para_cliente': 'Gerencia',
            'estado': 'completada',
        },
    }, headers=apoyo['h'])
    assert r2.status_code == 201, r2.get_data(as_text=True)
    proxy_act_id = r2.json['actividad']['id']
    acts_after = {a['id']: a for a in r2.json['bitacora_actividades']}
    assert owner_act_id in acts_after and proxy_act_id in acts_after
    # El solapamiento descuenta los 30m de la tarea contenedora (120 - 30 = 90m netos; total 90 + 30 = 120m)
    assert acts_after[owner_act_id]['duracion_min'] == 90
    assert acts_after[proxy_act_id]['duracion_min'] == 30
    assert r2.json['tiempo_total_min'] == 120

    # 3) PATCH parcial de actividad (cambia subtarea a 45m -> contenedora baja a 75m)
    r_patch = client.patch(f'/api/actividades/{proxy_act_id}', json={
        'duracion_min': 45,
    }, headers=apoyo['h'])
    assert r_patch.status_code == 200, r_patch.get_data(as_text=True)
    acts_patched = {a['id']: a for a in r_patch.json['bitacora_actividades']}
    assert acts_patched[owner_act_id]['duracion_min'] == 75
    assert acts_patched[proxy_act_id]['duracion_min'] == 45
    assert r_patch.json['tiempo_total_min'] == 120

    # 4) PATCH parcial de cabecera: el apoyo puede anotar apoyo_detalle pero NO cerrar la jornada del titular
    r_hdr_proxy = client.patch(f'/api/bitacoras/{b_id}/header', json={
        'pendientes': 'Validar pase a producción',
        'estado': 'cerrada',
    }, headers=apoyo['h'])
    assert r_hdr_proxy.status_code == 200
    assert r_hdr_proxy.json['header']['pendientes'] == 'Validar pase a producción'
    assert r_hdr_proxy.json['header']['estado'] != 'cerrada'

    # El titular sí puede cerrar su jornada sin tocar ni borrar las actividades creadas por apoyo
    r_hdr_owner = client.patch(f'/api/bitacoras/{b_id}/header', json={
        'prioridad_siguiente': 'Despliegue final',
        'estado': 'cerrada',
    }, headers=titular['h'])
    assert r_hdr_owner.status_code == 200
    assert r_hdr_owner.json['header']['estado'] == 'cerrada'
    assert r_hdr_owner.json['header']['pendientes'] == 'Validar pase a producción'

    r_full = client.get(f'/api/bitacoras/{b_id}', headers=titular['h'])
    assert r_full.status_code == 200
    assert len(r_full.json['actividades']) == 2


def test_atomic_endpoints_reject_unauthorized_analyst(client, make_user):
    victim = make_user(role='analista')
    intruder = make_user(role='analista')

    r_create = client.post('/api/actividades', json={
        'fecha': '2026-11-11',
        'user_id': victim['user']['id'],
        'colaborador': victim['user']['full_name'],
        'actividad': {'descripcion': 'Intento no autorizado', 'duracion_min': 15},
    }, headers=intruder['h'])
    assert r_create.status_code == 403

    r_legit = client.post('/api/actividades', json={
        'fecha': '2026-11-11',
        'user_id': victim['user']['id'],
        'colaborador': victim['user']['full_name'],
        'actividad': {'descripcion': 'Tarea legítima', 'duracion_min': 30},
    }, headers=victim['h'])
    assert r_legit.status_code == 201
    act_id = r_legit.json['actividad']['id']
    b_id = r_legit.json['bitacora_id']

    assert client.patch(f'/api/actividades/{act_id}', json={'descripcion': 'Hack'}, headers=intruder['h']).status_code == 403
    assert client.patch(f'/api/bitacoras/{b_id}/header', json={'pendientes': 'Hack'}, headers=intruder['h']).status_code == 403


def test_paginated_summary_bitacoras_and_on_demand_detail(client, make_user):
    u = make_user(role='analista')
    fechas = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']
    created_ids = []
    for f in fechas:
        r = client.post('/api/actividades', json={
            'fecha': f,
            'user_id': u['user']['id'],
            'colaborador': u['user']['full_name'],
            'actividad': {
                'hora_inicio': '09:00',
                'duracion_min': 60,
                'tipo_trabajo': 'Soporte',
                'descripcion': f'<p><strong>Reporte {f}</strong> con formato&nbsp;HTML enriquecido</p>',
                'evidencias': [{'nombre': 'evidencia.pdf', 'url': '/api/uploads/20990101_000000_doc.pdf', 'tipo': 'application/pdf'}],
                'estado': 'completada',
            },
        }, headers=u['h'])
        assert r.status_code == 201
        created_ids.append(r.json['bitacora_id'])

    # Página 1 (limit=2, offset=0, summary=1)
    p1 = client.get(
        f"/api/bitacoras?user_id={u['user']['id']}&summary=1&limit=2&offset=0",
        headers=u['h'],
    )
    assert p1.status_code == 200
    assert int(p1.headers.get('X-Total-Count', '0')) == 4
    assert p1.headers.get('X-Has-More') == '1'
    assert len(p1.json) == 2
    first_item = p1.json[0]
    assert first_item.get('is_summary') is True
    first_act = first_item['actividades'][0]
    assert '<p>' not in first_act['descripcion']
    assert '&nbsp;' not in first_act['descripcion']
    assert first_act['evidencias'] == []
    assert first_act['evidencias_count'] == 1

    # Página 2 (limit=2, offset=2, summary=1)
    p2 = client.get(
        f"/api/bitacoras?user_id={u['user']['id']}&summary=1&limit=2&offset=2",
        headers=u['h'],
    )
    assert p2.status_code == 200
    assert p2.headers.get('X-Has-More') == '0'
    assert len(p2.json) == 2
    assert {b['id'] for b in p1.json}.isdisjoint({b['id'] for b in p2.json})

    # Hidratación completa bajo demanda (GET /api/bitacoras/<id>)
    full_res = client.get(f"/api/bitacoras/{first_item['id']}", headers=u['h'])
    assert full_res.status_code == 200
    full_act = full_res.json['actividades'][0]
    assert '<strong>' in full_act['descripcion']
    assert len(full_act['evidencias']) == 1
