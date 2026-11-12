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


def test_admin_hot_backup_download_and_rbac(client, make_user):
    """El respaldo en caliente SQLite solo puede ser descargado por admin y entrega un binario SQLite válido."""
    analista = make_user(role='analista')
    admin = make_user(role='admin')

    # Analista no puede descargar backup
    r_forbid = client.get('/api/admin/backup-db', headers=analista['h'])
    assert r_forbid.status_code == 403

    # Admin descarga un archivo SQLite íntegro
    r_ok = client.get('/api/admin/backup-db', headers=admin['h'])
    assert r_ok.status_code == 200
    assert r_ok.data[:16] == b'SQLite format 3\x00'
    r_ok.close()

    # El listado de backups incluye el respaldo recién generado
    r_list = client.get('/api/admin/backups', headers=admin['h'])
    assert r_list.status_code == 200
    assert r_list.json['total'] >= 1


def test_clientes_sugerencias_normalizacion(client, make_user):
    """Normaliza espacios en para_cliente al guardar y deduplica sugerencias ignorando mayúsculas."""
    u = make_user()
    res = client.post('/api/bitacoras', json={
        'fecha': '2026-10-22',
        'colaborador': u['user']['full_name'],
        'user_id': u['user']['id'],
        'actividades': [
            {'id': 'c1', 'descripcion': 'T1', 'para_cliente': '  Marketing   Alterno  ', 'duracion_min': 20, 'hora_inicio': '08:30', 'estado': 'completada'},
            {'id': 'c2', 'descripcion': 'T2', 'para_cliente': 'Marketing Alterno', 'duracion_min': 30, 'hora_inicio': '09:00', 'estado': 'completada'},
            {'id': 'c3', 'descripcion': 'T3', 'para_cliente': 'marketing alterno', 'duracion_min': 15, 'hora_inicio': '09:30', 'estado': 'completada'},
        ],
    }, headers=u['h'])
    assert res.status_code == 200
    saved_acts = res.json['bitacora']['actividades']
    assert saved_acts[0]['para_cliente'] == 'Marketing Alterno'

    sug = client.get('/api/clientes/sugerencias', headers=u['h'])
    assert sug.status_code == 200
    clientes = sug.json['clientes']
    assert 'Marketing Alterno' in clientes
    # No debe duplicarse en minúsculas
    assert sum(1 for c in clientes if c.lower() == 'marketing alterno') == 1


def test_mcp_server_jsonrpc_rest_and_security(client, make_user):
    """Verifica el servidor MCP (JSON-RPC 2.0, puente REST, OpenAPI, aislamiento de clave y modos de acceso)."""
    admin = make_user(role='admin')
    analista = make_user(role='analista')

    # 1. Analista no puede leer la configuración MCP de admin
    assert client.get('/api/admin/mcp/config', headers=analista['h']).status_code == 403

    # 2. Admin obtiene la configuración MCP e inicializa la API Key
    r_cfg = client.get('/api/admin/mcp/config', headers=admin['h'])
    assert r_cfg.status_code == 200
    mcp_key = r_cfg.json['api_key']
    assert mcp_key.startswith('mcp_bita_')
    assert r_cfg.json['access_mode'] == 'read_only'

    mcp_headers = {'Authorization': f'Bearer {mcp_key}'}

    # 3. La API Key MCP NO puede usarse fuera de /api/mcp*
    r_outside = client.get('/api/users', headers=mcp_headers)
    assert r_outside.status_code == 403

    # 4. JSON-RPC 2.0: initialize, tools/list, tools/call y resources/read
    r_init = client.post('/api/mcp', json={
        'jsonrpc': '2.0',
        'id': 1,
        'method': 'initialize',
        'params': {'protocolVersion': '2024-11-05'},
    }, headers=mcp_headers)
    assert r_init.status_code == 200
    assert r_init.json['result']['serverInfo']['name'] == 'bitacora-mkt-mcp'

    r_tools = client.post('/api/mcp', json={
        'jsonrpc': '2.0',
        'id': 2,
        'method': 'tools/list',
    }, headers=mcp_headers)
    assert r_tools.status_code == 200
    tool_names = [t['name'] for t in r_tools.json['result']['tools']]
    assert 'resumen_ejecutivo_equipo' in tool_names
    assert 'consultar_actividades' in tool_names

    r_call = client.post('/api/mcp', json={
        'jsonrpc': '2.0',
        'id': 3,
        'method': 'tools/call',
        'params': {'name': 'resumen_ejecutivo_equipo', 'arguments': {'periodo': 'hoy'}},
    }, headers=mcp_headers)
    assert r_call.status_code == 200
    assert r_call.json['result']['isError'] is False
    assert 'kpis' in r_call.json['result']['structuredContent']

    # 5. En modo read_only, registrar_actividad_bitacora es rechazado
    r_write_denied = client.post('/api/mcp/query', json={
        'tool': 'registrar_actividad_bitacora',
        'arguments': {'colaborador': analista['user']['username'], 'descripcion': 'Tarea desde IA'},
    }, headers=mcp_headers)
    assert r_write_denied.status_code == 403

    # 6. Admin habilita read_write y el agente IA registra actividad
    client.post('/api/admin/mcp/config', json={'access_mode': 'read_write'}, headers=admin['h'])
    r_write_ok = client.post('/api/mcp/query', json={
        'tool': 'registrar_actividad_bitacora',
        'arguments': {
            'colaborador': analista['user']['username'],
            'descripcion': 'Tarea creada por Agente IA MCP',
            'para_cliente': 'SOLOPROMO',
            'duracion_min': 45,
        },
    }, headers=mcp_headers)
    assert r_write_ok.status_code == 200
    assert r_write_ok.json['result']['status'] == 'created'

    # 7. Rotación de clave invalida la anterior inmediatamente
    r_rot = client.post('/api/admin/mcp/rotate-key', headers=admin['h'])
    assert r_rot.status_code == 200
    new_key = r_rot.json['api_key']
    assert new_key != mcp_key
    assert client.get('/api/mcp', headers=mcp_headers).status_code == 401
    assert client.get('/api/mcp', headers={'Authorization': f'Bearer {new_key}'}).status_code == 200

    # 8. Descubrimiento y flujo OAuth 2.0 / 2.1 para Gemini Web / Claude Web
    r_unauth = client.post('/api/mcp', json={'jsonrpc': '2.0', 'id': 1, 'method': 'ping'})
    assert r_unauth.status_code == 401
    assert 'resource_metadata=' in r_unauth.headers.get('WWW-Authenticate', '')

    r_prm = client.get('/.well-known/oauth-protected-resource')
    assert r_prm.status_code == 200
    assert r_prm.json['resource'].endswith('/api/mcp')

    r_as = client.get('/.well-known/oauth-authorization-server')
    assert r_as.status_code == 200
    assert r_as.json['authorization_endpoint'].endswith('/api/mcp/oauth/authorize')
    assert r_as.json['token_endpoint'].endswith('/api/mcp/oauth/token')

    r_auth_post = client.post('/api/mcp/oauth/authorize', data={
        'response_type': 'code',
        'client_id': 'bitacora-mcp',
        'redirect_uri': 'https://gemini.google.com/callback',
        'state': 'xyz123',
        'mcp_api_key': new_key,
    })
    assert r_auth_post.status_code == 302
    loc = r_auth_post.headers['Location']
    assert 'https://gemini.google.com/callback?code=' in loc
    code_val = loc.split('code=')[1].split('&')[0]

    r_tok = client.post('/api/mcp/oauth/token', data={
        'grant_type': 'authorization_code',
        'code': code_val,
        'client_id': 'bitacora-mcp',
        'client_secret': new_key,
    })
    assert r_tok.status_code == 200
    assert r_tok.json['access_token'] == new_key




