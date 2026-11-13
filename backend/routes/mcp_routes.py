"""
Servidor MCP (Model Context Protocol) integrado para Bitácora Diaria — Marketing Alterno Perú.

Soporta:
1. Protocolo MCP Estándar sobre HTTP Streamable (JSON-RPC 2.0 en `POST /api/mcp` y descubrimiento en `GET /api/mcp`),
   compatible con las especificaciones MCP 2025-03-26 y 2024-11-05 (Claude, Cursor, Antigravity, Windsurf, n8n, etc.).
2. Puente REST & OpenAPI 3.1 (`POST /api/mcp/query`, `GET /api/mcp/tools`, `GET /api/mcp/openapi.json`)
   para conectar con Custom GPTs (ChatGPT Actions), Gemini Extensions, OpenWebUI, Dify, Make o agentes LangChain.
3. Gestión administrativa segura desde la interfaz (`GET/POST /api/admin/mcp/config`, `POST /api/admin/mcp/rotate-key`)
   con API Key dedicada (`mcp_bita_...`), control de encendido/apagado y modo `read_only` / `read_write`.
"""

import re
import json
import base64
import hashlib
import secrets
import urllib.parse
from datetime import datetime, timedelta
from collections import Counter, defaultdict
from flask import Blueprint, jsonify, request, g, redirect, make_response
from werkzeug.security import check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from database import (
    get_db,
    get_peru_now,
    get_peru_now_str,
    get_peru_today_str,
)
from crypto_utils import encrypt_vault_secret, decrypt_vault_secret
from security import _get_secret_key
from routes.system_routes import normalize_client_name
from activity_lifecycle import (
    calculate_hora_fin,
    recalculate_bitacora_durations,
    propagate_completion_across_lineage,
)

mcp_bp = Blueprint('mcp_bp', __name__)

MCP_PROTOCOL_VERSION = '2025-03-26'
MCP_OAUTH_CLIENT_ID = 'bitacora-mcp'
MCP_OAUTH_CODE_SALT = 'bitacora-mcp-oauth-code-v1'
MCP_SERVER_NAME = 'bitacora-mkt-mcp'
MCP_SERVER_VERSION = '2.3.0'


def _get_public_base_url():
    """Determina la URL pública base (garantizando HTTPS en dominios productivos detrás de proxy)."""
    host = request.host or 'sistemasmkt.net.pe'
    proto = request.headers.get('X-Forwarded-Proto') or request.scheme or 'https'
    if not host.startswith(('localhost', '127.0.0.1', '192.168.')):
        proto = 'https'
    return f"{proto}://{host}"

_HTML_RE = re.compile(r'<[^>]+>')


def _clean_html(text):
    """Extrae texto limpio de descripciones HTML enriquecidas para consumo eficiente por modelos de IA."""
    if not text:
        return ''
    cleaned = _HTML_RE.sub(' ', str(text))
    cleaned = (
        cleaned.replace('&nbsp;', ' ')
        .replace('&amp;', '&')
        .replace('&lt;', '<')
        .replace('&gt;', '>')
        .replace('&quot;', '"')
    )
    return ' '.join(cleaned.split())


def _hash_api_key(raw_key):
    return hashlib.sha256((raw_key or '').encode('utf-8')).hexdigest()


def _generate_mcp_key():
    return 'mcp_bita_' + secrets.token_urlsafe(24)


def get_or_init_mcp_settings(conn=None):
    """Obtiene la configuración MCP desde system_settings, inicializando una API Key si aún no existe."""
    should_close = False
    if conn is None:
        conn = get_db()
        should_close = True
    try:
        rows = conn.execute(
            "SELECT key, value FROM system_settings WHERE key IN ('mcp_enabled', 'mcp_access_mode', 'mcp_api_key_hash', 'mcp_api_key_encrypted')"
        ).fetchall()
        cfg = {r['key']: r['value'] for r in rows}

        dirty = False
        if 'mcp_enabled' not in cfg:
            cfg['mcp_enabled'] = 'true'
            conn.execute(
                "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('mcp_enabled', 'true', CURRENT_TIMESTAMP)"
            )
            dirty = True

        if 'mcp_access_mode' not in cfg:
            cfg['mcp_access_mode'] = 'read_only'
            conn.execute(
                "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('mcp_access_mode', 'read_only', CURRENT_TIMESTAMP)"
            )
            dirty = True

        if not cfg.get('mcp_api_key_hash') or not cfg.get('mcp_api_key_encrypted'):
            raw_key = _generate_mcp_key()
            key_hash = _hash_api_key(raw_key)
            key_enc = encrypt_vault_secret(raw_key)
            conn.execute(
                "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('mcp_api_key_hash', ?, CURRENT_TIMESTAMP)",
                (key_hash,),
            )
            conn.execute(
                "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('mcp_api_key_encrypted', ?, CURRENT_TIMESTAMP)",
                (key_enc,),
            )
            cfg['mcp_api_key_hash'] = key_hash
            cfg['mcp_api_key_encrypted'] = key_enc
            dirty = True

        if dirty:
            conn.commit()

        raw_key = decrypt_vault_secret(cfg.get('mcp_api_key_encrypted') or '') or ''
        return {
            'enabled': str(cfg.get('mcp_enabled', 'true')).lower() != 'false',
            'access_mode': cfg.get('mcp_access_mode', 'read_only'),
            'api_key_hash': cfg.get('mcp_api_key_hash', ''),
            'api_key': raw_key,
            'api_key_masked': (raw_key[:13] + '••••••••••••' + raw_key[-4:]) if len(raw_key) > 18 else '••••••••••••',
        }
    finally:
        if should_close:
            conn.close()


def verify_mcp_api_key(candidate_key):
    """Valida una API Key MCP (`mcp_bita_...`). Devuelve `(ok, info_or_error)`."""
    if not candidate_key or not str(candidate_key).startswith('mcp_bita_'):
        return False, 'Formato de API Key MCP inválido.'
    cfg = get_or_init_mcp_settings()
    if not cfg['enabled']:
        return False, 'El servidor MCP está deshabilitado por el administrador.'
    expected_hash = cfg.get('api_key_hash') or ''
    candidate_hash = _hash_api_key(candidate_key.strip())
    if not expected_hash or not secrets.compare_digest(expected_hash, candidate_hash):
        return False, 'API Key MCP inválida o revocada.'
    return True, cfg['access_mode']


def rotate_mcp_api_key():
    """Genera y persiste una nueva API Key MCP invalidando la anterior."""
    conn = get_db()
    try:
        raw_key = _generate_mcp_key()
        key_hash = _hash_api_key(raw_key)
        key_enc = encrypt_vault_secret(raw_key)
        conn.execute(
            "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('mcp_api_key_hash', ?, CURRENT_TIMESTAMP)",
            (key_hash,),
        )
        conn.execute(
            "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('mcp_api_key_encrypted', ?, CURRENT_TIMESTAMP)",
            (key_enc,),
        )
        conn.commit()
        return raw_key
    finally:
        conn.close()


# ============================================================================
# DEFINICIÓN DE HERRAMIENTAS (TOOLS) MCP
# ============================================================================

