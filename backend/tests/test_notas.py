"""Pruebas integrales para el módulo versátil de Notas & Contexto Operativo."""
from datetime import datetime, timedelta

from database import get_db, get_peru_today_str
from app import rollover_user_open_tasks


def test_migration_v5_and_tables_exist(client):
    h = client.get('/api/health')
    assert h.status_code == 200
    assert h.json['schema_version'] >= 5
    conn = get_db()
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    assert 'notas' in tables
    assert 'nota_actividad_vinculos' in tables


def test_notas_crud_search_filters_and_pagination(client, make_user):
    u = make_user()
    # Crear 3 notas variadas
    n1 = client.post('/api/notas', json={
        'titulo': 'Minuta SUNAT Fase 4D',
        'contenido': '<p>Validar RHE y nota de crédito<script>alert(1)</script></p>',
        'tipo_nota': 'reunion',
        'para_cliente': '  SOLOPROMO   SAC ',
        'etiquetas': ['SUNAT', 'Urgente', 'sunat'],
        'is_pinned': True,
        'fecha_recordatorio': get_peru_today_str(),
    }, headers=u['h'])
    assert n1.status_code == 201
    nota1 = n1.json['nota']
    assert '<script>' not in nota1['contenido']
    assert nota1['para_cliente'] == 'SOLOPROMO SAC'
    assert nota1['etiquetas'] == ['sunat', 'urgente']
    assert nota1['is_pinned'] is True

    n2 = client.post('/api/notas', json={
        'titulo': 'Checklist deploy servidor',
        'tipo_nota': 'checklist',
        'checklist_json': [
            {'id': 'c1', 'texto': 'Respaldar bitacora.db', 'completado': False},
            {'id': 'c2', 'texto': 'Reiniciar gunicorn', 'completado': True},
        ],
        'etiquetas': ['infra'],
    }, headers=u['h'])
    assert n2.status_code == 201
    nota2 = n2.json['nota']

    n3 = client.post('/api/notas', json={
        'titulo': 'Nota archivada vieja',
        'estado': 'archivada',
    }, headers=u['h'])
    assert n3.status_code == 201

    # Búsqueda por texto libre dentro de checklist_json
    r_q = client.get('/api/notas?q=gunicorn', headers=u['h'])
    assert r_q.status_code == 200
    assert len(r_q.json) == 1
    assert r_q.json[0]['id'] == nota2['id']

    # Filtro por fecha_recordatorio y paginación
    r_rec = client.get(f"/api/notas?fecha_recordatorio={get_peru_today_str()}&limit=1&offset=0", headers=u['h'])
    assert r_rec.status_code == 200
    assert r_rec.headers['X-Total-Count'] == '1'
    assert r_rec.headers['X-Has-More'] == '0'
    assert r_rec.json[0]['id'] == nota1['id']

    # Filtro archivadas
    r_arch = client.get('/api/notas?estado=archivada', headers=u['h'])
    assert r_arch.status_code == 200
    assert len(r_arch.json) == 1
    assert r_arch.json[0]['titulo'] == 'Nota archivada vieja'

    # Toggle checklist rápido
    r_chk = client.patch(
        f"/api/notas/{nota2['id']}/checklist",
        json={'item_id': 'c1', 'completado': True},
        headers=u['h'],
    )
    assert r_chk.status_code == 200
    assert all(i['completado'] for i in r_chk.json['nota']['checklist_json'])

    # Papelera suave -> restaurar -> eliminar definitivo
    assert client.delete(f"/api/notas/{nota1['id']}", headers=u['h']).status_code == 200
    assert len(client.get('/api/notas?estado=papelera', headers=u['h']).json) == 1
    assert client.post(f"/api/notas/{nota1['id']}/restaurar", headers=u['h']).status_code == 200
    assert client.delete(f"/api/notas/{nota1['id']}", headers=u['h']).status_code == 200
    assert client.delete(f"/api/notas/{nota1['id']}?permanent=1", headers=u['h']).status_code == 200


