from pydantic import BaseModel, Field

from app.db.models import Role


class CreateUserRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=1, max_length=32)
    email: str | None = Field(default=None, max_length=254)
    role: Role
    password: str = Field(min_length=1, max_length=128)


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=1, max_length=128)