MCP_TOOLS = [
    {
        'name': 'resumen_ejecutivo_equipo',
        'description': (
            'Obtiene el resumen ejecutivo del equipo y métricas operativas de Bitácora Diaria '
            '(total de horas/minutos trabajados, cumplimiento de la meta diaria de 8h/480m, '
            'quiénes registraron hoy y quiénes faltan, distribución por estados, categorías y clientes principales).'
        ),
        'inputSchema': {
            'type': 'object',
            'properties': {
                'periodo': {
                    'type': 'string',
                    'enum': ['hoy', '7d', '30d', 'historico'],
                    'description': 'Ventana de tiempo a analizar (por defecto: hoy).',
                },
                'fecha': {
                    'type': 'string',
                    'description': 'Fecha específica en formato YYYY-MM-DD (por defecto: fecha actual en Perú UTC-5).',
                },
            },
        },
    },
    {
        'name': 'consultar_actividades',
        'description': (
            'Busca y filtra actividades registradas en el sistema por rango de fechas, colaborador, '
            'cliente/proyecto, estado (en_proceso, pendiente, en_revision, completada, bloqueado), '
            'tipo de trabajo o texto libre en la descripción y comentarios.'
        ),
        'inputSchema': {
            'type': 'object',
            'properties': {
                'fecha_desde': {
                    'type': 'string',
                    'description': 'Fecha inicial YYYY-MM-DD (opcional).',
                },
                'fecha_hasta': {
                    'type': 'string',
                    'description': 'Fecha final YYYY-MM-DD (opcional).',
                },
                'colaborador': {
                    'type': 'string',
                    'description': 'Nombre o usuario del colaborador (búsqueda parcial insensible a mayúsculas).',
                },
                'cliente': {
                    'type': 'string',
                    'description': 'Nombre del cliente o proyecto (ej. SOLOPROMO, SISTEMAS, Gerencia).',
                },
                'estado': {
                    'type': 'string',
                    'enum': ['en_proceso', 'pendiente', 'en_revision', 'completada', 'bloqueado'],
                    'description': 'Filtrar por estado exacto de la tarea.',
                },
                'tipo_trabajo': {
                    'type': 'string',
                    'description': 'Categoría o tipo de trabajo (ej. Desarrollo, Diseño, Reunión, Soporte).',
                },
                'texto_busqueda': {
                    'type': 'string',
                    'description': 'Palabra clave a buscar dentro de la descripción o comentarios de la actividad.',
                },
                'solo_estancadas': {
                    'type': 'boolean',
                    'description': 'Si es true, devuelve únicamente tareas no completadas con 7 o más días de antigüedad.',
                },
                'limite': {
                    'type': 'integer',
                    'description': 'Cantidad máxima de actividades a devolver (por defecto 50, máximo 200).',
                },
            },
        },
    },
    {
        'name': 'estado_diario_colaboradores',
        'description': (
            'Devuelve la radiografía detallada de cada colaborador en una fecha determinada (YYYY-MM-DD): '
            'si abrió/cerró su bitácora, minutos acumulados vs meta de 480 min, si solicitó apoyo, '
            'su resumen de cierre, pendientes para el día siguiente y el listado de sus actividades.'
        ),
        'inputSchema': {
            'type': 'object',
            'properties': {
                'fecha': {
                    'type': 'string',
                    'description': 'Fecha en formato YYYY-MM-DD (por defecto hoy en hora de Perú).',
                },
                'colaborador': {
                    'type': 'string',
                    'description': 'Filtrar por un colaborador específico (opcional).',
                },
            },
        },
    },
    {
        'name': 'analizar_cliente_proyecto',
        'description': (
            'Analiza el tiempo invertido, colaboradores involucrados, estado de entregables y '
            'detalle cronológico de actividades para un cliente o proyecto específico (o lista el ranking de todos los clientes si no se indica uno).'
        ),
        'inputSchema': {
            'type': 'object',
            'properties': {
                'cliente': {
                    'type': 'string',
                    'description': 'Nombre del cliente o proyecto a auditar (opcional; si se omite devuelve el ranking global de clientes).',
                },
                'fecha_desde': {
                    'type': 'string',
                    'description': 'Fecha inicial YYYY-MM-DD (opcional).',
                },
                'fecha_hasta': {
                    'type': 'string',
                    'description': 'Fecha final YYYY-MM-DD (opcional).',
                },
            },
        },
    },
    {
        'name': 'detectar_alertas_y_cuellos_botella',
        'description': (
            'Detecta riesgos operativos activos: tareas bloqueadas, solicitudes de apoyo en bitácoras, '
            'tareas en estado en_revision esperando aprobación del líder, tareas estancadas (>=7 días sin cerrar) '
            'y colaboradores activos que no han registrado actividades hoy.'
        ),
        'inputSchema': {
            'type': 'object',
            'properties': {
                'fecha': {
                    'type': 'string',
                    'description': 'Fecha de referencia YYYY-MM-DD (por defecto hoy en Perú).',
                },
            },
        },
    },
    {
        'name': 'listar_colaboradores_y_equipos',
        'description': (
            'Lista el directorio de colaboradores activos, sus roles (admin, lider, analista), áreas, '
            'equipos de trabajo y su última fecha de registro en bitácora.'
        ),
        'inputSchema': {
            'type': 'object',
            'properties': {},
        },
    },
    {
        'name': 'registrar_actividad_bitacora',
        'description': (
            'Registra una nueva actividad en la bitácora de un colaborador (requiere que el servidor MCP '
            'tenga habilitado el modo read_write en Configuración).'
        ),
        'inputSchema': {
            'type': 'object',
            'required': ['colaborador', 'descripcion'],
            'properties': {
                'colaborador': {
                    'type': 'string',
                    'description': 'Username o nombre completo del colaborador dueño de la bitácora.',
                },
                'fecha': {
                    'type': 'string',
                    'description': 'Fecha YYYY-MM-DD (por defecto hoy en Perú).',
                },
                'descripcion': {
                    'type': 'string',
                    'description': 'Descripción clara de la actividad realizada o por realizar.',
                },
                'para_cliente': {
                    'type': 'string',
                    'description': 'Cliente o proyecto asociado (ej. SISTEMAS, SOLOPROMO).',
                },
                'tipo_trabajo': {
                    'type': 'string',
                    'description': 'Categoría de la actividad (por defecto: Gestión / Operación).',
                },
                'hora_inicio': {
                    'type': 'string',
                    'description': 'Hora de inicio en formato HH:MM (por defecto hora actual en Perú).',
                },
                'duracion_min': {
                    'type': 'integer',
                    'description': 'Duración estimada o invertida en minutos (por defecto 30).',
                },
                'estado': {
                    'type': 'string',
                    'enum': ['en_proceso', 'pendiente', 'en_revision', 'completada', 'bloqueado'],
                    'description': 'Estado inicial de la actividad (por defecto en_proceso).',
                },
                'comentarios': {
                    'type': 'string',
                    'description': 'Notas adicionales o entregables (opcional).',
                },
            },
        },
    },
]

MCP_RESOURCES = [
    {
        'uri': 'bitacora://resumen/hoy',
        'name': 'Resumen Ejecutivo de Hoy',
        'description': 'Métricas operativas, asistencia de bitácoras y avance del equipo en la fecha actual (Perú UTC-5).',
        'mimeType': 'application/json',
    },
    {
        'uri': 'bitacora://alertas/activas',
        'name': 'Alertas, Bloqueos y Tareas en Revisión',
        'description': 'Listado de cuellos de botella, solicitudes de apoyo, bloqueos y tareas estancadas.',
        'mimeType': 'application/json',
    },
    {
        'uri': 'bitacora://catalogo/clientes',
        'name': 'Catálogo y Ranking de Clientes / Proyectos',
        'description': 'Clientes normalizados con volumen de actividades y minutos acumulados.',
        'mimeType': 'application/json',
    },
    {
        'uri': 'bitacora://equipo/directorio',
        'name': 'Directorio de Colaboradores y Equipos',
        'description': 'Estructura organizacional, roles, líderes y última actividad por colaborador.',
        'mimeType': 'application/json',
    },
]

MCP_PROMPTS = [
    {
        'name': 'informe_gerencial_diario',
        'description': 'Genera un informe ejecutivo con el avance diario del equipo, horas registradas, entregables y bloqueos.',
        'arguments': [
            {
                'name': 'fecha',
                'description': 'Fecha del informe en formato YYYY-MM-DD (opcional, por defecto hoy).',
                'required': False,
            }
        ],
    },
    {
        'name': 'auditoria_cliente',
        'description': 'Analiza en profundidad el esfuerzo, tiempos y estado de tareas dedicadas a un cliente o proyecto.',
        'arguments': [
            {
                'name': 'cliente',
                'description': 'Nombre del cliente o proyecto a auditar.',
                'required': True,
            }
        ],
    },
    {
        'name': 'deteccion_riesgos_operativos',
        'description': 'Evalúa todas las alertas activas, tareas estancadas y solicitudes de apoyo para proponer acciones correctivas.',
        'arguments': [],
    },
]


# ============================================================================
# IMPLEMENTACIÓN DE LÓGICA DE CONSULTA Y EJECUCIÓN DE HERRAMIENTAS
# ============================================================================

def _tool_resumen_ejecutivo_equipo(args):
    periodo = (args.get('periodo') or 'hoy').strip().lower()
    today_str = get_peru_today_str()
    fecha_ref = (args.get('fecha') or today_str).strip()[:10]

    if periodo == 'hoy':
        fecha_desde, fecha_hasta = fecha_ref, fecha_ref
    elif periodo == '7d':
        dt_end = datetime.strptime(fecha_ref, '%Y-%m-%d')
        fecha_desde = (dt_end - timedelta(days=6)).strftime('%Y-%m-%d')
        fecha_hasta = fecha_ref
    elif periodo == '30d':
        dt_end = datetime.strptime(fecha_ref, '%Y-%m-%d')
        fecha_desde = (dt_end - timedelta(days=29)).strftime('%Y-%m-%d')
        fecha_hasta = fecha_ref
    else:
        fecha_desde, fecha_hasta = '2000-01-01', '2099-12-31'

    conn = get_db()
    try:
        active_users = conn.execute(
            '''
            SELECT u.id, u.username, u.full_name, u.role, COALESCE(t.nombre, 'General') AS area
            FROM users u
            LEFT JOIN teams t ON u.team_id = t.id
            WHERE u.is_active = 1 AND u.username != 'admin'
            ORDER BY u.full_name ASC
            '''
        ).fetchall()

        bitacoras_rows = conn.execute(
            '''
            SELECT id, user_id, fecha, colaborador, area, necesita_apoyo, apoyo_detalle,
                   tiempo_total_min, estado, resumen_texto, pendientes
            FROM bitacoras
            WHERE fecha >= ? AND fecha <= ?
            ORDER BY fecha DESC
            ''',
            (fecha_desde, fecha_hasta),
        ).fetchall()

        acts_rows = conn.execute(
            '''
            SELECT a.id, a.bitacora_id, a.duracion_min, a.tipo_trabajo, a.para_cliente,
                   a.estado, a.descripcion, b.colaborador, b.fecha, b.user_id
            FROM actividades a
            JOIN bitacoras b ON a.bitacora_id = b.id
            WHERE b.fecha >= ? AND b.fecha <= ?
              AND (a.is_deleted IS NULL OR a.is_deleted = 0)
            ''',
            (fecha_desde, fecha_hasta),
        ).fetchall()

        total_minutos = sum(int(r['duracion_min'] or 0) for r in acts_rows)
        por_estado = Counter(r['estado'] or 'en_proceso' for r in acts_rows)
        por_categoria = Counter((r['tipo_trabajo'] or 'Sin categoría').strip() for r in acts_rows)

        clientes_min = defaultdict(int)
        clientes_count = Counter()
        for r in acts_rows:
            cli = normalize_client_name(r['para_cliente']) or 'Interno / Sin cliente'
            clientes_min[cli] += int(r['duracion_min'] or 0)
            clientes_count[cli] += 1

        top_clientes = [
            {
                'cliente': cli,
                'actividades': clientes_count[cli],
                'minutos': mins,
                'horas': round(mins / 60.0, 2),
            }
            for cli, mins in sorted(clientes_min.items(), key=lambda x: x[1], reverse=True)[:15]
        ]

        # Cobertura del día de referencia
        bitacoras_en_fecha = [b for b in bitacoras_rows if b['fecha'] == fecha_ref]
        users_con_bitacora_ids = {b['user_id'] for b in bitacoras_en_fecha if b['user_id']}
        users_con_bitacora_names = {(b['colaborador'] or '').strip().lower() for b in bitacoras_en_fecha}

        registraron_hoy = []
        sin_registro_hoy = []
        for u in active_users:
            fname = (u['full_name'] or u['username']).strip()
            if u['id'] in users_con_bitacora_ids or fname.lower() in users_con_bitacora_names:
                registraron_hoy.append(fname)
            else:
                sin_registro_hoy.append({'id': u['id'], 'nombre': fname, 'area': u['area'], 'rol': u['role']})

        solicitudes_apoyo = [
            {
                'colaborador': b['colaborador'],
                'fecha': b['fecha'],
                'detalle_apoyo': _clean_html(b['apoyo_detalle']),
            }
            for b in bitacoras_rows
            if str(b['necesita_apoyo'] or '').strip().lower() in ('sí', 'si', 'yes', 'true', '1')
        ]

        return {
            'periodo': periodo,
            'rango_fechas': {'desde': fecha_desde, 'hasta': fecha_hasta, 'fecha_referencia': fecha_ref},
            'kpis': {
                'total_bitacoras': len(bitacoras_rows),
                'total_actividades': len(acts_rows),
                'total_minutos': total_minutos,
                'total_horas': round(total_minutos / 60.0, 2),
                'meta_diaria_colaborador_min': 480,
                'colaboradores_activos': len(active_users),
                'registraron_en_fecha_referencia': len(registraron_hoy),
                'pendientes_registro_en_fecha_referencia': len(sin_registro_hoy),
            },
            'cobertura_fecha_referencia': {
                'fecha': fecha_ref,
                'con_registro': registraron_hoy,
                'sin_registro': sin_registro_hoy,
            },
            'distribucion_por_estado': dict(por_estado),
            'distribucion_por_tipo_trabajo': dict(por_categoria.most_common(15)),
            'top_clientes_por_tiempo': top_clientes,
            'solicitudes_apoyo_activas': solicitudes_apoyo,
        }
    finally:
        conn.close()