def test_notas_rbac_privacy_personal_shared_and_team(client, admin, make_user):
    # Crear equipo con líder
    lider = make_user(role='lider')
    r_team = client.post('/api/admin/teams', json={
        'nombre': 'Equipo QA Notas',
        'lider_id': lider['user']['id'],
    }, headers=admin['h'])
    assert r_team.status_code in (200, 201)
    team_id = r_team.json.get('team_id') or r_team.json.get('id')

    analista_a = make_user(role='analista', team_id=team_id)
    analista_b = make_user(role='analista', team_id=team_id)
    analista_ext = make_user(role='analista')

    # 1. Nota personal: estrictamente privada (ni admin ni líder pueden leerla/editarla)
    rp = client.post('/api/notas', json={
        'titulo': 'Borrador personal secreto',
        'contenido': 'Solo para mí',
        'visibilidad': 'personal',
    }, headers=analista_a['h'])
    assert rp.status_code == 201
    p_id = rp.json['nota']['id']

    assert client.get(f'/api/notas/{p_id}', headers=analista_a['h']).status_code == 200
    assert client.get(f'/api/notas/{p_id}', headers=lider['h']).status_code == 403
    assert client.get(f'/api/notas/{p_id}', headers=admin['h']).status_code == 403
    assert client.get('/api/notas?estado=todas', headers=admin['h']).json == [] or all(
        n['id'] != p_id for n in client.get('/api/notas?estado=todas', headers=admin['h']).json
    )

    # 2. Nota compartida solo con analista_b
    rs = client.post('/api/notas', json={
        'titulo': 'Nota compartida A+B',
        'visibilidad': 'compartida',
        'shared_with': [analista_b['user']['id']],
    }, headers=analista_a['h'])
    assert rs.status_code == 201
    s_id = rs.json['nota']['id']

    assert client.get(f'/api/notas/{s_id}', headers=analista_b['h']).status_code == 200
    assert client.get(f'/api/notas/{s_id}', headers=analista_ext['h']).status_code == 403
    # analista_b puede colaborar editando contenido, pero no eliminar la nota ajena
    assert client.patch(f'/api/notas/{s_id}', json={'contenido': 'Aporte B'}, headers=analista_b['h']).status_code == 200
    assert client.delete(f'/api/notas/{s_id}', headers=analista_b['h']).status_code == 403

    # 3. Nota de equipo: visible para miembro del mismo equipo y líder, oculta para externo
    rt = client.post('/api/notas', json={
        'titulo': 'Minuta del equipo QA',
        'visibilidad': 'equipo',
    }, headers=analista_a['h'])
    assert rt.status_code == 201
    t_id = rt.json['nota']['id']

    assert client.get(f'/api/notas/{t_id}', headers=lider['h']).status_code == 200
    assert client.get(f'/api/notas/{t_id}', headers=analista_b['h']).status_code == 200
    assert client.get(f'/api/notas/{t_id}', headers=analista_ext['h']).status_code == 403


