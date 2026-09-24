import sqlite3
import os
from werkzeug.security import generate_password_hash

DB_PATH = os.environ.get('DATABASE_PATH') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'bitacora.db'
)

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
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

    # 4.1. Crear índices de rendimiento para consultas concurrentes, búsqueda y rollover
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bitacoras_fecha ON bitacoras(fecha)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bitacoras_user ON bitacoras(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actividades_bitacora ON actividades(bitacora_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actividades_parent ON actividades(parent_task_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actividades_shared ON actividades(shared_uuid)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actividades_estado ON actividades(estado)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_actividades_deleted ON actividades(is_deleted, deleted_at)")

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

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Base de datos y usuarios/equipos inicializados correctamente en", DB_PATH)