def _tool_consultar_actividades(args):
    fecha_desde = (args.get('fecha_desde') or '').strip()[:10]
    fecha_hasta = (args.get('fecha_hasta') or '').strip()[:10]
    colaborador = (args.get('colaborador') or '').strip().lower()
    cliente = (args.get('cliente') or '').strip().lower()
    estado = (args.get('estado') or '').strip().lower()
    tipo_trabajo = (args.get('tipo_trabajo') or '').strip().lower()
    texto_busqueda = (args.get('texto_busqueda') or '').strip().lower()
    solo_estancadas = bool(args.get('solo_estancadas', False))
    try:
        limite = min(max(int(args.get('limite') or 50), 1), 200)
    except Exception:
        limite = 50

    query = '''
        SELECT a.id, a.bitacora_id, a.hora_inicio, a.hora_fin, a.duracion_min,
               a.tipo_trabajo, a.descripcion, a.para_cliente, a.estado,
               a.comentarios, a.revision_decision, a.revision_comentario,
               a.created_at, a.updated_at,
               b.fecha, b.colaborador, b.area, b.user_id
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE (a.is_deleted IS NULL OR a.is_deleted = 0)
    '''
    params = []

    if fecha_desde:
        query += ' AND b.fecha >= ?'
        params.append(fecha_desde)
    if fecha_hasta:
        query += ' AND b.fecha <= ?'
        params.append(fecha_hasta)
    if estado:
        query += ' AND LOWER(a.estado) = ?'
        params.append(estado)
    if colaborador:
        query += ' AND LOWER(b.colaborador) LIKE ?'
        params.append(f'%{colaborador}%')
    if cliente:
        query += ' AND LOWER(COALESCE(a.para_cliente, "")) LIKE ?'
        params.append(f'%{cliente}%')
    if tipo_trabajo:
        query += ' AND LOWER(COALESCE(a.tipo_trabajo, "")) LIKE ?'
        params.append(f'%{tipo_trabajo}%')

    query += ' ORDER BY b.fecha DESC, a.hora_inicio DESC, a.id DESC'

    conn = get_db()
    try:
        rows = conn.execute(query, params).fetchall()
    finally:
        conn.close()

    now_dt = get_peru_now().replace(tzinfo=None)
    resultados = []
    total_min_filtrado = 0

    for r in rows:
        desc_clean = _clean_html(r['descripcion'])
        com_clean = _clean_html(r['comentarios'])
        if texto_busqueda and (texto_busqueda not in desc_clean.lower() and texto_busqueda not in com_clean.lower()):
            continue

        # Calcular días sin cambio para tareas no completadas
        dias_sin_cambio = 0
        if r['estado'] != 'completada':
            ref_ts = r['updated_at'] or r['created_at'] or f"{r['fecha']} 12:00:00"
            try:
                clean_ts = str(ref_ts).replace('T', ' ').split('.')[0].split('+')[0].strip()
                if len(clean_ts) == 10:
                    clean_ts += ' 12:00:00'
                dt = datetime.strptime(clean_ts[:19], '%Y-%m-%d %H:%M:%S')
                dias_sin_cambio = max(0, (now_dt - dt).days)
            except Exception:
                dias_sin_cambio = 0

        if solo_estancadas and (r['estado'] == 'completada' or dias_sin_cambio < 7):
            continue

        dur = int(r['duracion_min'] or 0)
        total_min_filtrado += dur

        if len(resultados) < limite:
            resultados.append({
                'id': r['id'],
                'fecha': r['fecha'],
                'colaborador': r['colaborador'],
                'area': r['area'],
                'hora_inicio': r['hora_inicio'] or '',
                'hora_fin': r['hora_fin'] or '',
                'duracion_min': dur,
                'cliente': normalize_client_name(r['para_cliente']) or '',
                'tipo_trabajo': r['tipo_trabajo'] or '',
                'estado': r['estado'] or 'en_proceso',
                'descripcion': desc_clean,
                'comentarios': com_clean,
                'revision_decision': r['revision_decision'] or None,
                'revision_comentario': _clean_html(r['revision_comentario']) if r['revision_comentario'] else None,
                'dias_sin_cambio': dias_sin_cambio,
                'estancada': bool(dias_sin_cambio >= 7 and r['estado'] != 'completada'),
            })

    return {
        'total_coincidencias_retornadas': len(resultados),
        'minutos_totales_en_filtro': total_min_filtrado,
        'horas_totales_en_filtro': round(total_min_filtrado / 60.0, 2),
        'actividades': resultados,
    }


def _tool_estado_diario_colaboradores(args):
    fecha = (args.get('fecha') or get_peru_today_str()).strip()[:10]
    filtro_colab = (args.get('colaborador') or '').strip().lower()

    conn = get_db()
    try:
        users = conn.execute(
            '''
            SELECT u.id, u.username, u.full_name, u.role, COALESCE(t.nombre, 'General') AS area
            FROM users u
            LEFT JOIN teams t ON u.team_id = t.id
            WHERE u.is_active = 1 AND u.username != 'admin'
            ORDER BY u.full_name ASC
            '''
        ).fetchall()

        bitacoras = conn.execute(
            '''
            SELECT id, user_id, fecha, hora_inicio, colaborador, area, pendientes,
                   necesita_apoyo, apoyo_detalle, prioridad_siguiente, tiempo_total_min,
                   resumen_texto, estado
            FROM bitacoras
            WHERE fecha = ?
            ''',
            (fecha,),
        ).fetchall()

        acts = conn.execute(
            '''
            SELECT a.id, a.bitacora_id, a.hora_inicio, a.hora_fin, a.duracion_min,
                   a.tipo_trabajo, a.descripcion, a.para_cliente, a.estado, a.comentarios
            FROM actividades a
            JOIN bitacoras b ON a.bitacora_id = b.id
            WHERE b.fecha = ? AND (a.is_deleted IS NULL OR a.is_deleted = 0)
            ORDER BY a.hora_inicio ASC, a.orden ASC, a.id ASC
            ''',
            (fecha,),
        ).fetchall()
    finally:
        conn.close()

    acts_by_bitacora = defaultdict(list)
    for a in acts:
        acts_by_bitacora[a['bitacora_id']].append({
            'id': a['id'],
            'hora_inicio': a['hora_inicio'] or '',
            'hora_fin': a['hora_fin'] or '',
            'duracion_min': int(a['duracion_min'] or 0),
            'cliente': normalize_client_name(a['para_cliente']) or '',
            'tipo_trabajo': a['tipo_trabajo'] or '',
            'estado': a['estado'] or 'en_proceso',
            'descripcion': _clean_html(a['descripcion']),
            'comentarios': _clean_html(a['comentarios']),
        })

    bit_by_uid = {b['user_id']: b for b in bitacoras if b['user_id']}
    bit_by_name = {(b['colaborador'] or '').strip().lower(): b for b in bitacoras}

    detalle_colaboradores = []
    for u in users:
        fname = (u['full_name'] or u['username']).strip()
        if filtro_colab and (filtro_colab not in fname.lower() and filtro_colab not in u['username'].lower()):
            continue

        b = bit_by_uid.get(u['id']) or bit_by_name.get(fname.lower())
        if b:
            b_acts = acts_by_bitacora.get(b['id'], [])
            mins = sum(x['duracion_min'] for x in b_acts) or int(b['tiempo_total_min'] or 0)
            detalle_colaboradores.append({
                'user_id': u['id'],
                'username': u['username'],
                'colaborador': fname,
                'area': u['area'] or b['area'],
                'rol': u['role'],
                'registro_bitacora': True,
                'bitacora_id': b['id'],
                'estado_jornada': b['estado'] or 'generada',
                'hora_apertura': b['hora_inicio'] or '',
                'minutos_registrados': mins,
                'horas_registradas': round(mins / 60.0, 2),
                'porcentaje_meta_8h': round((mins / 480.0) * 100, 1),
                'necesita_apoyo': b['necesita_apoyo'] or 'No',
                'apoyo_detalle': _clean_html(b['apoyo_detalle']),
                'resumen_cierre': _clean_html(b['resumen_texto']),
                'pendientes_declarados': _clean_html(b['pendientes']),
                'prioridad_siguiente': _clean_html(b['prioridad_siguiente']),
                'cantidad_actividades': len(b_acts),
                'actividades': b_acts,
            })
        else:
            detalle_colaboradores.append({
                'user_id': u['id'],
                'username': u['username'],
                'colaborador': fname,
                'area': u['area'],
                'rol': u['role'],
                'registro_bitacora': False,
                'bitacora_id': None,
                'estado_jornada': 'sin_registro',
                'minutos_registrados': 0,
                'horas_registradas': 0.0,
                'porcentaje_meta_8h': 0.0,
                'necesita_apoyo': 'No',
                'cantidad_actividades': 0,
                'actividades': [],
            })

    return {
        'fecha': fecha,
        'total_colaboradores_evaluados': len(detalle_colaboradores),
        'con_bitacora': sum(1 for c in detalle_colaboradores if c['registro_bitacora']),
        'sin_bitacora': sum(1 for c in detalle_colaboradores if not c['registro_bitacora']),
        'colaboradores': detalle_colaboradores,
    }


