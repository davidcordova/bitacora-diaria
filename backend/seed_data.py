import sqlite3
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
from database import get_db

def seed_team_and_activities():
    conn = get_db()
    cursor = conn.cursor()
    
    print("Inicializando datos de prueba para equipo y bitácoras...")
    
    # 1. Asegurar que existe el Equipo 1 con líder Juan Pérez García (id: 3)
    cursor.execute('''
        INSERT OR REPLACE INTO teams (id, nombre, descripcion, lider_id, created_at)
        VALUES (1, 'Equipo de Sistemas e Infraestructura', 'Área de TI, desarrollo interno, infraestructura y soporte', 3, CURRENT_TIMESTAMP)
    ''')
    
    # 2. Asignar a todos los colaboradores al Equipo 1 con teléfonos válidos
    admin_hash = generate_password_hash('M1un1c4cl4v3')
    user_hash = generate_password_hash('123456')
    users_data = [
        (1, 'admin', 'admin@marketingalterno.pe', admin_hash, 'Administrador Principal', 'admin', None, '51999888777'),
        (3, 'juan', 'juan.perez@marketingalterno.pe', user_hash, 'Juan Pérez García', 'lider', 1, '51987654321'),
        (4, 'maria', 'maria.lopez@marketingalterno.pe', user_hash, 'María López', 'analista', 1, '51912345678'),
        (5, 'carlos', 'carlos.mendoza@marketingalterno.pe', user_hash, 'Carlos Mendoza', 'analista', 1, '51923456789'),
        (6, 'pedro', 'pedro.gomez@marketingalterno.pe', user_hash, 'Pedro Gómez', 'analista', 1, '51934567890'),
    ]
    
    for uid, uname, email, phash, fname, role, tid, phone in users_data:
        cursor.execute('''
            INSERT INTO users (id, username, email, password_hash, full_name, role, team_id, phone, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                email = excluded.email,
                password_hash = excluded.password_hash,
                full_name = excluded.full_name,
                role = excluded.role,
                team_id = excluded.team_id,
                phone = excluded.phone
        ''', (uid, uname, email, phash, fname, role, tid, phone))
        
    today_str = datetime.now().strftime('%Y-%m-%d')
    yesterday_str = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    stalled_time = (datetime.now() - timedelta(hours=28)).strftime('%Y-%m-%d %H:%M:%S')
    recent_time = (datetime.now() - timedelta(minutes=45)).strftime('%Y-%m-%d %H:%M:%S')
    
    # 3. Limpiar bitácoras y actividades previas de prueba de hoy para evitar duplicados
    cursor.execute("DELETE FROM actividades WHERE bitacora_id IN (SELECT id FROM bitacoras WHERE fecha = ?)", (today_str,))
    cursor.execute("DELETE FROM bitacoras WHERE fecha = ?", (today_str,))
    
    # ==================== BITÁCORA 1: JUAN PÉREZ GARCÍA (Líder) ====================
    # Horas: 330 min (~5.5h)
    cursor.execute('''
        INSERT INTO bitacoras (
            user_id, fecha, hora_inicio, colaborador, area,
            pendientes, necesita_apoyo, apoyo_detalle, prioridad_siguiente,
            tiempo_total_min, estado, created_at, updated_at
        ) VALUES (
            3, ?, '08:00', 'Juan Pérez García', 'Sistemas',
            'Revisión final de presupuesto de servidores en la nube', 'No', '',
            'Reunión ejecutiva con Gerencia General', 330, 'generada', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    ''', (today_str,))
    juan_b_id = cursor.lastrowid
    
    juan_tasks = [
        (0, '08:00', 60, 'Gestión y coordinación', 'Reunión diaria de sincronización (Daily Scrum) con equipo de TI y analistas.', 'Equipo TI', 'completada', recent_time),
        (1, '09:15', 120, 'Planificación', 'Planificación de sprints y asignación de requerimientos de nuevas bitácoras.', 'Marketing Alterno', 'completada', recent_time),
        (2, '11:30', 90, 'Revisión técnica', 'Revisión y auditoría de código del módulo de supervisión grupal.', 'Proyecto Bitácora', 'en_proceso', recent_time),
        (3, '14:30', 60, 'Soporte técnico', 'Acompañamiento en atención de ticket crítico de red.', 'Administración', 'pendiente', recent_time),
    ]
    for orden, h_ini, dur, tipo, desc, cli, est, up_time in juan_tasks:
        cursor.execute('''
            INSERT INTO actividades (bitacora_id, orden, hora_inicio, duracion_min, tipo_trabajo, descripcion, para_cliente, estado, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (juan_b_id, orden, h_ini, dur, tipo, desc, cli, est, up_time, up_time))
        
    # ==================== BITÁCORA 2: MARÍA LÓPEZ (Analista) ====================
    # Horas: 420 min (7.0h - Carga Óptima)
    # Incluye una tarea en 'en_revision' para que Juan la apruebe!
    cursor.execute('''
        INSERT INTO bitacoras (
            user_id, fecha, hora_inicio, colaborador, area,
            pendientes, necesita_apoyo, apoyo_detalle, prioridad_siguiente,
            tiempo_total_min, estado, created_at, updated_at
        ) VALUES (
            4, ?, '08:30', 'María López', 'Desarrollo',
            'Completar pruebas unitarias del módulo de reportes', 'No', '',
            'Despliegue a ambiente de staging', 420, 'generada', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    ''', (today_str,))
    maria_b_id = cursor.lastrowid
    
    maria_tasks = [
        (0, '08:30', 120, 'Desarrollo', 'Corrección de validación de formulario de clientes y actualización de estilos UI.', 'Cliente Corporativo A', 'completada', recent_time),
        (1, '10:45', 90, 'Optimización', 'Optimización de consultas SQL en módulo de bitácora y reducción de tiempo de carga.', 'Proyecto Interno', 'en_revision', recent_time),
        (2, '13:00', 150, 'Desarrollo', 'Implementación de componentes de diseño responsive para versión móvil.', 'AlphaStudio', 'en_proceso', recent_time),
        (3, '16:00', 60, 'Documentación', 'Elaboración de manual de usuario para el módulo de bitácoras diarias.', 'RR.HH.', 'pendiente', recent_time),
    ]
    for orden, h_ini, dur, tipo, desc, cli, est, up_time in maria_tasks:
        cursor.execute('''
            INSERT INTO actividades (bitacora_id, orden, hora_inicio, duracion_min, tipo_trabajo, descripcion, para_cliente, estado, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (maria_b_id, orden, h_ini, dur, tipo, desc, cli, est, up_time, up_time))

    # ==================== BITÁCORA 3: CARLOS MENDOZA (Analista) ====================
    # Horas: 330 min (5.5h) - Requiere apoyo del líder y tiene tarea estancada (+28h)!
    cursor.execute('''
        INSERT INTO bitacoras (
            user_id, fecha, hora_inicio, colaborador, area,
            pendientes, necesita_apoyo, apoyo_detalle, prioridad_siguiente,
            tiempo_total_min, estado, created_at, updated_at
        ) VALUES (
            5, ?, '08:15', 'Carlos Mendoza', 'Infraestructura',
            'Renovación de certificados en el servidor web secundario', 'Si',
            'Bloqueo con credenciales de acceso root al servidor de producción. Se requiere autorización del líder.',
            'Concluir migración de base de datos a nuevo clúster', 330, 'generada', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    ''', (today_str,))
    carlos_b_id = cursor.lastrowid
    
    carlos_tasks = [
        (0, '08:15', 90, 'Mantenimiento', 'Mantenimiento preventivo de servidores Linux y depuración de logs del sistema.', 'Infraestructura', 'completada', recent_time),
        # Tarea estancada: creada y actualizada hace 28 horas
        (1, '10:00', 150, 'Seguridad', 'Configuración de certificados SSL en balanceador de carga y hardening de puertos.', 'Servidores Prod', 'en_proceso', stalled_time),
        (2, '14:00', 90, 'Soporte técnico', 'Atención de tickets de incidencias de conectividad VPN de usuarios remotos.', 'Soporte General', 'pendiente', recent_time),
    ]
    for orden, h_ini, dur, tipo, desc, cli, est, up_time in carlos_tasks:
        cursor.execute('''
            INSERT INTO actividades (bitacora_id, orden, hora_inicio, duracion_min, tipo_trabajo, descripcion, para_cliente, estado, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (carlos_b_id, orden, h_ini, dur, tipo, desc, cli, est, up_time, up_time))

    # ==================== BITÁCORA 4: PEDRO GÓMEZ (Analista) ====================
    # Horas: 180 min (3.0h - Bajo registro / Alerta Amarilla de Carga)
    # Incluye tarea en revisión para aprobar y tarea continuada de ayer
    cursor.execute('''
        INSERT INTO bitacoras (
            user_id, fecha, hora_inicio, colaborador, area,
            pendientes, necesita_apoyo, apoyo_detalle, prioridad_siguiente,
            tiempo_total_min, estado, created_at, updated_at
        ) VALUES (
            6, ?, '09:00', 'Pedro Gómez', 'Sistemas',
            'Cierre de tickets de mesa de ayuda', 'No', '',
            'Revisión de integridad de respaldos automáticos', 180, 'generada', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    ''', (today_str,))
    pedro_b_id = cursor.lastrowid
    
    pedro_tasks = [
        (0, '09:00', 60, 'Documentación', 'Actualización de documentación técnica de APIs de integración REST.', 'Equipo Dev', 'completada', recent_time, None),
        (1, '10:30', 60, 'Soporte técnico', 'Atención a usuarios de gerencia comercial por acceso a dashboard.', 'Gerencia Comercial', 'en_revision', recent_time, None),
        # Tarea continuada de ayer con tiempo acumulado de 180m
        (2, '12:00', 60, 'Base de datos', 'Migración de esquema de base de datos MariaDB y pruebas de consistencia.', 'Sistemas Core', 'en_proceso', recent_time, 10),
    ]
    for orden, h_ini, dur, tipo, desc, cli, est, up_time, parent_id in pedro_tasks:
        cursor.execute('''
            INSERT INTO actividades (bitacora_id, orden, hora_inicio, duracion_min, tipo_trabajo, descripcion, para_cliente, estado, parent_task_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (pedro_b_id, orden, h_ini, dur, tipo, desc, cli, est, parent_id, up_time, up_time))

    conn.commit()
    conn.close()
    print("Datos de prueba para Líder y Analistas insertados exitosamente!")

if __name__ == '__main__':
    seed_team_and_activities()
