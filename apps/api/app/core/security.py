"""Password hashing, password policy and opaque session tokens."""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.errors import WeakPassword

# Argon2id with the OWASP-recommended minimum cost (19 MiB, 2 iterations, 1 lane):
# strong, and light enough for a small hosting plan.
_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
_dummy_hash: str | None = None

TOKEN_PREFIX = "esk_"  # makes leaked tokens easy to spot with secret scanners
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def burn_verification_time(password: str) -> None:
    """Spend the same time as a real check, so unknown phones are not detectable by timing."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = _hasher.hash("timing-equalisation-placeholder")
    verify_password(_dummy_hash, password)


def validate_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise WeakPassword(f"password must be at least {MIN_PASSWORD_LENGTH} characters")
    if len(password) > MAX_PASSWORD_LENGTH:
        raise WeakPassword(f"password must be at most {MAX_PASSWORD_LENGTH} characters")
    if password.isdigit():
        raise WeakPassword("password must not be only digits")
    if len(set(password)) == 1:
        raise WeakPassword("password is too simple")


def generate_token() -> tuple[str, str]:
    """Return (raw_token, token_hash). Only the hash is stored; the raw token is shown once."""
    raw = TOKEN_PREFIX + secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
