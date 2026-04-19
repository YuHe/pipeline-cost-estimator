"""Unit tests for security utilities (JWT, password hashing)."""

from app.core.security import (
    create_access_token,
    verify_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_and_verify(self):
        password = "my_secret_password"
        hashed = hash_password(password)
        assert hashed != password
        assert verify_password(password, hashed) is True

    def test_wrong_password(self):
        hashed = hash_password("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_different_hashes(self):
        """Same password produces different hashes (bcrypt salt)"""
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert h1 != h2  # different salts
        assert verify_password("same_password", h1) is True
        assert verify_password("same_password", h2) is True


class TestJWT:
    def test_create_and_verify(self):
        data = {"sub": "test@baidu.com"}
        token = create_access_token(data)
        assert isinstance(token, str)
        assert len(token) > 0

        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == "test@baidu.com"
        assert "exp" in payload

    def test_invalid_token(self):
        payload = verify_token("invalid.token.here")
        assert payload is None

    def test_empty_token(self):
        payload = verify_token("")
        assert payload is None

    def test_custom_data(self):
        data = {"sub": "admin@baidu.com", "role": "admin"}
        token = create_access_token(data)
        payload = verify_token(token)
        assert payload["sub"] == "admin@baidu.com"
        assert payload["role"] == "admin"
