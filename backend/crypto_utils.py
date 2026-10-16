"""
Módulo de Seguridad Criptográfica para la Bóveda TI (Bitácora Diaria)
Utiliza Fernet (AES-128-CBC + HMAC-SHA256 authenticated encryption).
Garantiza cifrado en reposo para todas las contraseñas y secretos del sistema.
Si la dependencia 'cryptography' falta, el servidor arranca pero rechaza guardar secretos nuevos.
"""

import os
import base64
import logging
import secrets
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
LEGACY_KEY_FILE = BASE_DIR / ".vault_key"
# La llave DEBE vivir en el volumen persistente (junto a la base de datos). Si vive dentro del
# contenedor (/app), cada redeploy genera una llave nueva y todos los secretos quedan ilegibles.
_DB_PATH = os.environ.get('DATABASE_PATH')
KEY_FILE = (Path(_DB_PATH).resolve().parent / ".vault_key") if _DB_PATH else LEGACY_KEY_FILE

logger = logging.getLogger('bitacora.crypto')

try:
    from cryptography.fernet import Fernet, InvalidToken
    _HAS_FERNET = True
except ImportError:
    _HAS_FERNET = False
    Fernet = None
    InvalidToken = Exception
    logger.error("La biblioteca 'cryptography' no está instalada: no se podrán guardar secretos en la bóveda. "
                 "Instálala (requirements.txt) para habilitar Fernet (AES-128-CBC + HMAC-SHA256).")


def _read_key(path: Path):
    try:
        with open(path, "rb") as f:
            key = f.read().strip()
        return key if key and len(key) >= 32 else None
    except FileNotFoundError:
        return None
    except Exception:
        return None


def get_or_create_vault_key() -> bytes:
    """Obtiene la clave maestra de la bóveda desde variable de entorno o archivo persistente."""
    env_key = os.environ.get("BITACORA_VAULT_KEY")
    if env_key:
        return env_key.encode('utf-8') if isinstance(env_key, str) else env_key

    key = _read_key(KEY_FILE)
    if key:
        return key

    # Migrar una llave previa (ubicación antigua) si existe, para no perder secretos ya cifrados
    candidate = _read_key(LEGACY_KEY_FILE) if KEY_FILE != LEGACY_KEY_FILE else None
    if not candidate:
        candidate = Fernet.generate_key() if (_HAS_FERNET and Fernet) else base64.urlsafe_b64encode(secrets.token_bytes(32))

    # Creación atómica: si varios workers arrancan a la vez, todos terminan usando la misma llave
    try:
        KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(KEY_FILE), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "wb") as f:
            f.write(candidate)
        return candidate
    except FileExistsError:
        for _ in range(50):
            key = _read_key(KEY_FILE)
            if key:
                return key
            time.sleep(0.05)
    except Exception as e:
        logger.error("[Crypto] No se pudo guardar la llave de la bóveda en %s: %s", KEY_FILE, e)
    return candidate


_vault_key = get_or_create_vault_key()
_cipher_suite = Fernet(_vault_key) if _HAS_FERNET and Fernet else None


def encrypt_vault_secret(secret_text: str) -> str:
    """
    Cifra un texto plano con Fernet (AES-128-CBC + HMAC-SHA256).
    Retorna el token codificado con prefijo 'enc::' para identificación explícita.
    """
    if not secret_text:
        return ""
    # Si ya está cifrado con prefijo, no volver a cifrar
    if secret_text.startswith("enc::"):
        return secret_text
    
    if _cipher_suite is not None:
        token = _cipher_suite.encrypt(secret_text.encode('utf-8')).decode('utf-8')
        return f"enc::{token}"
    # Sin Fernet no se guarda nada: una ofuscación débil daría una falsa sensación de seguridad.
    # (Los valores "enc::fallback::" antiguos se siguen pudiendo leer en decrypt_vault_secret.)
    raise RuntimeError("Cifrado no disponible: instala la dependencia 'cryptography'")


def decrypt_vault_secret(stored_val: str) -> str:
    """
    Descifra un secreto almacenado.
    Si el valor no estaba cifrado (datos legados), retorna el texto tal cual sin romper el flujo.
    """
    if not stored_val:
        return ""
    
    if stored_val.startswith("enc::fallback::"):
        token = stored_val[15:]
        try:
            xored = base64.urlsafe_b64decode(token.encode('utf-8'))
            key_bytes = _vault_key
            text_bytes = bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(xored))
            return text_bytes.decode('utf-8')
        except Exception:
            return stored_val

    if stored_val.startswith("enc::"):
        token = stored_val[5:]
    else:
        token = stored_val

    if _cipher_suite is not None:
        try:
            decrypted = _cipher_suite.decrypt(token.encode('utf-8')).decode('utf-8')
            return decrypted
        except (InvalidToken, Exception):
            return stored_val
    else:
        # Sin Fernet en este host, retornar valor tal cual sin romper
        return stored_val


def is_encrypted(val: str) -> bool:
    """Indica si una cadena ya tiene formato cifrado."""
    return bool(val and (val.startswith("enc::") or val.startswith("enc::fallback::")))
