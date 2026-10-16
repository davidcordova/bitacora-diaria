"""Configuración de pruebas: base de datos temporal aislada antes de importar la app."""
import os
import sys
import tempfile

import pytest

_TMP = tempfile.mkdtemp(prefix='bitacora-tests-')
os.environ['DATABASE_PATH'] = os.path.join(_TMP, 'bitacora.db')
os.environ['UPLOAD_FOLDER'] = os.path.join(_TMP, 'uploads')
os.environ['ADMIN_INITIAL_PASSWORD'] = 'AdminPass#2026'
os.environ['BITACORA_SECRET_KEY'] = 'test-secret-key-0123456789abcdef'
os.environ['BITACORA_DISABLE_SCHEDULER'] = '1'
os.environ.pop('ENABLE_MAINTENANCE_ENDPOINTS', None)
for k in ('COOLIFY_CONTAINER_NAME', 'COOLIFY_URL', 'COOLIFY_RESOURCE_UUID'):
    os.environ.pop(k, None)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

import app as appmod  # noqa: E402  (importar la app inicializa la base temporal)

ADMIN_PASSWORD = 'AdminPass#2026'


@pytest.fixture(scope='session')
def client():
    appmod.app.config['TESTING'] = True
    return appmod.app.test_client()


def login(client, username, password):
    r = client.post('/api/auth/login', json={'username': username, 'password': password})
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.json


def bearer(token):
    return {'Authorization': 'Bearer ' + token}


@pytest.fixture(scope='session')
def admin(client):
    data = login(client, 'admin', ADMIN_PASSWORD)
    return {'user': data['user'], 'token': data['token'], 'h': bearer(data['token'])}


_counter = {'n': 0}


@pytest.fixture
def make_user(client, admin):
    """Crea un colaborador activo que ya cambió su contraseña temporal."""
    def _make(role='analista', team_id=None):
        _counter['n'] += 1
        username = f'user{_counter["n"]}'
        temp = f'Temporal#{_counter["n"]}xx'
        final = f'Definitiva#{_counter["n"]}xx'
        r = client.post('/api/admin/users', json={
            'username': username, 'full_name': f'Usuario {_counter["n"]}',
            'password': temp, 'role': role, 'team_id': team_id,
        }, headers=admin['h'])
        assert r.status_code == 201, r.get_data(as_text=True)
        data = login(client, username, temp)
        r = client.post('/api/auth/change-password', json={
            'user_id': data['user']['id'], 'current_password': temp, 'new_password': final,
        }, headers=bearer(data['token']))
        assert r.status_code == 200, r.get_data(as_text=True)
        return {'user': data['user'], 'token': r.json['token'], 'h': bearer(r.json['token']),
                'username': username, 'password': final}
    return _make