def _tool_analizar_cliente_proyecto(args):
    cliente_q = (args.get('cliente') or '').strip().lower()
    fecha_desde = (args.get('fecha_desde') or '').strip()[:10]
    fecha_hasta = (args.get('fecha_hasta') or '').strip()[:10]

    query = '''
        SELECT a.id, a.duracion_min, a.tipo_trabajo, a.descripcion, a.para_cliente,
               a.estado, a.hora_inicio, a.hora_fin, b.fecha, b.colaborador
        FROM actividades a
        JOIN bitacoras b ON a.bitacora_id = b.id
        WHERE (a.is_deleted IS NULL OR a.is_deleted = 0)
    '''
    params = []
    if fecha_desde:
        query += ' AND b.fecha >= ?'
        params.append(fecha_desde)
    if fecha_hasta:
        query += ' AND b.fecha <= ?'
        params.append(fecha_hasta)
    if cliente_q:
        query += ' AND LOWER(COALESCE(a.para_cliente, "")) LIKE ?'
        params.append(f'%{cliente_q}%')

    query += ' ORDER BY b.fecha DESC, a.id DESC'

    conn = get_db()
    try:
        rows = conn.execute(query, params).fetchall()
    finally:
        conn.close()

    if not cliente_q:
        # Ranking global de clientes
        por_cli_min = defaultdict(int)
        por_cli_acts = Counter()
        por_cli_colabs = defaultdict(set)
        for r in rows:
            cli = normalize_client_name(r['para_cliente']) or 'Interno / Sin cliente'
            por_cli_min[cli] += int(r['duracion_min'] or 0)
            por_cli_acts[cli] += 1
            if r['colaborador']:
                por_cli_colabs[cli].add(r['colaborador'])

        ranking = [
            {
                'cliente': cli,
                'total_actividades': por_cli_acts[cli],
                'total_minutos': mins,
                'total_horas': round(mins / 60.0, 2),
                'colaboradores_involucrados': sorted(por_cli_colabs[cli]),
            }
            for cli, mins in sorted(por_cli_min.items(), key=lambda x: x[1], reverse=True)[:50]
        ]
        return {
            'modo': 'ranking_global_clientes',
            'total_clientes_distintos': len(por_cli_min),
            'ranking_clientes': ranking,
        }

    # Análisis profundo de un cliente específico
    total_min = 0
    por_colaborador = defaultdict(int)
    por_estado = Counter()
    por_categoria = Counter()
    historial = []

    for r in rows:
        dur = int(r['duracion_min'] or 0)
        total_min += dur
        por_colaborador[r['colaborador'] or 'Sin asignar'] += dur
        por_estado[r['estado'] or 'en_proceso'] += 1
        por_categoria[r['tipo_trabajo'] or 'Sin categoría'] += 1
        if len(historial) < 100:
            historial.append({
                'id': r['id'],
                'fecha': r['fecha'],
                'colaborador': r['colaborador'],
                'duracion_min': dur,
                'tipo_trabajo': r['tipo_trabajo'] or '',
                'estado': r['estado'] or 'en_proceso',
                'descripcion': _clean_html(r['descripcion']),
            })

    return {
        'cliente_consultado': args.get('cliente'),
        'total_actividades': len(rows),
        'total_minutos': total_min,
        'total_horas': round(total_min / 60.0, 2),
        'tiempo_por_colaborador': [
            {'colaborador': col, 'minutos': m, 'horas': round(m / 60.0, 2)}
            for col, m in sorted(por_colaborador.items(), key=lambda x: x[1], reverse=True)
        ],
        'distribucion_por_estado': dict(por_estado),
        'distribucion_por_tipo_trabajo': dict(por_categoria),
        'ultimas_actividades': historial,
    }


def _tool_detectar_alertas_y_cuellos_botella(args):
    fecha_ref = (args.get('fecha') or get_peru_today_str()).strip()[:10]
    now_dt = get_peru_now().replace(tzinfo=None)

    conn = get_db()
    try:
        # 1. Tareas bloqueadas o en revisión o abiertas antiguas (solo el eslabón más reciente activo)
        open_acts = conn.execute(
            '''
            SELECT a.id, a.descripcion, a.para_cliente, a.estado, a.duracion_min,
                   a.comentarios, a.created_at, a.updated_at,
                   b.fecha, b.colaborador, b.area
            FROM actividades a
            JOIN bitacoras b ON a.bitacora_id = b.id
            WHERE a.estado != 'completada'
              AND (a.is_deleted IS NULL OR a.is_deleted = 0)
              AND COALESCE(a.rollover_dismissed, 0) = 0
              AND NOT EXISTS (
                  SELECT 1 FROM actividades a_child
                  JOIN bitacoras b_child ON a_child.bitacora_id = b_child.id
                  WHERE a_child.parent_task_id = a.id
                    AND COALESCE(a_child.tipo_vinculo, 'continuacion') IN ('', 'continuacion')
                    AND b_child.fecha > b.fecha
              )
            ORDER BY b.fecha DESC, a.id DESC
            '''
        ).fetchall()

        # 2. Solicitudes de apoyo recientes (últimos 14 días)
        dt_14d = (datetime.strptime(fecha_ref, '%Y-%m-%d') - timedelta(days=14)).strftime('%Y-%m-%d')
        apoyo_rows = conn.execute(
            '''
            SELECT id, fecha, colaborador, area, necesita_apoyo, apoyo_detalle
            FROM bitacoras
            WHERE fecha >= ? AND fecha <= ?
              AND LOWER(TRIM(COALESCE(necesita_apoyo, 'no'))) IN ('sí', 'si', 'yes', 'true', '1')
            ORDER BY fecha DESC
            ''',
            (dt_14d, fecha_ref),
        ).fetchall()

        # 3. Colaboradores sin bitácora en la fecha de referencia
        active_users = conn.execute(
            '''
            SELECT u.id, u.username, u.full_name, COALESCE(t.nombre, 'General') AS area, u.role
            FROM users u
            LEFT JOIN teams t ON u.team_id = t.id
            WHERE u.is_active = 1 AND u.username != 'admin'
            '''
        ).fetchall()
        bits_today = conn.execute(
            "SELECT user_id, LOWER(TRIM(colaborador)) AS colab_lower FROM bitacoras WHERE fecha = ?",
            (fecha_ref,),
        ).fetchall()
    finally:
        conn.close()

    bloqueadas = []
    en_revision = []
    estancadas = []

    for r in open_acts:
        item = {
            'id': r['id'],
            'fecha': r['fecha'],
            'colaborador': r['colaborador'],
            'cliente': normalize_client_name(r['para_cliente']) or '',
            'estado': r['estado'],
            'descripcion': _clean_html(r['descripcion']),
            'comentarios': _clean_html(r['comentarios']),
        }
        if r['estado'] == 'bloqueado':
            bloqueadas.append(item)
        elif r['estado'] == 'en_revision':
            en_revision.append(item)

        ref_ts = r['updated_at'] or r['created_at'] or f"{r['fecha']} 12:00:00"
        try:
            clean_ts = str(ref_ts).replace('T', ' ').split('.')[0].split('+')[0].strip()
            if len(clean_ts) == 10:
                clean_ts += ' 12:00:00'
            dt = datetime.strptime(clean_ts[:19], '%Y-%m-%d %H:%M:%S')
            dias = max(0, (now_dt - dt).days)
            if dias >= 7:
                estancadas.append({**item, 'dias_sin_cambio': dias})
        except Exception:
            pass

    uids_today = {b['user_id'] for b in bits_today if b['user_id']}
    names_today = {b['colab_lower'] for b in bits_today if b['colab_lower']}
    sin_registro = []
    for u in active_users:
        fname = (u['full_name'] or u['username']).strip()
        if u['id'] not in uids_today and fname.lower() not in names_today:
            sin_registro.append({'id': u['id'], 'colaborador': fname, 'area': u['area'], 'rol': u['role']})

    return {
        'fecha_referencia': fecha_ref,
        'resumen_alertas': {
            'tareas_bloqueadas': len(bloqueadas),
            'tareas_en_revision_pendientes_lider': len(en_revision),
            'tareas_estancadas_7d_o_mas': len(estancadas),
            'solicitudes_apoyo_ultimos_14d': len(apoyo_rows),
            'colaboradores_sin_registro_en_fecha': len(sin_registro),
        },
        'tareas_bloqueadas': bloqueadas[:50],
        'tareas_en_revision': en_revision[:50],
        'tareas_estancadas': estancadas[:50],
        'solicitudes_apoyo': [
            {
                'bitacora_id': b['id'],
                'fecha': b['fecha'],
                'colaborador': b['colaborador'],
                'area': b['area'],
                'detalle': _clean_html(b['apoyo_detalle']),
            }
            for b in apoyo_rows
        ],
        'colaboradores_sin_registro': sin_registro,
    }


