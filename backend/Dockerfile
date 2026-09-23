FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código del backend
COPY . .

ENV FLASK_ENV=production
ENV DATABASE_PATH=/data/bitacora.db
ENV UPLOAD_FOLDER=/data/uploads

EXPOSE 5000

CMD ["gunicorn", "--workers", "3", "--bind", "0.0.0.0:5000", "--timeout", "120", "app:app"]
