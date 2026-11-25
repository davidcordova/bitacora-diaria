"""Pruebas de regresión de seguridad (Fase 0) e integridad/índices v6 (Fase 1)."""
import hashlib
import base64
from database import get_db, EXPECTED_SCHEMA_VERSION, get_schema_version


def test_mcp_oauth_register_never_leaks_api_key_and_enforces_pkce(client, admin):
    # Asegurar clave MCP inicializada
    cfg = client.get('/api/admin/mcp/config', headers=admin['h']).json
    real_key = cfg['api_key']
    assert real_key.startswith('mcp_bita_')

    # 1. Registro dinámico público JAMÁS debe devolver client_secret ni api_key
    r_reg = client.post('/api/mcp/oauth/register', json={
        'client_name': 'External AI Client',
        'redirect_uris': ['https://gemini.google.com/callback'],
    })
    assert r_reg.status_code == 201
    assert 'client_secret' not in r_reg.json
    assert real_key not in r_reg.get_data(as_text=True)
    assert r_reg.json['token_endpoint_auth_method'] == 'none'

    # 2. Rechazar redirect_uri inseguro (javascript: / http no-localhost)
    r_bad_uri = client.get('/api/mcp/oauth/authorize?redirect_uri=javascript:alert(1)')
    assert r_bad_uri.status_code == 400
    r_bad_http = client.get('/api/mcp/oauth/authorize?redirect_uri=http://evil.example.com/cb')
    assert r_bad_http.status_code == 400

    # 3. PKCE S256 obligatorio cuando se envió code_challenge: omitir code_verifier debe fallar
    verifier = 'super-secret-pkce-verifier-value-1234567890'
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode('ascii')).digest()).rstrip(b'=').decode('ascii')
    r_auth = client.post('/api/mcp/oauth/authorize', data={
        'response_type': 'code',
        'client_id': 'bitacora-mcp',
        'redirect_uri': 'https://gemini.google.com/callback',
        'code_challenge': challenge,
        'code_challenge_method': 'S256',
        'mcp_api_key': real_key,
    })
    assert r_auth.status_code == 302
    code = r_auth.headers['Location'].split('code=')[1].split('&')[0]

    # Sin code_verifier -> 400
    r_no_ver = client.post('/api/mcp/oauth/token', data={
        'grant_type': 'authorization_code',
        'code': code,
    })
    assert r_no_ver.status_code == 400

    # Con code_verifier correcto -> 200
    r_ok = client.post('/api/mcp/oauth/token', data={
        'grant_type': 'authorization_code',
        'code': code,
        'code_verifier': verifier,
    })
    assert r_ok.status_code == 200
    assert r_ok.json['access_token'] == real_key


def test_rbac_vault_quicklinks_buzon_and_activity_ownership(client, admin, make_user):
    analista_a = make_user(role='analista')
    analista_b = make_user(role='analista')
    lider = make_user(role='lider')

    # 1. Analista bloqueado de platform-users y catálogos de bóveda; líder y admin permitidos
    assert client.get('/api/it-vault/platform-users', headers=analista_a['h']).status_code == 403
    assert client.post('/api/it-vault/empresas', json={'nombre': 'Bloqueada'}, headers=analista_a['h']).status_code == 403
    assert client.get('/api/it-vault/platform-users', headers=lider['h']).status_code == 200

    # 2. Quick-links personales jamás se filtran a admin ni líder
    r_ql = client.post('/api/quick-links', json={
        'titulo': 'Link privado analista A',
        'url': 'https://privado.example.com',
        'visibilidad': 'personal',
    }, headers=analista_a['h'])
    assert r_ql.status_code == 201
    ql_id = r_ql.json['id']

    assert any(x['id'] == ql_id for x in client.get('/api/quick-links', headers=analista_a['h']).json)
    assert all(x['id'] != ql_id for x in client.get('/api/quick-links', headers=admin['h']).json)
    assert all(x['id'] != ql_id for x in client.get('/api/quick-links', headers=lider['h']).json)

    # 3. Analista no puede aprobar/cambiar estado de sugerencias
    r_sug = client.post('/api/sugerencias', json={
        'titulo': 'Mejora UX',
        'descripcion': 'Propuesta de prueba',
    }, headers=analista_a['h'])
    assert r_sug.status_code == 201
    sug_id = r_sug.json['sugerencia']['id']
    assert client.put(f'/api/sugerencias/{sug_id}/status', json={'estado': 'aprobada'}, headers=analista_a['h']).status_code == 403
    assert client.put(f'/api/sugerencias/{sug_id}/status', json={'estado': 'aprobada'}, headers=admin['h']).status_code == 200

    # 4. Analista B no puede leer por GET una actividad de Analista A
    r_act = client.post('/api/actividades', json={
        'fecha': '2026-11-25',
        'user_id': analista_a['user']['id'],
        'colaborador': analista_a['user']['full_name'],
        'hora_inicio': '09:00',
        'duracion_min': 30,
        'tipo_trabajo': 'Desarrollo',
        'descripcion': 'Actividad privada A',
        'estado': 'completada',
    }, headers=analista_a['h'])
    assert r_act.status_code in (200, 201)
    act_id = r_act.json['actividad']['id']
    assert client.get(f'/api/actividades/{act_id}', headers=analista_a['h']).status_code == 200
    assert client.get(f'/api/actividades/{act_id}', headers=analista_b['h']).status_code == 403

    # 5. Analista B no puede consultar pendientes de Analista A
    r_imp = client.post('/api/actividades/importar-pendientes', json={
        'user_id': analista_a['user']['id'],
        'colaborador': analista_a['user']['full_name'],
    }, headers=analista_b['h'])
    assert r_imp.status_code == 403


def test_migration_v6_indexes_health_and_permanent_user_delete(client, admin, make_user):
    # 1. Health confirma schema_version == EXPECTED_SCHEMA_VERSION (>= 6)
    r_h = client.get('/api/health')
    assert r_h.status_code == 200
    assert r_h.json['schema_version'] == EXPECTED_SCHEMA_VERSION
    assert get_schema_version() >= 6

    conn = get_db()
    idx_names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()}
    for expected in (
        'idx_teams_lider',
        'idx_users_team_active',
        'idx_notifications_user_id_desc',
        'idx_it_audit_user_action_time',
        'idx_notas_vis_del_estado_upd',
        'ux_actividades_bitacora_client_uid',
    ):
        assert expected in idx_names, f'Falta índice {expected}'
    assert 'idx_actividades_parent_task_id' not in idx_names

    # 2. Eliminación permanente de usuario con notas, accesos y actividad no falla por FK
    temp_u = make_user(role='lider')
    client.post('/api/notas', json={'titulo': 'Nota temporal'}, headers=temp_u['h'])
    client.post('/api/quick-links', json={'titulo': 'Link temp', 'url': 'https://example.com'}, headers=temp_u['h'])
    r_del = client.delete(f"/api/admin/users/{temp_u['user']['id']}?permanent=true", headers=admin['h'])
    assert r_del.status_code == 200, r_del.get_data(as_text=True)