def _tool_listar_colaboradores_y_equipos(args):
    conn = get_db()
    try:
        users = conn.execute(
            '''
            SELECT u.id, u.username, u.full_name, u.role, COALESCE(t.nombre, 'General') AS area, u.email, u.phone,
                   u.team_id, t.nombre AS team_nombre,
                   (SELECT MAX(b.fecha) FROM bitacoras b WHERE b.user_id = u.id OR LOWER(b.colaborador) = LOWER(u.full_name)) AS ultima_bitacora
            FROM users u
            LEFT JOIN teams t ON u.team_id = t.id
            WHERE u.is_active = 1
            ORDER BY u.role ASC, u.full_name ASC
            '''
        ).fetchall()

        teams = conn.execute(
            '''
            SELECT t.id, t.nombre, t.descripcion, t.lider_id, u.full_name AS lider_nombre
            FROM teams t
            LEFT JOIN users u ON t.lider_id = u.id
            ORDER BY t.nombre ASC
            '''
        ).fetchall()
    finally:
        conn.close()

    return {
        'total_colaboradores_activos': len(users),
        'colaboradores': [
            {
                'id': u['id'],
                'username': u['username'],
                'nombre_completo': u['full_name'],
                'rol': 'analista' if u['role'] == 'operador' else u['role'],
                'area': u['area'],
                'equipo': u['team_nombre'] or 'Sin equipo asignado',
                'ultima_fecha_bitacora': u['ultima_bitacora'] or None,
            }
            for u in users
        ],
        'equipos': [
            {
                'id': t['id'],
                'nombre': t['nombre'],
                'descripcion': t['descripcion'] or '',
                'lider_id': t['lider_id'],
                'lider_nombre': t['lider_nombre'] or 'Sin líder asignado',
            }
            for t in teams
        ],
    }


