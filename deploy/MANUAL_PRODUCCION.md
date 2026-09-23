# 🚀 Manual de Puesta en Producción: Sistema de Bitácora Diaria

Este manual detalla paso a paso cómo desplegar la plataforma en un entorno de producción seguro, escalable y de alto rendimiento.

---

## 🏗️ 1. Arquitectura del Sistema en Producción

```
                      INTERNET / USUARIOS
                               │
                       [ HTTPS (Puerto 443) ]
                               │
                       ▼───────┴───────▼
                       │  NGINX PROXY  │
                       ▲───────┬───────▲
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       [ Peticiones Web ]              [ Peticiones API ]
               │                               │
         (Ruta: /)                     (Ruta: /api/*)
               │                               │
       Archivos Estáticos              Gunicorn WSGI Server
        React + Vite SPA                Python Flask (API)
      (frontend/dist/)                 (127.0.0.1:5000)
                                               │
                                       Base de Datos SQLite
                                         (bitacora.db)
```

---

## 📦 Método A: Despliegue en Servidor Linux VPS (Ubuntu / Debian / AWS / DigitalOcean)
*(Método Estándar y Recomendado)*

### Paso 1: Actualizar el Sistema e Instalar Paquetes Base
Conéctate por SSH a tu servidor y ejecuta:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-pip python3-venv nginx git curl ufw
```

Instalar Node.js 20 LTS:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

### Paso 2: Clonar o Copiar el Proyecto
Ubica el proyecto en `/var/www/bitacora`:

```bash
sudo mkdir -p /var/www/bitacora
sudo chown -R $USER:$USER /var/www/bitacora
cd /var/www/bitacora

# Clona tu repositorio o copia tus archivos
git clone <URL_DE_TU_REPOSITORIO> .
```

---

### Paso 3: Configurar el Backend (Python + Flask + Gunicorn)

1. Crear y activar el entorno virtual de Python:
```bash
cd /var/www/bitacora/backend
python3 -m venv venv
source venv/bin/activate
```

2. Instalar las dependencias de producción:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

3. Inicializar la base de datos y datos maestros:
```bash
python3 -c "from database import init_db; init_db()"
python3 seed_data.py
```

4. Probar que Gunicorn arranca correctamente:
```bash
gunicorn --workers 3 --bind 127.0.0.1:5000 app:app
# Pulsa CTRL+C para detener la prueba
deactivate
```

---

### Paso 4: Crear el Servicio en Segundo Plano (Systemd)

Para que el backend se ejecute como un servicio del sistema, arranque automáticamente con el servidor y se reinicie ante cualquier fallo:

1. Copiar el archivo de servicio a Systemd:
```bash
sudo cp /var/www/bitacora/deploy/bitacora-backend.service /etc/systemd/system/bitacora-backend.service
```

2. Asignar permisos correctos a la base de datos para el usuario del servidor web (`www-data`):
```bash
sudo chown -R www-data:www-data /var/www/bitacora/bitacora.db
sudo chown -R www-data:www-data /var/www/bitacora/backend
```

3. Iniciar y habilitar el servicio:
```bash
sudo systemctl daemon-reload
sudo systemctl start bitacora-backend
sudo systemctl enable bitacora-backend
```

4. Verificar el estado del servicio:
```bash
sudo systemctl status bitacora-backend
```

---

### Paso 5: Compilar el Frontend (React + Vite)

Compila el código de frontend para generar los archivos HTML, CSS y JS minificados de producción:

```bash
cd /var/www/bitacora/frontend
npm ci
npm run build
```
Esto creará la carpeta optimizada `/var/www/bitacora/frontend/dist`.

---

### Paso 6: Configurar el Servidor Web Nginx

1. Copiar la configuración de Nginx:
```bash
sudo cp /var/www/bitacora/deploy/nginx.conf /etc/nginx/sites-available/bitacora
```

2. Editar el dominio o IP pública:
```bash
sudo nano /etc/nginx/sites-available/bitacora
# Modifica la línea: server_name bitacora.tuempresa.com; con tu dominio real o IP
```

3. Habilitar el sitio y verificar la configuración:
```bash
sudo ln -s /etc/nginx/sites-available/bitacora /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

### Paso 7: Instalar Certificado SSL Gratuito (HTTPS con Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bitacora.tuempresa.com
```
*Certbot configurará automáticamente la renovación periódica y el cifrado HTTPS seguro.*

---

### Paso 8: Configurar Firewall (Seguridad)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 🐳 Método B: Despliegue con Docker & Docker Compose
*(Ideal para despliegue rápido y contenerizado)*

Si tu servidor dispone de Docker y Docker Compose:

1. Clonar el repositorio en el servidor:
```bash
git clone <URL_DE_TU_REPOSITORIO> bitacora
cd bitacora
```

2. Iniciar los contenedores:
```bash
docker compose up -d --build
```

3. Los contenedores quedarán corriendo:
- `bitacora_backend`: API en Python con auto-cierre programado.
- `bitacora_frontend`: Nginx sirviendo la SPA compilada y redirigiendo peticiones `/api/` en el puerto 80.
- Los datos de `bitacora.db` se persisten en el directorio `./data` del servidor anfitrión.

---

## 💾 3. Respaldos Automáticos de la Base de Datos

Para proteger los datos contra incidentes, configura un respaldo diario automático mediante `cron`:

1. Abrir el crontab del sistema:
```bash
sudo crontab -e
```

2. Agregar la siguiente línea (se ejecutará todos los días a la 01:00 AM):
```bash
0 1 * * * cp /var/www/bitacora/bitacora.db /var/backups/bitacora_$(date +\%Y\%m\%d).db
```

---

## 🔄 4. Procedimiento para Publicar Actualizaciones (Futuros Cambios)

Cada vez que realices mejoras en el código:

```bash
cd /var/www/bitacora

# 1. Bajar los cambios del repositorio
git pull origin main

# 2. Recompilar el frontend
cd frontend
npm ci
npm run build

# 3. Actualizar librerías de Python si hubo cambios y reiniciar el servicio
cd ../backend
source venv/bin/activate
pip install -r requirements.txt
deactivate
sudo systemctl restart bitacora-backend

# 4. Recargar Nginx
sudo systemctl reload nginx
```
