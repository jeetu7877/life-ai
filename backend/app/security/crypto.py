import re
from cryptography.fernet import Fernet
from app.config import settings

# Initialize cipher suite with configured key or safe fallback
try:
    fernet_cipher = Fernet(settings.ENCRYPTION_KEY.encode())
except Exception:
    import base64
    import hashlib
    # Deterministically derive 32 urlsafe base64 bytes from any key string
    fallback_key = base64.urlsafe_b64encode(hashlib.sha256(str(settings.ENCRYPTION_KEY).encode()).digest())
    fernet_cipher = Fernet(fallback_key)

def encrypt_value(plain_text: str) -> str:
    """Encrypt a sensitive plain text string using Fernet (AES-128-CBC + HMAC)."""
    if not plain_text:
        return ""
    encrypted_bytes = fernet_cipher.encrypt(plain_text.encode("utf-8"))
    return encrypted_bytes.decode("utf-8")

def decrypt_value(cipher_text: str) -> str:
    """Decrypt a Fernet cipher text back to plain text."""
    if not cipher_text:
        return ""
    decrypted_bytes = fernet_cipher.decrypt(cipher_text.encode("utf-8"))
    return decrypted_bytes.decode("utf-8")

def generate_masked_hint(item_type: str, raw_value: str) -> str:
    """Generate safe masked string for display without exposing full secrets."""
    clean_val = raw_value.strip().replace(" ", "").replace("-", "")
    item_type = item_type.lower()
    
    if item_type == "pan" and len(clean_val) == 10:
        return f"{clean_val[:5]}****{clean_val[-1]}"
    elif item_type == "aadhaar" and len(clean_val) == 12:
        return f"XXXX-XXXX-{clean_val[-4:]}"
    elif item_type == "passport" and len(clean_val) >= 8:
        return f"{clean_val[:2]}****{clean_val[-2:]}"
    elif len(clean_val) > 4:
        return f"{'*' * (len(clean_val) - 4)}{clean_val[-4:]}"
    return "****"

# Patterns for sensitive identifier redaction in logs/prompts
PAN_PATTERN = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b')
AADHAAR_PATTERN = re.compile(r'\b[2-9]{1}[0-9]{3}[ \-]?[0-9]{4}[ \-]?[0-9]{4}\b')

def redact_sensitive_strings(text: str) -> str:
    """Sanitize strings so sensitive numbers are never casually stored in logs or raw embeddings."""
    if not text:
        return ""
    sanitized = PAN_PATTERN.sub("[REDACTED_PAN]", text)
    sanitized = AADHAAR_PATTERN.sub("[REDACTED_AADHAAR]", sanitized)
    return sanitized
