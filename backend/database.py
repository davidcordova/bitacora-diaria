import sqlite3
import os
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash
from crypto_utils import encrypt_vault_secret

try:
    from zoneinfo import ZoneInfo
    PERU_TZ = ZoneInfo("America/Lima")
except Exception:
    PERU_TZ = None

def get_peru_now():
    if PERU_TZ:
        return datetime.now(PERU_TZ)
    from datetime import timezone
    return datetime.now(timezone(timedelta(hours=-5)))

def get_peru_now_str():
    return get_peru_now().strftime('%Y-%m-%d %H:%M:%S')

def get_peru_today_str():
    return get_peru_now().strftime('%Y-%m-%d')

DB_PATH = os.environ.get('DATABASE_PATH') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'bitacora.db'
)

try:
    from flask import g, has_app_context
except ImportError:
    has_app_context = None

def get_db():
    if has_app_context and has_app_context():
        if '_db_conn' not in g:
            conn = sqlite3.connect(DB_PATH, timeout=45.0)
            conn.row_factory = sqlite3.Row
            conn.create_function("peru_now", 0, get_peru_now_str)
            conn.create_function("peru_today", 0, get_peru_today_str)
            conn.execute("PRAGMA busy_timeout = 45000")
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA synchronous = NORMAL")
            g._db_conn = conn
            if '_open_conns' not in g:
                g._open_conns = []
            g._open_conns.append(conn)
        return g._db_conn

    conn = sqlite3.connect(DB_PATH, timeout=45.0)
    conn.row_factory = sqlite3.Row
    conn.create_function("peru_now", 0, get_peru_now_str)
    conn.create_function("peru_today", 0, get_peru_today_str)
    conn.execute("PRAGMA busy_timeout = 45000")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn

