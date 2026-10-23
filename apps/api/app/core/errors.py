class DomainError(Exception):
    """Expected business-rule failure. ``code`` is a stable machine-readable identifier."""

    code = "domain_error"


class InvalidInput(DomainError):
    code = "invalid_input"


class SlugTaken(DomainError):
    code = "slug_taken"


class EmailTaken(DomainError):
    code = "email_taken"


class PhoneTaken(DomainError):
    code = "phone_taken"


class SeatLimitReached(DomainError):
    code = "seat_limit_reached"


class LastManager(DomainError):
    """An agency must always keep at least one active manager."""

    code = "last_manager"


class UserNotFound(DomainError):
    code = "user_not_found"


class ScopeRequired(DomainError):
    """The operation needs a different session scope (system vs tenant)."""

    code = "scope_required"


class InvalidCredentials(DomainError):
    """Wrong phone/password, unknown user, or inactive account. Deliberately indistinguishable."""

    code = "invalid_credentials"


class AccountLocked(DomainError):
    code = "account_locked"

    def __init__(self, message: str, retry_after_seconds: int) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


class WrongPassword(DomainError):
    """The current password given while changing a password is wrong."""

    code = "wrong_password"


class WeakPassword(InvalidInput):
    code = "weak_password"


class NotAuthenticated(DomainError):
    code = "not_authenticated"


class Forbidden(DomainError):
    code = "forbidden"


class PropertyNotFound(DomainError):
    """Unknown, other agency, soft-deleted or not visible to this user: deliberately the same."""

    code = "property_not_found"


class VersionConflict(DomainError):
    """The file was changed by someone else since the client read it."""

    code = "version_conflict"


class CityNotFound(InvalidInput):
    code = "city_not_found"


class PasswordChangeRequired(Forbidden):
    """The user still has a temporary password and must change it before using the app."""

    code = "password_change_required"
