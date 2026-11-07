import os
from collections import Counter, defaultdict
from flask import Blueprint, jsonify, request, send_file, g
from database import (
    get_db,
    create_hot_backup,
    list_backups,
    get_peru_today_str,
)

system_bp = Blueprint('system_bp', __name__)


def normalize_client_name(raw_name):
    """Normaliza espacios múltiples y bordes en el nombre de cliente/proyecto."""
    if not raw_name:
        return ''
    return ' '.join(str(raw_name).strip().split())


@system_bp.route('/api/admin/backup-db', methods=['GET', 'OPTIONS'])
def admin_download_backup_db():
    """
    Genera un snapshot atómico en caliente de la base SQLite usando sqlite3.backup()
    y lo descarga como archivo .db para respaldo externo seguro.
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    actor = getattr(g, 'current_user', None) or {}
    if actor.get('role') != 'admin':
        return jsonify({'error': 'Acceso restringido a administradores'}), 403

    backup_path = create_hot_backup(reason='admin_download')
    if not backup_path or not os.path.exists(backup_path):
        return jsonify({'error': 'No se pudo generar el archivo de respaldo SQLite'}), 500

    download_name = f"bitacora_backup_{get_peru_today_str()}.db"
    return send_file(
        backup_path,
        mimetype='application/x-sqlite3',
        as_attachment=True,
        download_name=download_name,
    )


@system_bp.route('/api/admin/backups', methods=['GET', 'OPTIONS'])
def admin_list_backups():
    """Devuelve la lista de respaldos automáticos y manuales almacenados en /data/backups."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    actor = getattr(g, 'current_user', None) or {}
    if actor.get('role') != 'admin':
        return jsonify({'error': 'Acceso restringido a administradores'}), 403

    backups = list_backups()
    return jsonify({'backups': backups, 'total': len(backups)})


@system_bp.route('/api/clientes/sugerencias', methods=['GET', 'OPTIONS'])
def get_clientes_sugerencias():
    """
    Devuelve la lista deduplicada y normalizada de clientes/proyectos registrados,
    eligiendo la capitalización más frecuente para cada nombre y ordenando por uso.
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    conn = get_db()
    try:
        rows = conn.execute('''
            SELECT para_cliente
            FROM actividades
            WHERE para_cliente IS NOT NULL
              AND TRIM(para_cliente) != ''
              AND (is_deleted IS NULL OR is_deleted = 0)
        ''').fetchall()
    finally:
        conn.close()

    # Agrupar por clave insensible a mayúsculas/espacios y elegir la variante más usada
    variant_counts = defaultdict(Counter)
    total_counts = Counter()

    for r in rows:
        cleaned = normalize_client_name(r['para_cliente'])
        if not cleaned:
            continue
        key = cleaned.lower()
        variant_counts[key][cleaned] += 1
        total_counts[key] += 1

    sugerencias = []
    for key, count in total_counts.most_common(100):
        canonical_name = variant_counts[key].most_common(1)[0][0]
        sugerencias.append({
            'nombre': canonical_name,
            'usos': count,
        })

    return jsonify({
        'clientes': [s['nombre'] for s in sugerencias],
        'detalle': sugerencias,
    })