def _tool_registrar_actividad_bitacora(args):
    actor = getattr(g, 'current_user', None) or {}
    if actor.get('is_mcp') and actor.get('mcp_mode') != 'read_write':
        raise PermissionError(
            'El servidor MCP está en modo Solo Lectura (read_only). '
            'Habilita el modo "Lectura y Escritura" en Gestión → Configuración → Servidor MCP para permitir el registro de actividades por IA.'
        )

    colab_q = (args.get('colaborador') or '').strip()
    descripcion = (args.get('descripcion') or '').strip()
    if not colab_q or not descripcion:
        raise ValueError('Los campos "colaborador" y "descripcion" son obligatorios.')

    fecha = (args.get('fecha') or get_peru_today_str()).strip()[:10]
    para_cliente = normalize_client_name(args.get('para_cliente') or '')
    tipo_trabajo = (args.get('tipo_trabajo') or 'Gestión / Operación').strip()
    hora_inicio = (args.get('hora_inicio') or get_peru_now().strftime('%H:%M')).strip()[:5]
    try:
        duracion_min = max(1, int(args.get('duracion_min') or 30))
    except Exception:
        duracion_min = 30
    estado = (args.get('estado') or 'en_proceso').strip()
    if estado not in ('en_proceso', 'pendiente', 'en_revision', 'completada', 'bloqueado'):
        estado = 'en_proceso'
    comentarios = (args.get('comentarios') or '').strip()
    now_str = get_peru_now_str()

    conn = get_db()
    try:
        cursor = conn.cursor()
        user_row = cursor.execute(
            '''
            SELECT u.id, u.username, u.full_name, COALESCE(t.nombre, 'General') AS area
            FROM users u
            LEFT JOIN teams t ON u.team_id = t.id
            WHERE u.is_active = 1
              AND (LOWER(u.username) = LOWER(?) OR LOWER(u.full_name) = LOWER(?) OR LOWER(u.full_name) LIKE LOWER(?))
            ORDER BY u.id ASC LIMIT 1
            ''',
            (colab_q, colab_q, f'%{colab_q}%'),
        ).fetchone()

        if not user_row:
            raise ValueError(f'No se encontró un colaborador activo que coincida con "{colab_q}".')

        uid = user_row['id']
        colab_name = user_row['full_name'] or user_row['username']
        area_name = user_row['area'] or 'General'

        bit_row = cursor.execute(
            'SELECT id FROM bitacoras WHERE user_id = ? AND fecha = ? LIMIT 1',
            (uid, fecha),
        ).fetchone()

        if bit_row:
            bitacora_id = bit_row['id']
        else:
            cursor.execute(
                '''
                INSERT INTO bitacoras (user_id, fecha, hora_inicio, colaborador, area, estado, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'en_progreso', ?, ?)
                ''',
                (uid, fecha, hora_inicio, colab_name, area_name, now_str, now_str),
            )
            bitacora_id = cursor.lastrowid

        hora_fin = calculate_hora_fin(hora_inicio, duracion_min, fecha) if hora_inicio else ''
        cursor.execute(
            '''
            INSERT INTO actividades (
                bitacora_id, hora_inicio, hora_fin, duracion_min, tipo_trabajo, descripcion,
                para_cliente, estado, comentarios, created_by_user_id, updated_by_user_id,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                bitacora_id,
                hora_inicio,
                hora_fin,
                duracion_min,
                tipo_trabajo,
                descripcion,
                para_cliente,
                estado,
                comentarios,
                uid,
                uid,
                now_str,
                now_str,
            ),
        )
        actividad_id = cursor.lastrowid

        recalculate_bitacora_durations(cursor, bitacora_id, fecha=fecha, now_peru=now_str)
        if estado == 'completada':
            propagate_completion_across_lineage(cursor, [actividad_id], now_str)

        eff_dur_row = cursor.execute('SELECT duracion_min FROM actividades WHERE id = ?', (actividad_id,)).fetchone()
        eff_dur = int(eff_dur_row[0]) if eff_dur_row else duracion_min
        conn.commit()

        return {
            'status': 'created',
            'actividad_id': actividad_id,
            'bitacora_id': bitacora_id,
            'colaborador': colab_name,
            'fecha': fecha,
            'hora_inicio': hora_inicio,
            'hora_fin': hora_fin,
            'duracion_min': eff_dur,
            'cliente': para_cliente,
            'estado': estado,
            'descripcion': descripcion,
        }
    finally:
        conn.close()


_TOOL_DISPATCH = {
    'resumen_ejecutivo_equipo': _tool_resumen_ejecutivo_equipo,
    'consultar_actividades': _tool_consultar_actividades,
    'estado_diario_colaboradores': _tool_estado_diario_colaboradores,
    'analizar_cliente_proyecto': _tool_analizar_cliente_proyecto,
    'detectar_alertas_y_cuellos_botella': _tool_detectar_alertas_y_cuellos_botella,
    'listar_colaboradores_y_equipos': _tool_listar_colaboradores_y_equipos,
    'registrar_actividad_bitacora': _tool_registrar_actividad_bitacora,
}


def execute_mcp_tool(tool_name, arguments=None):
    """Ejecuta una herramienta MCP por nombre y devuelve su diccionario resultado."""
    fn = _TOOL_DISPATCH.get(tool_name)
    if not fn:
        raise KeyError(f'Herramienta MCP desconocida: "{tool_name}". Herramientas disponibles: {list(_TOOL_DISPATCH.keys())}')
    return fn(arguments or {})


def read_mcp_resource(uri):
    """Lee un recurso MCP por su URI (`bitacora://...`)."""
    if uri == 'bitacora://resumen/hoy':
        return _tool_resumen_ejecutivo_equipo({'periodo': 'hoy'})
    if uri == 'bitacora://alertas/activas':
        return _tool_detectar_alertas_y_cuellos_botella({})
    if uri == 'bitacora://catalogo/clientes':
        return _tool_analizar_cliente_proyecto({})
    if uri == 'bitacora://equipo/directorio':
        return _tool_listar_colaboradores_y_equipos({})
    raise KeyError(f'Recurso MCP no encontrado: {uri}')


def build_mcp_prompt(name, arguments=None):
    """Construye un prompt enriquecido con datos reales listos para enviar al LLM."""
    args = arguments or {}
    if name == 'informe_gerencial_diario':
        fecha = (args.get('fecha') or get_peru_today_str()).strip()[:10]
        resumen = _tool_resumen_ejecutivo_equipo({'periodo': 'hoy', 'fecha': fecha})
        detalle = _tool_estado_diario_colaboradores({'fecha': fecha})
        prompt_text = (
            f"Actúa como Director de Operaciones de Marketing Alterno Perú. Con base en los datos reales "
            f"de la Bitácora Diaria del {fecha}, redacta un Informe Gerencial Ejecutivo estructurado en:\n"
            f"1. Resumen de Productividad y Cobertura (quiénes cumplieron la meta de 8h y quiénes faltan registrar).\n"
            f"2. Principales Entregables por Cliente/Proyecto.\n"
            f"3. Solicitudes de Apoyo, Bloqueos y Recomendaciones.\n\n"
            f"DATOS EN TIEMPO REAL:\n{json.dumps({'resumen': resumen, 'detalle_equipo': detalle}, ensure_ascii=False, indent=2)}"
        )
        return {
            'description': f'Informe Gerencial Diario ({fecha})',
            'messages': [{'role': 'user', 'content': {'type': 'text', 'text': prompt_text}}],
        }

    if name == 'auditoria_cliente':
        cliente = args.get('cliente') or ''
        datos = _tool_analizar_cliente_proyecto({'cliente': cliente})
        prompt_text = (
            f"Analiza la dedicación operativa, inversión de horas, colaboradores asignados y estado de entregables "
            f"para el cliente/proyecto '{cliente or 'Global'}'. Identifica desviaciones o tareas pendientes críticas:\n\n"
            f"DATOS DEL CLIENTE:\n{json.dumps(datos, ensure_ascii=False, indent=2)}"
        )
        return {
            'description': f'Auditoría de Cliente: {cliente or "Global"}',
            'messages': [{'role': 'user', 'content': {'type': 'text', 'text': prompt_text}}],
        }

    if name == 'deteccion_riesgos_operativos':
        alertas = _tool_detectar_alertas_y_cuellos_botella({})
        prompt_text = (
            "Evalúa los siguientes riesgos operativos, tareas bloqueadas, actividades estancadas (>=7 días) y "
            "solicitudes de apoyo del equipo. Propón un plan de acción priorizado para el líder de equipo:\n\n"
            f"ALERTAS ACTIVAS:\n{json.dumps(alertas, ensure_ascii=False, indent=2)}"
        )
        return {
            'description': 'Detección de Riesgos y Cuellos de Botella',
            'messages': [{'role': 'user', 'content': {'type': 'text', 'text': prompt_text}}],
        }

    raise KeyError(f'Prompt MCP no encontrado: {name}')


# ============================================================================
# PROTOCOLO JSON-RPC 2.0 PARA MCP STREAMABLE HTTP (`POST /api/mcp` & `GET /api/mcp`)
# ============================================================================

def _handle_jsonrpc_message(msg):
    """Procesa un mensaje individual JSON-RPC 2.0 según la especificación Model Context Protocol."""
    if not isinstance(msg, dict):
        return {'jsonrpc': '2.0', 'id': None, 'error': {'code': -32600, 'message': 'Invalid Request'}}

    req_id = msg.get('id')
    method = msg.get('method', '')
    params = msg.get('params') or {}

    # Notificaciones JSON-RPC (sin id): no requieren respuesta con payload
    if req_id is None and method.startswith('notifications/'):
        return None

    try:
        if method == 'initialize':
            client_version = str(params.get('protocolVersion') or MCP_PROTOCOL_VERSION).strip()
            supported = ('2025-06-18', '2025-03-26', '2024-11-05')
            negotiated = client_version if (client_version in supported or client_version.startswith(('2024-', '2025-'))) else MCP_PROTOCOL_VERSION
            return {
                'jsonrpc': '2.0',
                'id': req_id,
                'result': {
                    'protocolVersion': negotiated,
                    'capabilities': {
                        'tools': {'listChanged': False},
                        'resources': {'subscribe': False, 'listChanged': False},
                        'prompts': {'listChanged': False},
                    },
                    'serverInfo': {
                        'name': MCP_SERVER_NAME,
                        'version': MCP_SERVER_VERSION,
                    },
                    'instructions': (
                        'Servidor MCP oficial de Bitácora Diaria (Marketing Alterno Perú). '
                        'Usa las herramientas para consultar el avance diario por colaborador, filtrar actividades '
                        'por cliente/estado/fecha, auditar horas por proyecto y detectar bloqueos o tareas estancadas.'
                    ),
                },
            }

        if method == 'ping':
            return {'jsonrpc': '2.0', 'id': req_id, 'result': {}}

        if method == 'tools/list':
            return {'jsonrpc': '2.0', 'id': req_id, 'result': {'tools': MCP_TOOLS}}

        if method == 'tools/call':
            tool_name = params.get('name')
            tool_args = params.get('arguments') or {}
            try:
                data = execute_mcp_tool(tool_name, tool_args)
                return {
                    'jsonrpc': '2.0',
                    'id': req_id,
                    'result': {
                        'content': [
                            {
                                'type': 'text',
                                'text': json.dumps(data, ensure_ascii=False, indent=2),
                            }
                        ],
                        'structuredContent': data,
                        'isError': False,
                    },
                }
            except (KeyError, ValueError, PermissionError) as tool_err:
                return {
                    'jsonrpc': '2.0',
                    'id': req_id,
                    'result': {
                        'content': [{'type': 'text', 'text': f'Error: {str(tool_err)}'}],
                        'isError': True,
                    },
                }

        if method == 'resources/list':
            return {'jsonrpc': '2.0', 'id': req_id, 'result': {'resources': MCP_RESOURCES}}

        if method == 'resources/read':
            uri = params.get('uri')
            data = read_mcp_resource(uri)
            return {
                'jsonrpc': '2.0',
                'id': req_id,
                'result': {
                    'contents': [
                        {
                            'uri': uri,
                            'mimeType': 'application/json',
                            'text': json.dumps(data, ensure_ascii=False, indent=2),
                        }
                    ]
                },
            }

        if method == 'prompts/list':
            return {'jsonrpc': '2.0', 'id': req_id, 'result': {'prompts': MCP_PROMPTS}}

        if method == 'prompts/get':
            prompt_name = params.get('name')
            prompt_args = params.get('arguments') or {}
            prompt_res = build_mcp_prompt(prompt_name, prompt_args)
            return {'jsonrpc': '2.0', 'id': req_id, 'result': prompt_res}

        return {
            'jsonrpc': '2.0',
            'id': req_id,
            'error': {'code': -32601, 'message': f'Method not found: {method}'},
        }
    except Exception as exc:
        return {
            'jsonrpc': '2.0',
            'id': req_id,
            'error': {'code': -32603, 'message': f'Internal error: {str(exc)}'},
        }


@mcp_bp.route('/api/mcp', methods=['GET', 'POST', 'DELETE', 'OPTIONS'])
def mcp_streamable_endpoint():
    """
    Endpoint principal Model Context Protocol (MCP) sobre HTTP.
    - POST: Recibe llamadas JSON-RPC 2.0 (`initialize`, `tools/list`, `tools/call`, `resources/read`, etc.).
    - GET: Devuelve el manifiesto de capacidades del servidor MCP y estado de conexión.
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    if request.method == 'DELETE':
        return '', 204

    session_id = request.headers.get('Mcp-Session-Id') or 'bitacora-mcp-session-v1'

    if request.method == 'GET':
        actor = getattr(g, 'current_user', None) or {}
        resp = jsonify({
            'server': MCP_SERVER_NAME,
            'version': MCP_SERVER_VERSION,
            'protocolVersion': MCP_PROTOCOL_VERSION,
            'transport': 'streamable-http',
            'status': 'ready',
            'access_mode': actor.get('mcp_mode', 'read_only'),
            'tools_count': len(MCP_TOOLS),
            'resources_count': len(MCP_RESOURCES),
            'prompts_count': len(MCP_PROMPTS),
            'endpoints': {
                'mcp_jsonrpc': '/api/mcp',
                'rest_query': '/api/mcp/query',
                'tools_catalog': '/api/mcp/tools',
                'openapi_spec': '/api/mcp/openapi.json',
            },
        })
        resp.headers['Mcp-Session-Id'] = session_id
        return resp, 200

    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({
            'jsonrpc': '2.0',
            'id': None,
            'error': {'code': -32700, 'message': 'Parse error: JSON body required'},
        }), 400

    if isinstance(payload, list):
        responses = []
        for item in payload:
            res = _handle_jsonrpc_message(item)
            if res is not None:
                responses.append(res)
        if not responses:
            r202 = make_response('', 202)
            r202.headers['Mcp-Session-Id'] = session_id
            return r202
        resp = jsonify(responses)
        resp.headers['Mcp-Session-Id'] = session_id
        return resp, 200

    response_obj = _handle_jsonrpc_message(payload)
    if response_obj is None:
        r202 = make_response('', 202)
        r202.headers['Mcp-Session-Id'] = session_id
        return r202
    resp = jsonify(response_obj)
    resp.headers['Mcp-Session-Id'] = session_id
    return resp, 200


# ============================================================================
# DESCUBRIMIENTO Y FLUJO OAUTH 2.0 / 2.1 PARA GEMINI WEB Y CLAUDE WEB
# (RFC 8414, RFC 9728, RFC 7591 & PKCE S256)
# ============================================================================

@mcp_bp.route('/.well-known/oauth-protected-resource', methods=['GET', 'OPTIONS'])
@mcp_bp.route('/.well-known/oauth-protected-resource/<path:subpath>', methods=['GET', 'OPTIONS'])
def oauth_protected_resource_metadata(subpath=None):
    """RFC 9728: Metadatos del recurso protegido MCP para descubrimiento automático de Gemini y Claude."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    base_url = _get_public_base_url()
    return jsonify({
        'resource': f'{base_url}/api/mcp',
        'authorization_servers': [base_url],
        'bearer_methods_supported': ['header'],
        'scopes_supported': ['mcp', 'read', 'write'],
    }), 200


@mcp_bp.route('/.well-known/oauth-authorization-server', methods=['GET', 'OPTIONS'])
@mcp_bp.route('/.well-known/oauth-authorization-server/<path:subpath>', methods=['GET', 'OPTIONS'])
@mcp_bp.route('/.well-known/openid-configuration', methods=['GET', 'OPTIONS'])
@mcp_bp.route('/.well-known/openid-configuration/<path:subpath>', methods=['GET', 'OPTIONS'])
def oauth_authorization_server_metadata(subpath=None):
    """RFC 8414: Metadatos del servidor de autorización OAuth 2.0 / 2.1 integrado."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    base_url = _get_public_base_url()
    return jsonify({
        'issuer': base_url,
        'authorization_endpoint': f'{base_url}/api/mcp/oauth/authorize',
        'token_endpoint': f'{base_url}/api/mcp/oauth/token',
        'registration_endpoint': f'{base_url}/api/mcp/oauth/register',
        'response_types_supported': ['code'],
        'grant_types_supported': ['authorization_code', 'refresh_token', 'client_credentials'],
        'token_endpoint_auth_methods_supported': ['client_secret_post', 'client_secret_basic', 'none'],
        'code_challenge_methods_supported': ['S256', 'plain'],
        'scopes_supported': ['mcp', 'read', 'write'],
    }), 200


@mcp_bp.route('/api/mcp/oauth/register', methods=['POST', 'OPTIONS'])
def oauth_dynamic_client_register():
    """RFC 7591: Registro dinámico de clientes OAuth para conectores MCP que no piden Client ID manual."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    body = request.get_json(silent=True) or {}
    cfg = get_or_init_mcp_settings()
    return jsonify({
        'client_id': MCP_OAUTH_CLIENT_ID,
        'client_secret': cfg['api_key'],
        'client_name': body.get('client_name', 'MCP AI Client'),
        'redirect_uris': body.get('redirect_uris', []),
        'grant_types': ['authorization_code', 'refresh_token', 'client_credentials'],
        'response_types': ['code'],
        'token_endpoint_auth_method': body.get('token_endpoint_auth_method', 'client_secret_post'),
    }), 201


def _issue_oauth_code(payload):
    s = URLSafeTimedSerializer(_get_secret_key(), salt=MCP_OAUTH_CODE_SALT)
    return s.dumps(payload)


def _load_oauth_code(code_str):
    s = URLSafeTimedSerializer(_get_secret_key(), salt=MCP_OAUTH_CODE_SALT)
    return s.loads(code_str, max_age=600)


def _render_oauth_authorize_html(params, error_msg=None):
    hidden_inputs = '\n'.join(
        f'<input type="hidden" name="{k}" value="{str(v or "").replace(chr(34), "&quot;")}" />'
        for k, v in params.items()
    )
    err_block = (
        f'<div style="background:#FEE2E2;border:1px solid #FCA5A5;color:#991B1B;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:600;margin-bottom:14px;">{error_msg}</div>'
        if error_msg
        else ''
    )
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Autorizar Conexión MCP — Bitácora Digital</title>
  <style>
    body {{
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #090D16 0%, #111827 60%, #0E2A38 100%);
      color: #0F172A;
      padding: 16px;
    }}
    .card {{
      background: #FFFFFF;
      width: 100%;
      max-width: 410px;
      border-radius: 20px;
      padding: 28px 26px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.45);
    }}
    .badge {{
      display: inline-block;
      background: #ECFEFF;
      color: #0E7490;
      border: 1px solid #A5F3FC;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 10px;
    }}
    h1 {{
      margin: 0 0 6px 0;
      font-size: 20px;
      font-weight: 800;
      color: #0F172A;
    }}
    p {{
      margin: 0 0 18px 0;
      font-size: 13px;
      color: #475569;
      line-height: 1.45;
    }}
    label {{
      display: block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #334155;
      margin-bottom: 5px;
    }}
    input[type="text"], input[type="password"] {{
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #CBD5E1;
      font-size: 13px;
      margin-bottom: 14px;
      outline: none;
    }}
    input:focus {{
      border-color: #06B6D4;
      box-shadow: 0 0 0 3px rgba(6,182,212,0.18);
    }}
    .divider {{
      text-align: center;
      font-size: 11px;
      color: #94A3B8;
      margin: 6px 0 12px 0;
      font-weight: 700;
      text-transform: uppercase;
    }}
    button {{
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 999px;
      background: linear-gradient(90deg, #06B6D4, #0891B2);
      color: #FFFFFF;
      font-weight: 800;
      font-size: 14px;
      cursor: pointer;
    }}
    button:hover {{
      filter: brightness(1.06);
    }}
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">OAuth 2.0 • Model Context Protocol</span>
    <h1>Conectar Bitácora Digital con IA</h1>
    <p>Autoriza el acceso seguro al servidor MCP de <strong>Marketing Alterno Perú</strong> ingresando tus credenciales de Administrador o tu MCP API Key.</p>
    {err_block}
    <form method="POST" action="/api/mcp/oauth/authorize">
      {hidden_inputs}
      <label>Usuario Administrador</label>
      <input type="text" name="username" placeholder="admin" value="admin" autocomplete="username" />
      <label>Contraseña de Administrador</label>
      <input type="password" name="password" placeholder="Tu contraseña de Bitácora" autocomplete="current-password" />
      <div class="divider">— O usa directamente tu clave MCP —</div>
      <label>MCP API Key (Opcional si ingresas contraseña)</label>
      <input type="password" name="mcp_api_key" placeholder="mcp_bita_..." />
      <button type="submit">Autorizar y Conectar →</button>
    </form>
  </div>
</body>
</html>"""


@mcp_bp.route('/api/mcp/oauth/authorize', methods=['GET', 'POST', 'OPTIONS'])
def oauth_authorize_endpoint():
    """
    Endpoint interactivo OAuth 2.0 Authorization Code + PKCE para Gemini y Claude.
    Permite autorizar la conexión iniciando sesión como admin o con la MCP API Key.
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    src = request.values
    oauth_params = {
        'response_type': src.get('response_type', 'code'),
        'client_id': src.get('client_id', MCP_OAUTH_CLIENT_ID),
        'redirect_uri': src.get('redirect_uri', ''),
        'state': src.get('state', ''),
        'scope': src.get('scope', 'mcp'),
        'code_challenge': src.get('code_challenge', ''),
        'code_challenge_method': src.get('code_challenge_method', 'S256'),
    }

    if request.method == 'GET':
        return _render_oauth_authorize_html(oauth_params), 200, {'Content-Type': 'text/html; charset=utf-8'}

    # POST: validar credenciales de admin o MCP API Key
    mcp_key_input = (request.form.get('mcp_api_key') or '').strip()
    username = (request.form.get('username') or '').strip()
    password = request.form.get('password') or ''

    authorized = False
    if mcp_key_input:
        ok, _ = verify_mcp_api_key(mcp_key_input)
        authorized = ok

    if not authorized and username and password:
        conn = get_db()
        try:
            row = conn.execute(
                "SELECT id, role, is_active, password_hash FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1",
                (username,),
            ).fetchone()
            if row and row['is_active'] and row['role'] == 'admin' and check_password_hash(row['password_hash'], password):
                authorized = True
        finally:
            conn.close()

    if not authorized:
        return (
            _render_oauth_authorize_html(oauth_params, 'Credenciales inválidas. Verifica la contraseña de admin o la MCP API Key.'),
            401,
            {'Content-Type': 'text/html; charset=utf-8'},
        )

    code = _issue_oauth_code({
        'client_id': oauth_params['client_id'],
        'redirect_uri': oauth_params['redirect_uri'],
        'code_challenge': oauth_params['code_challenge'],
        'code_challenge_method': oauth_params['code_challenge_method'],
    })

    redirect_uri = oauth_params['redirect_uri']
    if not redirect_uri:
        return jsonify({'code': code, 'state': oauth_params['state']}), 200

    sep = '&' if '?' in redirect_uri else '?'
    target = f"{redirect_uri}{sep}code={urllib.parse.quote(code)}"
    if oauth_params['state']:
        target += f"&state={urllib.parse.quote(oauth_params['state'])}"
    return redirect(target, code=302)


@mcp_bp.route('/api/mcp/oauth/token', methods=['POST', 'OPTIONS'])
def oauth_token_endpoint():
    """
    Endpoint OAuth 2.0 Token (`authorization_code`, `refresh_token`, `client_credentials`).
    Compatible con envío por formulario URL-encoded, JSON o HTTP Basic Auth, y PKCE S256/plain.
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    data = {}
    if request.is_json:
        data.update(request.get_json(silent=True) or {})
    if request.form:
        data.update(request.form.to_dict())

    grant_type = (data.get('grant_type') or 'authorization_code').strip()
    cfg = get_or_init_mcp_settings()
    if not cfg['enabled']:
        return jsonify({'error': 'access_denied', 'error_description': 'MCP server is disabled'}), 403

    # Extraer client_secret desde Basic Auth si fue enviado en cabecera Authorization
    client_secret = (data.get('client_secret') or '').strip()
    auth_header = request.headers.get('Authorization', '')
    if auth_header.lower().startswith('basic '):
        try:
            decoded = base64.b64decode(auth_header[6:].strip()).decode('utf-8', errors='ignore')
            if ':' in decoded:
                _, basic_secret = decoded.split(':', 1)
                if not client_secret:
                    client_secret = basic_secret.strip()
        except Exception:
            pass

    if grant_type == 'authorization_code':
        code_str = (data.get('code') or '').strip()
        if not code_str:
            return jsonify({'error': 'invalid_request', 'error_description': 'Missing authorization code'}), 400
        try:
            code_data = _load_oauth_code(code_str)
        except (BadSignature, SignatureExpired):
            return jsonify({'error': 'invalid_grant', 'error_description': 'Invalid or expired authorization code'}), 400

        # Verificar PKCE si el cliente envió code_challenge durante /authorize
        code_challenge = code_data.get('code_challenge') or ''
        code_verifier = (data.get('code_verifier') or '').strip()
        if code_challenge and code_verifier:
            method = (code_data.get('code_challenge_method') or 'S256').upper()
            if method == 'S256':
                digest = hashlib.sha256(code_verifier.encode('ascii')).digest()
                computed = base64.urlsafe_b64encode(digest).rstrip(b'=').decode('ascii')
            else:
                computed = code_verifier
            if not secrets.compare_digest(computed, code_challenge):
                return jsonify({'error': 'invalid_grant', 'error_description': 'PKCE verification failed'}), 400

    elif grant_type == 'client_credentials':
        ok, _ = verify_mcp_api_key(client_secret)
        if not ok:
            return jsonify({'error': 'invalid_client', 'error_description': 'Invalid client_secret (use your MCP API Key)'}), 401

    elif grant_type == 'refresh_token':
        refresh_tok = (data.get('refresh_token') or client_secret).strip()
        ok, _ = verify_mcp_api_key(refresh_tok)
        if not ok:
            return jsonify({'error': 'invalid_grant', 'error_description': 'Invalid refresh token'}), 400
    else:
        return jsonify({'error': 'unsupported_grant_type'}), 400

    resp = jsonify({
        'access_token': cfg['api_key'],
        'token_type': 'Bearer',
        'expires_in': 2592000,
        'refresh_token': cfg['api_key'],
        'scope': 'mcp read write',
    })
    resp.headers['Cache-Control'] = 'no-store'
    resp.headers['Pragma'] = 'no-cache'
    return resp, 200


# ============================================================================
# PUENTE REST & OPENAPI 3.1 PARA OTROS MODELOS DE IA (ChatGPT Actions, Gemini, n8n)
# ============================================================================

@mcp_bp.route('/api/mcp/tools', methods=['GET', 'OPTIONS'])
def mcp_list_tools_rest():
    """Devuelve el catálogo completo de herramientas, recursos y prompts MCP en formato REST JSON."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    return jsonify({
        'server': MCP_SERVER_NAME,
        'version': MCP_SERVER_VERSION,
        'tools': MCP_TOOLS,
        'resources': MCP_RESOURCES,
        'prompts': MCP_PROMPTS,
    }), 200


@mcp_bp.route('/api/mcp/query', methods=['POST', 'OPTIONS'])
def mcp_execute_tool_rest():
    """
    Permite a cualquier IA o automatización (n8n, Make, Custom GPT, LangChain, Gemini Function Calling)
    invocar directamente cualquier herramienta MCP mediante un POST sencillo:
    `{"tool": "resumen_ejecutivo_equipo", "arguments": {"periodo": "7d"}}`
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    body = request.get_json(silent=True) or {}
    tool_name = (body.get('tool') or body.get('name') or '').strip()
    arguments = body.get('arguments') or body.get('params') or {}

    if not tool_name:
        return jsonify({
            'error': 'Debes especificar el campo "tool" con el nombre de la herramienta a ejecutar.',
            'available_tools': [t['name'] for t in MCP_TOOLS],
        }), 400

    try:
        result = execute_mcp_tool(tool_name, arguments)
        return jsonify({
            'ok': True,
            'tool': tool_name,
            'result': result,
        }), 200
    except PermissionError as exc:
        return jsonify({'ok': False, 'error': str(exc), 'code': 'mcp_read_only'}), 403
    except (KeyError, ValueError) as exc:
        return jsonify({'ok': False, 'error': str(exc)}), 400
    except Exception as exc:
        return jsonify({'ok': False, 'error': f'Error al ejecutar herramienta: {str(exc)}'}), 500


@mcp_bp.route('/api/mcp/openapi.json', methods=['GET', 'OPTIONS'])
def mcp_openapi_spec():
    """
    Esquema OpenAPI 3.1.0 autogenerado para importar en ChatGPT Custom GPT Actions,
    OpenWebUI, Dify, Flowise o Copilot Studio con un solo enlace.
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    forwarded_proto = request.headers.get('X-Forwarded-Proto', request.scheme)
    base_url = f"{forwarded_proto}://{request.host}"

    spec = {
        'openapi': '3.1.0',
        'info': {
            'title': 'Bitácora Diaria MCP & AI Bridge API',
            'version': MCP_SERVER_VERSION,
            'description': (
                'API de conexión directa para Modelos de IA (MCP / Function Calling) sobre el sistema '
                'Bitácora Diaria de Marketing Alterno Perú.'
            ),
        },
        'servers': [{'url': base_url}],
        'components': {
            'securitySchemes': {
                'BearerAuth': {
                    'type': 'http',
                    'scheme': 'bearer',
                    'description': 'Usa la MCP API Key (mcp_bita_...) generada en Gestión → Configuración.',
                }
            }
        },
        'security': [{'BearerAuth': []}],
        'paths': {
            '/api/mcp/query': {
                'post': {
                    'operationId': 'queryBitacoraMCP',
                    'summary': 'Ejecuta una herramienta de consulta o análisis sobre la Bitácora Diaria',
                    'description': (
                        'Permite consultar el resumen ejecutivo del equipo, filtrar actividades por fecha/cliente/colaborador, '
                        'auditar horas por cliente o detectar bloqueos y tareas estancadas.'
                    ),
                    'requestBody': {
                        'required': True,
                        'content': {
                            'application/json': {
                                'schema': {
                                    'type': 'object',
                                    'required': ['tool'],
                                    'properties': {
                                        'tool': {
                                            'type': 'string',
                                            'enum': [t['name'] for t in MCP_TOOLS],
                                            'description': 'Nombre de la herramienta MCP a invocar.',
                                        },
                                        'arguments': {
                                            'type': 'object',
                                            'description': 'Parámetros de filtrado según la herramienta elegida.',
                                        },
                                    },
                                }
                            }
                        },
                    },
                    'responses': {
                        '200': {
                            'description': 'Resultado estructurado de la herramienta MCP.',
                        }
                    },
                }
            }
        },
    }
    return jsonify(spec), 200


# ============================================================================
# ENDPOINTS DE ADMINISTRACIÓN DEL SERVIDOR MCP (SOLO ADMIN)
# ============================================================================

@mcp_bp.route('/api/admin/mcp/config', methods=['GET', 'POST', 'OPTIONS'])
def admin_mcp_config():
    """Obtiene o actualiza la configuración del servidor MCP (estado, modo de acceso y API Key)."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    actor = getattr(g, 'current_user', None) or {}
    if actor.get('role') != 'admin' or actor.get('is_mcp'):
        return jsonify({'error': 'Acceso reservado a administradores humanos'}), 403

    conn = get_db()
    try:
        if request.method == 'POST':
            data = request.get_json(silent=True) or {}
            if 'enabled' in data:
                val = 'true' if bool(data['enabled']) else 'false'
                conn.execute(
                    "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('mcp_enabled', ?, CURRENT_TIMESTAMP)",
                    (val,),
                )
            if 'access_mode' in data and data['access_mode'] in ('read_only', 'read_write'):
                conn.execute(
                    "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('mcp_access_mode', ?, CURRENT_TIMESTAMP)",
                    (data['access_mode'],),
                )
            conn.commit()

        cfg = get_or_init_mcp_settings(conn)
        return jsonify({
            'enabled': cfg['enabled'],
            'access_mode': cfg['access_mode'],
            'api_key': cfg['api_key'],
            'api_key_masked': cfg['api_key_masked'],
            'server_name': MCP_SERVER_NAME,
            'protocol_version': MCP_PROTOCOL_VERSION,
            'tools': [
                {'name': t['name'], 'description': t['description']}
                for t in MCP_TOOLS
            ],
            'resources': MCP_RESOURCES,
            'prompts': MCP_PROMPTS,
        }), 200
    finally:
        conn.close()


@mcp_bp.route('/api/admin/mcp/rotate-key', methods=['POST', 'OPTIONS'])
def admin_mcp_rotate_key():
    """Regenera la API Key del servidor MCP invalidando inmediatamente la anterior."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    actor = getattr(g, 'current_user', None) or {}
    if actor.get('role') != 'admin' or actor.get('is_mcp'):
        return jsonify({'error': 'Acceso reservado a administradores humanos'}), 403

    new_key = rotate_mcp_api_key()
    return jsonify({
        'ok': True,
        'api_key': new_key,
        'api_key_masked': new_key[:13] + '••••••••••••' + new_key[-4:],
        'message': 'Clave MCP regenerada exitosamente. Actualiza tus clientes de IA con la nueva clave.',
    }), 200

