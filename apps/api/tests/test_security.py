import pytest

from app.core import security
from app.core.errors import WeakPassword


def test_hash_and_verify():
    hashed = security.hash_password("Correct-horse-1")
    assert hashed != "Correct-horse-1"
    assert security.verify_password(hashed, "Correct-horse-1")
    assert not security.verify_password(hashed, "wrong")


def test_verify_garbage_hash_is_false_not_error():
    assert security.verify_password("not-a-hash", "whatever") is False


@pytest.mark.parametrize("bad", ["short1", "12345678", "aaaaaaaa", "x" * 129])
def test_weak_passwords_rejected(bad):
    with pytest.raises(WeakPassword):
        security.validate_password(bad)


@pytest.mark.parametrize("good", ["abcdefg1", "پسورد-قوی-۱۲۳", "ab" * 64])
def test_acceptable_passwords(good):
    security.validate_password(good)


def test_tokens_are_prefixed_unique_and_stored_hashed():
    raw1, hash1 = security.generate_token()
    raw2, _ = security.generate_token()
    assert raw1.startswith(security.TOKEN_PREFIX)
    assert raw1 != raw2
    assert hash1 == security.hash_token(raw1)
    assert raw1 not in hash1 and len(hash1) == 64