def test_migration_v3_and_dashboard_indexed_queries(client, make_user, admin):
    """Verifica migración v3 (backfill seguro de user_id sin colisión única) y consultas optimizadas de Dashboard."""
    from database import _mig_003_backfill_bitacora_user_ids_and_indexes, get_schema_version
    assert get_schema_version() >= 3

    u = make_user()
    team_id = _make_team(u['user']['id'], 'Escuadron Optimizacion')

    # Insertar una bitácora legacy sin user_id y otra con colisión en misma fecha para verificar ausencia de IntegrityError
    conn = _db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO bitacoras (user_id, fecha, colaborador, area, necesita_apoyo, apoyo_detalle, tiempo_total_min) VALUES (NULL, '2026-11-10', ?, 'Sistemas', 'Si', 'Acceso VPN', 60)",
        (u['user']['full_name'],),
    )
    orphan_id = cur.lastrowid
    cur.execute(
        "INSERT INTO actividades (bitacora_id, descripcion, duracion_min, estado, hora_inicio) VALUES (?, 'Revision de servidores', 60, 'completada', '09:00')",
        (orphan_id,),
    )
    # Fecha con fila canónica ya existente + fila huérfana duplicada
    cur.execute(
        "INSERT INTO bitacoras (user_id, fecha, colaborador, area, tiempo_total_min) VALUES (?, '2026-11-11', ?, 'Sistemas', 30)",
        (u['user']['id'], u['user']['full_name']),
    )
    cur.execute(
        "INSERT INTO bitacoras (user_id, fecha, colaborador, area, tiempo_total_min) VALUES (NULL, '2026-11-11', ?, 'Sistemas', 0)",
        (u['user']['full_name'],),
    )
    _mig_003_backfill_bitacora_user_ids_and_indexes(cur)
    conn.commit()

    fixed_row = cur.execute("SELECT user_id FROM bitacoras WHERE id = ?", (orphan_id,)).fetchone()
    conn.close()
    assert fixed_row['user_id'] == u['user']['id']

    # Consultar Dashboard filtrado por team_id (usa el JOIN indexado b.user_id = u.id)
    r_dash = client.get(f'/api/dashboard/stats?team_id={team_id}', headers=admin['h'])
    assert r_dash.status_code == 200
    assert r_dash.json['resumen']['total_bitacoras'] >= 2
    assert any(c['colaborador'] == u['user']['full_name'] for c in r_dash.json['por_colaborador'])