def init_db():
    # Asegurar modo WAL en el archivo de base de datos una sola vez
    try:
        w_conn = sqlite3.connect(DB_PATH, timeout=45.0)
        w_conn.execute("PRAGMA journal_mode = WAL")
        w_conn.execute("PRAGMA synchronous = NORMAL")
        w_conn.close()
    except Exception as e:
        print("[DB Init] Advertencia configurando WAL:", e)

    conn = get_db()
    cursor = conn.cursor()

    
    # 0. Crear tabla users si no existe
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT DEFAULT 'analista',
            phone TEXT,
            is_active INTEGER DEFAULT 1,
            team_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 1. Crear tabla teams si no existe
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            lider_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lider_id) REFERENCES users(id)
        )
    ''')

    # 2. Verificar/Crear columnas team_id y phone en users
    cursor.execute("PRAGMA table_info(users)")
    user_columns = [col[1] for col in cursor.fetchall()]
    if 'team_id' not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN team_id INTEGER REFERENCES teams(id)")
    if 'phone' not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN phone TEXT")
    if 'security_pin_hash' not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN security_pin_hash TEXT")

    # 3. Crear tabla de bitácoras si no existe
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bitacoras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            fecha TEXT NOT NULL,
            hora_inicio TEXT,
            colaborador TEXT NOT NULL,
            area TEXT NOT NULL,
            pendientes TEXT,
            necesita_apoyo TEXT DEFAULT 'No',
            apoyo_detalle TEXT,
            prioridad_siguiente TEXT,
            tiempo_total_min INTEGER DEFAULT 0,
            resumen_texto TEXT,
            estado TEXT DEFAULT 'generada',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # 4. Crear tabla de actividades vinculada a la bitácora
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS actividades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bitacora_id INTEGER,
            orden INTEGER DEFAULT 0,
            hora_inicio TEXT,
            duracion_min INTEGER DEFAULT 0,
            tipo_trabajo TEXT,
            descripcion TEXT NOT NULL,
            para_cliente TEXT,
            estado TEXT DEFAULT 'en_proceso',
            parent_task_id INTEGER,
            shared_with TEXT DEFAULT '[]',
            shared_uuid TEXT,
            shared_origin_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (bitacora_id) REFERENCES bitacoras(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_task_id) REFERENCES actividades(id)
        )
    ''')

    # Verificar columnas parent_task_id, updated_at, evidencias y shared en actividades si ya existía la tabla
    cursor.execute("PRAGMA table_info(actividades)")
    act_columns = [col[1] for col in cursor.fetchall()]
    if 'parent_task_id' not in act_columns:
        cursor.execute("ALTER TABLE actividades ADD COLUMN parent_task_id INTEGER REFERENCES actividades(id)")
    if 'updated_at' not in act_columns:
        cursor.execute("ALTER TABLE actividades ADD COLUMN updated_at DATETIME")
        cursor.execute("UPDATE actividades SET updated_at = created_at WHERE updated_at IS NULL")
    if 'evidencias' not in act_columns:
        cursor.execute("ALTER TABLE actividades ADD COLUMN evidencias TEXT DEFAULT '[]'")
    if 'shared_with' not in act_columns:
        cursor.execute("ALTER TABLE actividades ADD COLUMN shared_with TEXT DEFAULT '[]'")
    if 'shared_uuid' not in act_columns:
        cursor.execute("ALTER TABLE actividades ADD COLUMN shared_uuid TEXT")
    if 'shared_origin_id' not in act_columns:
        cursor.execute("ALTER TABLE actividades ADD COLUMN shared_origin_id INTEGER")
    if 'deleted_at' not in act_columns:
        cursor.execute("ALTER TABLE actividades ADD COLUMN deleted_at DATETIME")
    if 'is_deleted' not in act_columns:
        cursor.execute("ALTER TABLE actividades ADD COLUMN is_deleted INTEGER DEFAULT 0")
    if 'comentarios' not in act_columns:
        cursor.execute("ALTER TABLE actividades ADD COLUMN comentarios TEXT")
    if 'tipo_vinculo' not in act_columns:
        cursor.execute("ALTER TABLE actividades ADD COLUMN tipo_vinculo TEXT DEFAULT 'continuacion'")

    # 4.1. Crear índices de rendimiento para consultas concurrentes, búsqueda y rollover
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bitacoras_fecha ON bitacoras(fecha)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bitacoras_user ON bitacoras(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actividades_bitacora ON actividades(bitacora_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actividades_parent ON actividades(parent_task_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actividades_shared ON actividades(shared_uuid)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actividades_estado ON actividades(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actividades_deleted ON actividades(is_deleted, deleted_at)")

    # 4.2. Crear tabla buzon_sugerencias y buzon_votos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS buzon_sugerencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            colaborador TEXT,
            es_anonimo INTEGER DEFAULT 0,
            categoria TEXT DEFAULT 'sistema',
            titulo TEXT NOT NULL,
            descripcion TEXT NOT NULL,
            impacto TEXT DEFAULT 'medio',
            estado TEXT DEFAULT 'pendiente',
            respuesta_admin TEXT,
            respondido_por TEXT,
            respondido_at DATETIME,
            votos INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    ''')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_buzon_estado ON buzon_sugerencias(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_buzon_user ON buzon_sugerencias(user_id)")

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS buzon_votos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sugerencia_id INTEGER,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(sugerencia_id, user_id),
            FOREIGN KEY (sugerencia_id) REFERENCES buzon_sugerencias(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')

    # 5. Configurar el usuario admin obligatorio con contraseña M1un1c4cl4v3
    admin_hash = generate_password_hash('M1un1c4cl4v3')
    cursor.execute("SELECT id FROM users WHERE username = 'admin'")
    admin_row = cursor.fetchone()
    if admin_row:
        cursor.execute('''
            UPDATE users SET password_hash = ?, full_name = 'Administrador Principal', role = 'admin', is_active = 1, phone = COALESCE(phone, '51999888777')
            WHERE username = 'admin'
        ''', (admin_hash,))
    else:
        cursor.execute('''
            INSERT INTO users (username, email, password_hash, full_name, role, phone, is_active, created_at)
            VALUES ('admin', 'admin@marketingalterno.pe', ?, 'Administrador Principal', 'admin', '51999888777', 1, CURRENT_TIMESTAMP)
        ''', (admin_hash,))

    # 5.1 Auto-sincronizar consistencia de líderes y equipos
    cursor.execute('''
        UPDATE users SET team_id = (SELECT t.id FROM teams t WHERE t.lider_id = users.id LIMIT 1),
                         role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'lider' END
        WHERE id IN (SELECT lider_id FROM teams WHERE lider_id IS NOT NULL)
          AND (team_id IS NULL OR role NOT IN ('lider', 'admin'))
    ''')

    # 6. Crear tabla system_settings para configuraciones globales y branding
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    default_settings = [
        ('hora_inicio_default', '08:30'),
        ('system_title', 'Bitácora Diaria | Marketing Alterno Perú'),
        ('logo_url', ''),
        ('favicon_url', ''),
        ('login_bg_url', 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80'),
        ('login_bg_type', 'image'),
        ('login_heading', 'Bitacora Digital'),
        ('login_subheading', 'Marketing Alterno Perú'),
        ('system_mode', 'production'),
        ('show_demo_logins', 'false')
    ]
    for key, val in default_settings:
        cursor.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)", (key, val))

    # 6.1 Crear tabla notifications para sincronización de alertas del sistema
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'info',
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)")

    # 6.2 Crear tabla quick_links (Accesos Directos y Marcadores Rápidos)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quick_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            titulo TEXT NOT NULL,
            url TEXT NOT NULL,
            categoria TEXT DEFAULT 'General',
            descripcion TEXT,
            icono TEXT DEFAULT 'Link',
            color TEXT DEFAULT '#00F0FF',
            usuario TEXT,
            password TEXT,
            visibilidad TEXT CHECK(visibilidad IN ('personal', 'equipo', 'global')) DEFAULT 'personal',
            team_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
        )
    ''')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_quicklinks_user ON quick_links(user_id, visibilidad)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_quicklinks_team ON quick_links(team_id)")

    # 6.3 Bóveda IT: Empresas y Marcas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS it_empresas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            color TEXT DEFAULT '#3B82F6',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS it_marcas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES it_empresas(id) ON DELETE CASCADE,
            UNIQUE(empresa_id, nombre)
        )
    ''')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_it_marcas_empresa ON it_marcas(empresa_id)")

    # 6.4 Bóveda IT: Credenciales Corporativas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS it_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            marca_id INTEGER,
            plataforma TEXT NOT NULL,
            tipo_servicio TEXT NOT NULL DEFAULT 'General',
            url_acceso TEXT,
            usuario_login TEXT NOT NULL,
            password_secret TEXT NOT NULL,
            notas TEXT,
            tipo_cuenta TEXT DEFAULT 'operativa',
            is_active INTEGER DEFAULT 1,
            created_by INTEGER NOT NULL,
            updated_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES it_empresas(id) ON DELETE RESTRICT,
            FOREIGN KEY (marca_id) REFERENCES it_marcas(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
    ''')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_it_credentials_empresa ON it_credentials(empresa_id, marca_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_it_credentials_plataforma ON it_credentials(plataforma)")

    # 6.5 Bóveda IT: Permisos Granulares por Usuario
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS it_credential_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            credential_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            can_view INTEGER NOT NULL DEFAULT 1,
            can_edit INTEGER NOT NULL DEFAULT 0,
            assigned_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (credential_id) REFERENCES it_credentials(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT,
            UNIQUE(credential_id, user_id)
        )
    ''')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_it_perm_user ON it_credential_permissions(user_id, credential_id)")

    # 6.6 Bóveda IT: Log de Auditoría
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS it_credential_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            credential_id INTEGER,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            ip_or_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (credential_id) REFERENCES it_credentials(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_it_audit_cred ON it_credential_audit(credential_id, created_at)")

    # 6.7 Datos Iniciales de Prueba para Empresas, Marcas y Credenciales IT
    cursor.execute("SELECT COUNT(*) FROM it_empresas")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO it_empresas (nombre, color) VALUES ('Marketing Alterno Perú', '#00F0FF')")
        emp1_id = cursor.lastrowid
        cursor.execute("INSERT INTO it_empresas (nombre, color) VALUES ('Inversiones & Retail Group', '#A855F7')")
        emp2_id = cursor.lastrowid

        # Marcas
        cursor.execute("INSERT INTO it_marcas (empresa_id, nombre) VALUES (?, 'Sede Central')", (emp1_id,))
        m1_id = cursor.lastrowid
        cursor.execute("INSERT INTO it_marcas (empresa_id, nombre) VALUES (?, 'Alterno Digital')", (emp1_id,))
        m2_id = cursor.lastrowid
        cursor.execute("INSERT INTO it_marcas (empresa_id, nombre) VALUES (?, 'Retail Direct')", (emp2_id,))
        m3_id = cursor.lastrowid

        # Admin user id
        cursor.execute("SELECT id FROM users WHERE username = 'admin'")
        admin_u = cursor.fetchone()
        admin_uid = admin_u[0] if admin_u else 1

        # Credenciales de ejemplo IT
        initial_creds = [
            (emp1_id, m1_id, 'Zimbra Mail', 'Correo Corporativo', 'https://mail.marketingalterno.pe', 'admin@marketingalterno.pe', 'Z1mbr4#Mkt2026!', 'Panel de administración Zimbra 9 Network Edition', 'admin', admin_uid),
            (emp1_id, m2_id, 'Odoo ERP', 'ERP / Finanzas', 'https://odoo.marketingalterno.pe', 'soporte.sistemas', '0d00_P3ru#4829', 'Base de datos principal de producción v16', 'operativa', admin_uid),
            (emp1_id, m1_id, 'Synology NAS IT', 'Storage / Servidor', 'https://nas.marketingalterno.pe:5001', 'root_nas', 'N@s_B4ckup#992', 'Almacenamiento de backups y repositorios de diseño', 'master', admin_uid),
            (emp1_id, m1_id, 'Office 365 Admin', 'Cloud / Correo', 'https://admin.microsoft.com', 'itadmin@marketingalterno.pe', 'M365#AdminSec_26', 'Portal Tenant M365 Business Standard', 'admin', admin_uid),
            (emp2_id, m3_id, 'Zoom Enterprise', 'Comunicaciones', 'https://zoom.us/signin', 'comunicaciones@retailgroup.pe', 'Z00m#Corp_4411', 'Licencia Business para reuniones corporativas', 'operativa', admin_uid),
        ]
        for c in initial_creds:
            cursor.execute('''
                INSERT INTO it_credentials 
                (empresa_id, marca_id, plataforma, tipo_servicio, url_acceso, usuario_login, password_secret, notas, tipo_cuenta, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', c)
            new_cred_id = cursor.lastrowid
            # Permiso automático completo para el admin
            cursor.execute('''
                INSERT INTO it_credential_permissions (credential_id, user_id, can_view, can_edit, assigned_by)
                VALUES (?, ?, 1, 1, ?)
            ''', (new_cred_id, admin_uid, admin_uid))

        # Accesos directos de ejemplo
        cursor.execute("SELECT COUNT(*) FROM quick_links")
        if cursor.fetchone()[0] == 0:
            cursor.execute('''
                INSERT INTO quick_links (user_id, titulo, url, categoria, descripcion, icono, color, visibilidad)
                VALUES (?, 'Google Workspace', 'https://workspace.google.com', 'Herramientas', 'Suite de productividad y correo corporativo', 'Mail', '#00F0FF', 'global')
            ''', (admin_uid,))
            cursor.execute('''
                INSERT INTO quick_links (user_id, titulo, url, categoria, descripcion, icono, color, visibilidad)
                VALUES (?, 'Portal Zimbra Webmail', 'https://mail.marketingalterno.pe', 'Comunicaciones', 'Acceso directo al correo corporativo Zimbra', 'Mail', '#3B82F6', 'global')
            ''', (admin_uid,))
            cursor.execute('''
                INSERT INTO quick_links (user_id, titulo, url, categoria, descripcion, icono, color, visibilidad)
                VALUES (?, 'Panel de Servidores AWS', 'https://aws.amazon.com/console', 'Sistemas', 'Consola de nube AWS para gestión de instancias', 'Server', '#F59E0B', 'equipo')
            ''', (admin_uid,))

    # 6.8 Bóveda IT: Directorio de Cuentas de Usuarios por Plataforma (Soporte y Reseteo)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS it_platform_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            marca_id INTEGER,
            plataforma TEXT NOT NULL,
            colaborador_nombre TEXT NOT NULL,
            colaborador_cargo TEXT,
            colaborador_email TEXT,
            colaborador_telefono TEXT,
            usuario_login TEXT NOT NULL,
            password_actual TEXT NOT NULL,
            password_anterior TEXT,
            estado TEXT CHECK(estado IN ('activo', 'suspendido', 'por_crear', 'baja')) DEFAULT 'activo',
            ultimo_reseteo DATETIME DEFAULT CURRENT_TIMESTAMP,
            notas TEXT,
            created_by INTEGER NOT NULL,
            updated_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES it_empresas(id) ON DELETE RESTRICT,
            FOREIGN KEY (marca_id) REFERENCES it_marcas(id) ON DELETE SET NULL,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )
    ''')
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_platform_users_emp_plat ON it_platform_users(empresa_id, plataforma)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_platform_users_colab ON it_platform_users(colaborador_nombre)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_platform_users_login ON it_platform_users(usuario_login)")

    # 6.9 Datos Semilla para Cuentas de Usuarios por Plataforma
    cursor.execute("SELECT COUNT(*) FROM it_platform_users")
    if cursor.fetchone()[0] == 0:
        cursor.execute("SELECT id FROM it_empresas ORDER BY id ASC LIMIT 2")
        emp_rows = cursor.fetchall()
        e1_id = emp_rows[0][0] if len(emp_rows) > 0 else 1
        e2_id = emp_rows[1][0] if len(emp_rows) > 1 else e1_id

        cursor.execute("SELECT id FROM users WHERE username = 'admin'")
        admin_u = cursor.fetchone()
        admin_uid = admin_u[0] if admin_u else 1

        sample_platform_users = [
            (e1_id, None, 'Zimbra Mail', 'Carlos Mendoza Vargas', 'Jefe de Marketing Digital', 'carlos.mendoza@marketingalterno.pe', '51987654321', 'carlos.mendoza', 'Z1mb#Car_2026', 'activo', 'Cuenta principal de correo corporativo'),
            (e1_id, None, 'Zimbra Mail', 'Lucía Torres Paredes', 'Diseñadora Gráfica Sr.', 'lucia.torres@marketingalterno.pe', '51981234567', 'lucia.torres', 'LuT0rr3s#9941', 'activo', 'Acceso webmail y Thunderbird'),
            (e1_id, None, 'Zimbra Mail', 'Diego Rivas Chávez', 'Analista de Contenidos', 'diego.rivas@marketingalterno.pe', '51976543210', 'diego.rivas', 'R1v4s#Zmb_882', 'activo', 'Cliente suele pedir cambio de clave por olvido'),
            (e1_id, None, 'Odoo ERP', 'Mariana Quispe Benítez', 'Contadora General', 'mariana.quispe@marketingalterno.pe', '51998877665', 'mariana.odoo', '0d00#MarQuis_26', 'activo', 'Permisos de Facturación y Contabilidad'),
            (e1_id, None, 'Odoo ERP', 'Jorge Herrera Silva', 'Coordinador de Operaciones', 'jorge.herrera@marketingalterno.pe', '51994433221', 'jorge.herrera', 'H3rr3r4#Od_551', 'activo', 'Módulo de Compras e Inventario'),
            (e1_id, None, 'Office 365', 'Ana Sofía Morales', 'Directora de Cuentas', 'ana.morales@marketingalterno.pe', '51991122334', 'ana.morales@marketingalterno.pe', 'M365#AnaM_2026', 'activo', 'Licencia M365 Business Standard'),
            (e1_id, None, 'Office 365', 'Rodrigo Gómez Flores', 'Ejecutivo Comercial', 'rodrigo.gomez@marketingalterno.pe', '51995566778', 'rodrigo.gomez@marketingalterno.pe', 'G0m3z#Off365_!', 'activo', 'Usa Teams y Excel en la nube'),
            (e1_id, None, 'Synology NAS IT', 'Álvaro Castillo Wong', 'Audiovisual & Motion Designer', 'alvaro.castillo@marketingalterno.pe', '51993322110', 'alvaro.nas', 'N@s_AlvCast#44', 'activo', 'Carpeta compartida /Marketing/Videos4K'),
            (e1_id, None, 'Zoom Enterprise', 'Valeria Paz Soldán', 'Gestora de Clientes VIP', 'valeria.paz@marketingalterno.pe', '51997788990', 'valeria.paz@marketingalterno.pe', 'Z00m#ValPaz_77', 'activo', 'Capacidad 300 participantes'),
            (e2_id, None, 'Zimbra Mail', 'Fernando Cáceres Luna', 'Gerente Comercial Retail', 'fernando.caceres@retailgroup.pe', '51992233445', 'fernando.caceres', 'R3t4il#FerC_26', 'activo', 'Empresa Retail Group'),
            (e2_id, None, 'Odoo ERP', 'Patricia Ramos Vega', 'Analista de Logística', 'patricia.ramos@retailgroup.pe', '51996655443', 'patricia.ramos', '0d00_P4tRam#12', 'activo', 'Módulo Almacén Central'),
            (e1_id, None, 'Zimbra Mail', 'Nuevo Colaborador TI', 'Practicante de Sistemas', 'practicante.ti@marketingalterno.pe', '51990011223', 'practicante.ti', 'T1_Pr4ct#2026!', 'por_crear', 'Clave generada previamente para dar de alta en Zimbra mañana')
        ]

        for u in sample_platform_users:
            cursor.execute('''
                INSERT INTO it_platform_users 
                (empresa_id, marca_id, plataforma, colaborador_nombre, colaborador_cargo, colaborador_email, colaborador_telefono, usuario_login, password_actual, estado, notas, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (u[0], u[1], u[2], u[3], u[4], u[5], u[6], u[7], u[8], u[9], u[10], admin_uid))

    # 6.10 Bóveda IT: Catálogo Maestro de Plataformas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS it_plataformas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            tipo_servicio TEXT DEFAULT 'General',
            color TEXT DEFAULT '#00F0FF',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute("SELECT COUNT(*) FROM it_plataformas")
    if cursor.fetchone()[0] == 0:
        default_platforms = [
            ('Zimbra Mail', 'Correo Corporativo', '#00F0FF'),
            ('Odoo ERP', 'ERP / Finanzas', '#A855F7'),
            ('Office 365', 'Cloud / Tenant', '#3B82F6'),
            ('Synology NAS IT', 'Storage / Servidor', '#10B981'),
            ('Zoom Enterprise', 'Comunicaciones', '#2563EB'),
            ('Active Directory', 'Infraestructura TI', '#F59E0B'),
            ('VPN Corporativa', 'Seguridad & Redes', '#EC4899'),
            ('cPanel / Web Hosting', 'Servicios Web', '#8B5CF6'),
            ('Google Workspace', 'Cloud / Correo', '#EF4444'),
            ('GitLab / Repositorios', 'Desarrollo TI', '#F97316'),
        ]
        for p in default_platforms:
            cursor.execute("INSERT OR IGNORE INTO it_plataformas (nombre, tipo_servicio, color) VALUES (?, ?, ?)", p)

    # 6.11 Bóveda IT: Catálogo Maestro de Cargos / Áreas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS it_cargos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            area TEXT DEFAULT 'General',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute("SELECT COUNT(*) FROM it_cargos")
    if cursor.fetchone()[0] == 0:
        default_cargos = [
            ('Jefe de Marketing Digital', 'Marketing'),
            ('Diseñador Gráfico Sr.', 'Diseño'),
            ('Analista de Contenidos', 'Marketing'),
            ('Contador General', 'Finanzas'),
            ('Coordinador de Operaciones', 'Operaciones'),
            ('Director de Cuentas', 'Comercial'),
            ('Ejecutivo Comercial', 'Comercial'),
            ('Audiovisual & Motion Designer', 'Diseño'),
            ('Gestor de Clientes VIP', 'Comercial'),
            ('Gerente Comercial Retail', 'Comercial'),
            ('Analista de Logística', 'Operaciones'),
            ('Analista de Sistemas', 'Sistemas'),
            ('Soporte Técnico TI', 'Sistemas'),
            ('Practicante de Sistemas', 'Sistemas'),
        ]
        for c in default_cargos:
            cursor.execute("INSERT OR IGNORE INTO it_cargos (nombre, area) VALUES (?, ?)", c)

    # 7. Limpieza de actividades duplicadas en papelera generadas accidentalmente por ediciones previas
    cursor.execute('''
        UPDATE actividades SET parent_task_id = NULL
        WHERE parent_task_id IN (
            SELECT a_del.id
            FROM actividades a_del
            JOIN actividades a_act ON a_del.bitacora_id = a_act.bitacora_id 
                AND TRIM(LOWER(a_del.descripcion)) = TRIM(LOWER(a_act.descripcion))
                AND (a_act.is_deleted IS NULL OR a_act.is_deleted = 0)
            WHERE a_del.is_deleted = 1
        )
    ''')
    cursor.execute('''
        DELETE FROM actividades 
        WHERE is_deleted = 1 
          AND id IN (
              SELECT a_del.id
              FROM actividades a_del
              JOIN actividades a_act ON a_del.bitacora_id = a_act.bitacora_id 
                  AND TRIM(LOWER(a_del.descripcion)) = TRIM(LOWER(a_act.descripcion))
                  AND (a_act.is_deleted IS NULL OR a_act.is_deleted = 0)
              WHERE a_del.is_deleted = 1
          )
    ''')

    # 7.1 Limpieza de referencias huérfanas de parent_task_id que apuntan a actividades inexistentes
    cursor.execute('''
        UPDATE actividades 
        SET parent_task_id = NULL 
        WHERE parent_task_id IS NOT NULL 
          AND parent_task_id NOT IN (SELECT id FROM actividades)
    ''')

    # 7.2 Corrección y sincronización automática de tiempo_total_min en bitácoras
    cursor.execute('''
        UPDATE bitacoras SET tiempo_total_min = (
            SELECT COALESCE(SUM(duracion_min), 0)
            FROM actividades
            WHERE bitacora_id = bitacoras.id AND (is_deleted IS NULL OR is_deleted = 0)
        )
    ''')

    # 7.3 Cifrado en reposo (AES Fernet) para todas las contraseñas de la bóveda
    try:
        cursor.execute("SELECT id, password_secret FROM it_credentials")
        for row in cursor.fetchall():
            cid, psec = row[0], row[1]
            if psec and not psec.startswith("enc::"):
                cursor.execute("UPDATE it_credentials SET password_secret = ? WHERE id = ?", (encrypt_vault_secret(psec), cid))

        cursor.execute("SELECT id, password_actual FROM it_platform_users")
        for row in cursor.fetchall():
            pid, pact = row[0], row[1]
            if pact and not pact.startswith("enc::"):
                cursor.execute("UPDATE it_platform_users SET password_actual = ? WHERE id = ?", (encrypt_vault_secret(pact), pid))

        cursor.execute("SELECT id, password FROM quick_links")
        for row in cursor.fetchall():
            lid, lpass = row[0], row[1]
            if lpass and not lpass.startswith("enc::"):
                cursor.execute("UPDATE quick_links SET password = ? WHERE id = ?", (encrypt_vault_secret(lpass), lid))
    except Exception as e:
        print(f"[Crypto] Error en migración de contraseñas: {e}")

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Base de datos y usuarios/equipos inicializados correctamente en", DB_PATH)
