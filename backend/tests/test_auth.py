"""Autenticación, permisos y política de contraseñas."""
import io

from conftest import ADMIN_PASSWORD, bearer, login


def test_health_is_public_and_checks_db(client):
    r = client.get('/api/health')
    assert r.status_code == 200
    assert r.json['database'] == 'ok'
    assert r.json['schema_version'] >= 1


def test_api_requires_auth(client):
    assert client.get('/api/it-vault/credentials?user_id=1').status_code == 401
    assert client.post('/api/admin/clean-production-data').status_code == 401


def test_bad_login_rejected(client):
    r = client.post('/api/auth/login', json={'username': 'admin', 'password': 'incorrecta'})
    assert r.status_code == 401


def test_admin_login_returns_token(admin):
    assert admin['token']
    assert admin['user']['role'] == 'admin'
    assert admin['user']['must_change_password'] is False


def test_analyst_blocked_from_admin_routes(client, make_user):
    ana = make_user()
    assert client.post('/api/admin/clean-production-data', headers=ana['h']).status_code == 403
    assert client.post('/api/admin/users', json={'username': 'x', 'full_name': 'X'}, headers=ana['h']).status_code == 403


def test_destructive_maintenance_disabled_by_default(client, admin):
    assert client.post('/api/admin/clean-production-data', headers=admin['h']).status_code == 410
    assert client.post('/api/admin/seed-demo-data', headers=admin['h']).status_code == 410


def test_removed_debug_endpoints_are_gone(client, admin):
    assert client.get('/api/admin/diagnose-db', headers=admin['h']).status_code in (404, 405)
    assert client.post('/api/admin/repair-mock-jayala', headers=admin['h']).status_code in (404, 405)


def test_password_policy_min_length(client, admin):
    r = client.post('/api/admin/users', json={'username': 'corto', 'full_name': 'Corto', 'password': '123456'}, headers=admin['h'])
    assert r.status_code == 400
    assert '8' in r.json['error']


def test_create_user_without_password_generates_temporary(client, admin):
    r = client.post('/api/admin/users', json={'username': 'sinclave', 'full_name': 'Sin Clave'}, headers=admin['h'])
    assert r.status_code == 201
    temp = r.json['temp_password']
    assert len(temp) >= 8
    data = login(client, 'sinclave', temp)
    assert data['user']['must_change_password'] is True


def test_must_change_password_blocks_writes_until_changed(client, admin):
    r = client.post('/api/admin/users', json={'username': 'nuevo', 'full_name': 'Nuevo Colab', 'password': 'Temporal#2026'}, headers=admin['h'])
    assert r.status_code == 201
    data = login(client, 'nuevo', 'Temporal#2026')
    assert data['user']['must_change_password'] is True
    h = bearer(data['token'])
    uid = data['user']['id']

    # Lectura permitida, escritura bloqueada
    assert client.get('/api/notifications?user_id=%s' % uid, headers=h).status_code == 200
    r = client.post('/api/bitacoras', json={'fecha': '2026-10-15', 'colaborador': 'Nuevo Colab', 'user_id': uid, 'actividades': []}, headers=h)
    assert r.status_code == 403 and r.json['code'] == 'password_change_required'

    # No se puede "cambiar" a la misma contraseña
    r = client.post('/api/auth/change-password', json={'user_id': uid, 'current_password': 'Temporal#2026', 'new_password': 'Temporal#2026'}, headers=h)
    assert r.status_code == 400

    r = client.post('/api/auth/change-password', json={'user_id': uid, 'current_password': 'Temporal#2026', 'new_password': 'MiClaveNueva#1'}, headers=h)
    assert r.status_code == 200 and r.json['token']
    h2 = bearer(r.json['token'])
    r = client.post('/api/bitacoras', json={'fecha': '2026-10-15', 'colaborador': 'Nuevo Colab', 'user_id': uid, 'actividades': []}, headers=h2)
    assert r.status_code == 200
    assert login(client, 'nuevo', 'MiClaveNueva#1')['user']['must_change_password'] is False


def test_admin_reset_marks_password_as_temporary(client, admin, make_user):
    u = make_user()
    r = client.put('/api/admin/users/%s' % u['user']['id'], json={'password': 'Reseteada#2026', 'team_id': None}, headers=admin['h'])
    assert r.status_code == 200
    assert login(client, u['username'], 'Reseteada#2026')['user']['must_change_password'] is True


def test_cannot_change_other_users_password(client, make_user):
    a, b = make_user(), make_user()
    r = client.post('/api/auth/change-password', json={'user_id': a['user']['id'], 'new_password': 'Hackeada#2026'}, headers=b['h'])
    assert r.status_code in (400, 403)
    login(client, a['username'], a['password'])  # sigue funcionando la original


def test_old_token_invalid_after_password_change(client, make_user):
    u = make_user()
    r = client.post('/api/auth/change-password', json={'user_id': u['user']['id'], 'current_password': u['password'], 'new_password': 'OtraClave#2026'}, headers=u['h'])
    assert r.status_code == 200
    assert client.get('/api/notifications?user_id=%s' % u['user']['id'], headers=u['h']).status_code == 401
    assert client.get('/api/notifications?user_id=%s' % u['user']['id'], headers=bearer(r.json['token'])).status_code == 200


def test_profile_password_change_returns_fresh_token(client, make_user):
    u = make_user()
    r = client.put('/api/auth/profile', json={
        'user_id': u['user']['id'], 'full_name': 'Nombre Editado',
        'current_password': u['password'], 'new_password': 'PerfilNueva#2026',
    }, headers=u['h'])
    assert r.status_code == 200 and r.json.get('token')
    assert client.get('/api/notifications?user_id=%s' % u['user']['id'], headers=bearer(r.json['token'])).status_code == 200


def test_html_upload_blocked(client, admin):
    r = client.post('/api/upload', data={'file': (io.BytesIO(b'<script>alert(1)</script>'), 'x.html')},
                    headers=admin['h'], content_type='multipart/form-data')
    assert r.status_code == 400


def test_admin_password_unchanged(client):
    # El arranque nunca debe sobrescribir la contraseña del admin existente
    login(client, 'admin', ADMIN_PASSWORD)