def test_bidirectional_nm_linking_checklist_conversion_and_rollover_inheritance(client, make_user):
    u = make_user()
    ayer = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    hoy = get_peru_today_str()

    # Crear nota con checklist y convertir un ítem específico a actividad de AYER (en_proceso)
    rn = client.post('/api/notas', json={
        'titulo': 'Migración ERP',
        'para_cliente': 'Gerencia',
        'tipo_nota': 'checklist',
        'checklist_json': [
            {'id': 'step-1', 'texto': 'Exportar maestros de proveedores', 'completado': False},
            {'id': 'step-2', 'texto': 'Validar asientos contables', 'completado': False},
        ],
    }, headers=u['h'])
    assert rn.status_code == 201
    nota_id = rn.json['nota']['id']

    conv = client.post(f'/api/notas/{nota_id}/convertir', json={
        'fecha': ayer,
        'checklist_item_id': 'step-1',
        'hora_inicio': '09:00',
        'duracion_min': 60,
        'estado': 'en_proceso',
    }, headers=u['h'])
    assert conv.status_code == 201
    act1_id = conv.json['actividad']['id']
    assert conv.json['nota']['estado_operativo'] == 'en_ejecucion'
    assert any(c['id'] == 'step-1' and c['actividad_id'] == act1_id for c in conv.json['nota']['checklist_json'])

    # Crear segunda actividad hoy directamente desde /api/actividades vinculando la misma nota (N:M)
    r_act2 = client.post('/api/actividades', json={
        'fecha': hoy,
        'user_id': u['user']['id'],
        'colaborador': u['user']['full_name'],
        'hora_inicio': '10:00',
        'duracion_min': 30,
        'tipo_trabajo': 'Desarrollo',
        'descripcion': 'Revisión técnica complementaria',
        'estado': 'completada',
        'nota_ids': [nota_id],
    }, headers=u['h'])
    assert r_act2.status_code in (200, 201)
    assert r_act2.json['actividad']['id']
    assert any(n['id'] == nota_id for n in r_act2.json['actividad']['notas_vinculadas'])

    # También correr rollover explícito de ayer -> hoy y verificar que act1 arrastrada heredó la nota vinculada
    conn = get_db()
    cur = conn.cursor()
    rolled = rollover_user_open_tasks(cur, u['user']['id'], u['user']['full_name'], hoy, f'{hoy} 08:30:00')
    conn.commit()
    assert rolled >= 1

    # Consultar bitácoras de hoy y verificar que tanto act2 como la copia rollover traen `notas_vinculadas`
    r_bits = client.get(f'/api/bitacoras?fecha={hoy}', headers=u['h'])
    assert r_bits.status_code == 200
    acts_hoy = r_bits.json[0]['actividades']
    assert len(acts_hoy) >= 2
    for a in acts_hoy:
        assert any(n['id'] == nota_id for n in a.get('notas_vinculadas', [])), a

    # Verificar el detalle de la nota muestra >= 2 actividades vinculadas y tiempo acumulado
    nota_det = client.get(f'/api/notas/{nota_id}', headers=u['h']).json
    assert nota_det['actividades_count'] >= 2
    assert nota_det['tiempo_total_min'] >= 90


def test_mcp_notes_tools_privacy_and_mode(client, admin, make_user):
    u = make_user()
    # Crear 1 nota personal del analista y 1 nota de equipo
    rp = client.post('/api/notas', json={
        'titulo': 'Secreto analista MCP',
        'visibilidad': 'personal',
    }, headers=u['h'])
    assert rp.status_code == 201
    personal_id = rp.json['nota']['id']

    rt = client.post('/api/notas', json={
        'titulo': 'Contexto público de equipo MCP',
        'visibilidad': 'equipo',
        'para_cliente': 'SISTEMAS',
    }, headers=u['h'])
    assert rt.status_code == 201

    cfg = client.get('/api/admin/mcp/config', headers=admin['h']).json
    api_key = cfg['api_key']

    # Asegurar modo read_only primero
    client.post('/api/admin/mcp/config', json={'enabled': True, 'access_mode': 'read_only'}, headers=admin['h'])

    # Buscar notas vía MCP: encuentra nota de equipo pero jamás nota personal
    r_search = client.post('/api/mcp', json={
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'tools/call',
        'params': {'name': 'buscar_notas', 'arguments': {'texto_busqueda': 'MCP'}},
    }, headers={'X-MCP-API-Key': api_key})
    assert r_search.status_code == 200
    structured = r_search.json['result']['structuredContent']
    titles = [n['titulo'] for n in structured['notas']]
    assert 'Contexto público de equipo MCP' in titles
    assert 'Secreto analista MCP' not in titles

    # Consultar nota personal por ID vía MCP debe fallar por privacidad
    r_priv = client.post('/api/mcp', json={
        'jsonrpc': '2.0',
        'id': 2,
        'method': 'tools/call',
        'params': {'name': 'obtener_nota_contexto', 'arguments': {'nota_id': personal_id}},
    }, headers={'X-MCP-API-Key': api_key})
    assert r_priv.json['result']['isError'] is True

    # crear_nota bloqueado en read_only
    r_ro = client.post('/api/mcp', json={
        'jsonrpc': '2.0',
        'id': 3,
        'method': 'tools/call',
        'params': {'name': 'crear_nota', 'arguments': {'titulo': 'IA blocked'}},
    }, headers={'X-MCP-API-Key': api_key})
    assert r_ro.json['result']['isError'] is True

    # Habilitar read_write -> crear_nota funciona
    client.post('/api/admin/mcp/config', json={'enabled': True, 'access_mode': 'read_write'}, headers=admin['h'])
    try:
        r_rw = client.post('/api/mcp', json={
            'jsonrpc': '2.0',
            'id': 4,
            'method': 'tools/call',
            'params': {'name': 'crear_nota', 'arguments': {'titulo': 'IA Nota OK', 'visibilidad': 'equipo'}},
        }, headers={'X-MCP-API-Key': api_key})
        assert r_rw.json['result']['isError'] is False
        assert r_rw.json['result']['structuredContent']['status'] == 'created'
    finally:
        client.post('/api/admin/mcp/config', json={'enabled': True, 'access_mode': 'read_only'}, headers=admin['h'])


