from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.deps import (
    get_auth_context,
    get_credentials,
    get_system_db,
    get_tenant_db,
)
from app.db.models import Agency, User
from app.schemas.auth import (
    AgencyOut,
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    MeResponse,
    UserOut,
)
from app.services import auth as auth_service
from app.services.auth import AuthContext

router = APIRouter(prefix="/auth", tags=["auth"])


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


@router.post("/login", response_model=LoginResponse)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_system_db),
) -> LoginResponse:
    _no_store(response)
    token, row, user = auth_service.authenticate(
        db,
        phone=body.phone,
        password=body.password,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    return LoginResponse(
        access_token=token,
        expires_at=row.expires_at,
        must_change_password=user.must_change_password,
        user=UserOut.model_validate(user),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(get_credentials),
    db: Session = Depends(get_system_db),
) -> None:
    auth_service.logout(db, credentials.credentials)
    db.commit()


@router.get("/me", response_model=MeResponse)
def me(
    response: Response,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_tenant_db),
) -> MeResponse:
    _no_store(response)
    user = db.get(User, ctx.user_id)
    agency = db.get(Agency, ctx.agency_id)
    return MeResponse(user=UserOut.model_validate(user), agency=AgencyOut.model_validate(agency))


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    body: ChangePasswordRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_tenant_db),
) -> None:
    auth_service.change_password(
        db,
        ctx.user_id,
        current_password=body.current_password,
        new_password=body.new_password,
        keep_session_id=ctx.session_id,
    )
    db.commit()

