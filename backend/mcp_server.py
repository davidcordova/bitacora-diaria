#!/usr/bin/env python3
"""
Servidor MCP (Model Context Protocol) por STDIO para Bitácora Diaria — Marketing Alterno Perú.

Permite conectar clientes de IA de escritorio que usan transporte STDIO (como Claude Desktop,
Cursor, Antigravity, Windsurf o agentes CLI) en dos modos:
1. Modo Remoto (Recomendado para Producción):
   Si se definen las variables de entorno `BITACORA_MCP_URL` (ej. https://sistemasmkt.net.pe/api/mcp)
   y `BITACORA_MCP_API_KEY` (mcp_bita_...), actúa como puente seguro hacia el servidor en producción.
2. Modo Local Directo:
   Si no se define `BITACORA_MCP_URL`, consulta directamente la base de datos SQLite local (`bitacora.db`).
"""

import os
import sys
import json
import urllib.request
import urllib.error

# Asegurar que el directorio backend esté en sys.path para modo local
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def _forward_to_remote(mcp_url, api_key, message):
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'
        headers['X-MCP-API-Key'] = api_key

    req = urllib.request.Request(
        mcp_url,
        data=json.dumps(message).encode('utf-8'),
        headers=headers,
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 202:
                return None
            raw = resp.read().decode('utf-8').strip()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        return {
            'jsonrpc': '2.0',
            'id': message.get('id'),
            'error': {
                'code': -32000,
                'message': f'Remote MCP HTTP {e.code}: {err_body}',
            },
        }
    except Exception as e:
        return {
            'jsonrpc': '2.0',
            'id': message.get('id'),
            'error': {
                'code': -32603,
                'message': f'Remote MCP connection error: {str(e)}',
            },
        }


def main():
    remote_url = (os.environ.get('BITACORA_MCP_URL') or '').strip()
    api_key = (os.environ.get('BITACORA_MCP_API_KEY') or '').strip()

    app = None
    handle_local = None
    if not remote_url:
        from app import app as flask_app
        from routes.mcp_routes import _handle_jsonrpc_message
        app = flask_app
        handle_local = _handle_jsonrpc_message

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            err_resp = {
                'jsonrpc': '2.0',
                'id': None,
                'error': {'code': -32700, 'message': 'Parse error'},
            }
            sys.stdout.write(json.dumps(err_resp, ensure_ascii=False) + '\n')
            sys.stdout.flush()
            continue

        if remote_url:
            resp = _forward_to_remote(remote_url, api_key, msg)
        else:
            with app.app_context():
                from flask import g
                g.current_user = {
                    'id': 1,
                    'username': 'mcp_stdio',
                    'full_name': 'Agente IA (MCP STDIO)',
                    'role': 'admin',
                    'is_mcp': True,
                    'mcp_mode': os.environ.get('BITACORA_MCP_MODE', 'read_only'),
                }
                resp = handle_local(msg)

        if resp is not None:
            sys.stdout.write(json.dumps(resp, ensure_ascii=False) + '\n')
            sys.stdout.flush()


if __name__ == '__main__':
    main()