def test_quick_note_linked_on_activity_create_edit_and_bitacora_sync(client, make_user):
    u = make_user()
    hoy = get_peru_today_str()

    # 1. Nota rápida creada desde flujo de creación de actividad y vinculada al crear actividad
    rn1 = client.post('/api/notas', json={
        'titulo': 'Acuerdo rápido de llamada',
        'contenido': '<p>Revisar DNS</p>',
        'tipo_nota': 'apunte',
        'para_cliente': 'Gerencia',
        'visibilidad': 'personal',
    }, headers=u['h'])
    assert rn1.status_code == 201
    n1_id = rn1.json['nota']['id']

    r_create = client.post('/api/actividades', json={
        'fecha': hoy,
        'user_id': u['user']['id'],
        'colaborador': u['user']['full_name'],
        'hora_inicio': '09:00',
        'duracion_min': 30,
        'tipo_trabajo': 'Desarrollo',
        'descripcion': 'Configurar registros DNS',
        'para_cliente': 'Gerencia',
        'estado': 'en_proceso',
        'nota_ids': [n1_id],
    }, headers=u['h'])
    assert r_create.status_code in (200, 201)
    act_id = r_create.json['actividad']['id']
    assert [n['id'] for n in r_create.json['actividad']['notas_vinculadas']] == [n1_id]

    # 2. Al editar la actividad, crear segunda nota rápida y vincular ambas vía PUT /api/actividades/<id>
    rn2 = client.post('/api/notas', json={
        'titulo': 'Checklist post-cambio',
        'tipo_nota': 'checklist',
        'checklist_json': [{'id': 'c1', 'texto': 'Validar SSL', 'completado': False}],
        'para_cliente': 'Gerencia',
    }, headers=u['h'])
    assert rn2.status_code == 201
    n2_id = rn2.json['nota']['id']

    r_edit = client.put(f'/api/actividades/{act_id}', json={
        'descripcion': 'Configurar registros DNS y certificado SSL',
        'nota_ids': [n1_id, n2_id],
    }, headers=u['h'])
    assert r_edit.status_code == 200
    linked_ids = {n['id'] for n in r_edit.json['actividad']['notas_vinculadas']}
    assert linked_ids == {n1_id, n2_id}

    # 3. Sincronización completa por POST /api/bitacoras conserva/actualiza nota_ids
    r_bit = client.post('/api/bitacoras', json={
        'fecha': hoy,
        'user_id': u['user']['id'],
        'colaborador': u['user']['full_name'],
        'actividades': [{
            'id': act_id,
            'hora_inicio': '09:00',
            'duracion_min': 30,
            'tipo_trabajo': 'Desarrollo',
            'descripcion': 'Configurar registros DNS y certificado SSL',
            'para_cliente': 'Gerencia',
            'estado': 'completada',
            'nota_ids': [n2_id],
        }],
    }, headers=u['h'])
    assert r_bit.status_code == 200
    acts_saved = r_bit.json['bitacora']['actividades']
    target_act = next(a for a in acts_saved if a['id'] == act_id)
    assert [n['id'] for n in target_act['notas_vinculadas']] == [n2_id]
