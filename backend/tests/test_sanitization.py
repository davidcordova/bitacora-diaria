"""Sanitización de texto enriquecido contra XSS almacenado."""

from security import sanitize_rich_text


def _save(client, user, desc, **extra_act):
    act = {'id': 'act-xss', 'descripcion': desc, 'duracion_min': 10, 'hora_inicio': '08:30',
           'estado': 'completada', **extra_act}
    r = client.post('/api/bitacoras', json={
        'fecha': '2026-10-15', 'colaborador': user['user']['full_name'], 'user_id': user['user']['id'],
        'actividades': [act], 'pendientes': '<img src=x onerror=alert(1)>pendiente',
    }, headers=user['h'])
    assert r.status_code == 200
    return r.json['bitacora']


def test_malicious_html_is_stripped_on_save(client, make_user):
    ana = make_user()
    payload = ('<p>ok</p><svg/onload=alert(1)><img src=x onerror="alert(2)">'
               '<a href="javascript:alert(3)">x</a><script>alert(4)</script><iframe src="//evil"></iframe>')
    b = _save(client, ana, payload, comentarios='<b onclick="alert(5)">c</b>')
    act = b['actividades'][0]
    for bad in ('onload', 'onerror', 'javascript:', '<script', '<iframe', '<svg', 'onclick'):
        assert bad not in act['descripcion'].lower()
        assert bad not in (act.get('comentarios') or '').lower()
        assert bad not in (b.get('pendientes') or '').lower()
    assert '<p>ok</p>' in act['descripcion']


def test_plain_text_and_code_are_untouched():
    for text in ('if (a < b && c > d) return;', 'Deploy -> prod', '```\nx<5\n```', 'Tarea normal'):
        assert sanitize_rich_text(text) == text


def test_safe_formatting_is_preserved():
    html = '<p><strong>Hecho</strong> <a href="https://x.com">link</a> <img src="/uploads/a.png" alt="a"></p>'
    out = sanitize_rich_text(html)
    assert '<strong>Hecho</strong>' in out
    assert 'href="https://x.com"' in out
    assert 'src="/uploads/a.png"' in out
