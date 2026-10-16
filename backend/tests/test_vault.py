"""Bóveda IT: las contraseñas solo se entregan con un desbloqueo vigente (PIN/contraseña)."""
from conftest import bearer


def _empresa(client, h):
    r = client.post('/api/it-vault/empresas', json={'nombre': 'Empresa Test Bóveda'}, headers=h)
    if r.status_code == 201:
        return r.json['id']
    return [e for e in client.get('/api/it-vault/empresas', headers=h).json if e['nombre'] == 'Empresa Test Bóveda'][0]['id']


def _unlock(client, user):
    r = client.post('/api/it-vault/verify-unlock', json={'user_id': user['user']['id'], 'password': user['password']}, headers=user['h'])
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.json['vault_token']


def test_platform_user_passwords_require_unlock(client, make_user):
    u = make_user(role='lider')
    emp = _empresa(client, u['h'])
    r = client.post('/api/it-vault/platform-users', json={
        'empresa_id': emp, 'plataforma': 'Zimbra', 'colaborador_nombre': 'Colab Uno',
        'usuario_login': 'colab.uno', 'password_actual': 'S3creta#Zimbra',
    }, headers=u['h'])
    assert r.status_code in (200, 201), r.get_data(as_text=True)

    # Bloqueada: sin contraseña en claro, pero indica que existe
    rows = client.get('/api/it-vault/platform-users', headers=u['h']).json
    row = [x for x in rows if x['usuario_login'] == 'colab.uno'][0]
    assert row['password_actual'] is None
    assert row['secret_locked'] is True and row['has_password_actual'] is True

    token = _unlock(client, u)
    rows = client.get('/api/it-vault/platform-users', headers={**u['h'], 'X-Vault-Token': token}).json
    row = [x for x in rows if x['usuario_login'] == 'colab.uno'][0]
    assert row['password_actual'] == 'S3creta#Zimbra'
    assert row['secret_locked'] is False

    # Editar desde un formulario bloqueado (contraseña vacía) NO borra la guardada
    r = client.put('/api/it-vault/platform-users/%s' % row['id'], json={'password_actual': '', 'notas': 'editado'}, headers=u['h'])
    assert r.status_code == 200
    rows = client.get('/api/it-vault/platform-users', headers={**u['h'], 'X-Vault-Token': token}).json
    assert [x for x in rows if x['id'] == row['id']][0]['password_actual'] == 'S3creta#Zimbra'

    # Exportar contraseñas exige desbloqueo
    assert client.get('/api/it-vault/platform-users/export?include_passwords=1', headers=u['h']).status_code == 403
    r = client.get('/api/it-vault/platform-users/export?include_passwords=1', headers={**u['h'], 'X-Vault-Token': token})
    assert r.status_code == 200


def test_vault_token_is_bound_to_user(client, make_user):
    a, b = make_user(role='lider'), make_user(role='lider')
    emp = _empresa(client, a['h'])
    r = client.post('/api/it-vault/credentials', json={
        'empresa_id': emp, 'plataforma': 'NAS', 'usuario_login': 'root', 'password_secret': 'N4s#Root',
        'created_by': 999,  # el servidor lo reemplaza por el usuario autenticado
    }, headers=a['h'])
    assert r.status_code in (200, 201), r.get_data(as_text=True)
    token_a = _unlock(client, a)
    # B usando el token de A: sigue bloqueado
    rows = client.get('/api/it-vault/credentials?user_id=%s' % b['user']['id'], headers={**b['h'], 'X-Vault-Token': token_a}).json
    assert rows and all(r['password_secret'] is None for r in rows)
    rows = client.get('/api/it-vault/credentials?user_id=%s' % a['user']['id'], headers={**a['h'], 'X-Vault-Token': token_a}).json
    assert any(r['password_secret'] == 'N4s#Root' for r in rows)


def test_wrong_unlock_does_not_log_out_and_is_rate_limited(client, make_user):
    u = make_user()
    for _ in range(5):
        r = client.post('/api/it-vault/verify-unlock', json={'user_id': u['user']['id'], 'password': 'mala'}, headers=u['h'])
        assert r.status_code == 400  # 401 cerraría la sesión en el cliente
    r = client.post('/api/it-vault/verify-unlock', json={'user_id': u['user']['id'], 'password': u['password']}, headers=u['h'])
    assert r.status_code == 429
    # La sesión sigue siendo válida
    assert client.get('/api/notifications?user_id=%s' % u['user']['id'], headers=u['h']).status_code == 200


def test_pin_unlock(client, make_user):
    u = make_user()
    r = client.post('/api/it-vault/set-pin', json={'user_id': u['user']['id'], 'current_password': u['password'], 'new_pin': '4826'}, headers=u['h'])
    assert r.status_code == 200
    r = client.post('/api/it-vault/verify-unlock', json={'user_id': u['user']['id'], 'pin': '4826'}, headers=bearer(u['token']))
    assert r.status_code == 200 and r.json['vault_token']
    assert r.json['expires_in'] == 900
