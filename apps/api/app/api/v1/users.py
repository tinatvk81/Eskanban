import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_tenant_db, require_manager
from app.schemas.auth import UserOut
from app.schemas.users import CreateUserRequest, ResetPasswordRequest
from app.services import agencies
from app.services import auth as auth_service
from app.services.auth import AuthContext

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    _: AuthContext = Depends(require_manager),
    db: Session = Depends(get_tenant_db),
) -> list[UserOut]:
    return [UserOut.model_validate(u) for u in agencies.list_users(db)]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    _: AuthContext = Depends(require_manager),
    db: Session = Depends(get_tenant_db),
) -> UserOut:
    user = agencies.add_user(
        db,
        phone=body.phone,
        full_name=body.full_name,
        role=body.role,
        password=body.password,
        email=body.email,
    )
    db.commit()
    return UserOut.model_validate(user)


@router.post("/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(
    user_id: uuid.UUID,
    _: AuthContext = Depends(require_manager),
    db: Session = Depends(get_tenant_db),
) -> UserOut:
    user = agencies.deactivate_user(db, user_id)
    db.commit()
    return UserOut.model_validate(user)


@router.post("/{user_id}/reset-password", response_model=UserOut)
def reset_password(
    user_id: uuid.UUID,
    body: ResetPasswordRequest,
    _: AuthContext = Depends(require_manager),
    db: Session = Depends(get_tenant_db),
) -> UserOut:
    user = auth_service.reset_password(db, user_id, new_password=body.new_password)
    db.commit()
    return UserOut.model_validate(user)
