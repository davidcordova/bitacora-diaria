"""
Módulo de Seguridad Criptográfica para la Bóveda TI (Bitácora Diaria)
Utiliza Fernet (AES-128-CBC + HMAC-SHA256 authenticated encryption).
Garantiza cifrado en reposo para todas las contraseñas y secretos del sistema.
"""

import os
import base64
from pathlib import Path
from cryptography.fernet import Fernet, InvalidToken

BASE_DIR = Path(__file__).resolve().parent
KEY_FILE = BASE_DIR / ".vault_key"

def get_or_create_vault_key() -> bytes:
    """Obtiene la clave maestra de la bóveda desde variable de entorno o archivo local seguro."""
    env_key = os.environ.get("BITACORA_VAULT_KEY")
    if env_key:
        try:
            return env_key.encode('utf-8') if isinstance(env_key, str) else env_key
        except Exception:
            pass

    if KEY_FILE.exists():
        try:
            with open(KEY_FILE, "rb") as f:
                key = f.read().strip()
                if key and len(key) >= 32:
                    return key
        except Exception:
            pass

    # Generar nueva clave aleatoria de 256 bits y guardarla
    new_key = Fernet.generate_key()
    try:
        with open(KEY_FILE, "wb") as f:
            f.write(new_key)
    except Exception as e:
        print(f"[Crypto] Advertencia: No se pudo guardar .vault_key en disco: {e}")
    return new_key

_cipher_suite = Fernet(get_or_create_vault_key())

def encrypt_vault_secret(secret_text: str) -> str:
    """
    Cifra un texto plano usando AES-Fernet.
    Retorna el token codificado con prefijo 'enc::' para identificación explícita.
    """
    if not secret_text:
        return ""
    # Si ya está cifrado con prefijo, no volver a cifrar
    if secret_text.startswith("enc::"):
        return secret_text
    
    token = _cipher_suite.encrypt(secret_text.encode('utf-8')).decode('utf-8')
    return f"enc::{token}"

def decrypt_vault_secret(stored_val: str) -> str:
    """
    Descifra un secreto almacenado.
    Si el valor no estaba cifrado (datos legados), retorna el texto tal cual sin romper el flujo.
    """
    if not stored_val:
        return ""
    
    if stored_val.startswith("enc::"):
        token = stored_val[5:]
    else:
        # Podría ser un token Fernet crudo o texto plano legado
        token = stored_val

    try:
        decrypted = _cipher_suite.decrypt(token.encode('utf-8')).decode('utf-8')
        return decrypted
    except (InvalidToken, Exception):
        # Si falla el descifrado, significa que era texto plano anterior a la implementación del cifrado
        return stored_val

def is_encrypted(val: str) -> bool:
    """Indica si una cadena ya tiene formato cifrado."""
    return bool(val and val.startswith("enc::"))
