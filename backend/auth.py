from datetime import UTC, datetime, timedelta
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt import PyJWTError
from sqlmodel import select

from backend.config import settings
from backend.dependencies import SessionDep
from backend.enums import Role
from backend.models import Moderator

SECRET_KEY = settings.jwt_secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(plain: str) -> str:
    # bcrypt raises ValueError for passwords longer than 72 bytes.
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    # bcrypt raises ValueError for passwords longer than 72 bytes.
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_current_account(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: SessionDep,
) -> Moderator:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except PyJWTError:
        raise credentials_exception
    mod = session.exec(select(Moderator).where(Moderator.username == username)).first()
    if mod is None:
        raise credentials_exception
    return mod


AccountDep = Annotated[Moderator, Depends(get_current_account)]


def _require_role(account: Moderator, *allowed: Role) -> Moderator:
    """403, not 401, for a valid token with the wrong role.

    401 would be wrong twice over: the caller *is* authenticated, and the
    frontend logs the user out on any 401 (`petlom:unauthorized`), so a result
    keeper who touched a moderator-only endpoint would lose their session
    instead of seeing an error.
    """
    if account.role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not allowed to perform this action.",
        )
    return account


def get_current_moderator(account: AccountDep) -> Moderator:
    """A full moderator: the guard for every write endpoint but one."""
    return _require_role(account, Role.MODERATOR)


def get_current_result_editor(account: AccountDep) -> Moderator:
    """Anyone who may set a match result: a moderator, or a result keeper.

    A result keeper is additionally restricted to a request body that sets
    nothing but `result`; that check lives in `update_match`, because it is
    about the request rather than the caller.

    Spelled out rather than aliased to `AccountDep` so that a third role added
    later is denied by default instead of silently inheriting result editing.
    """
    return _require_role(account, Role.MODERATOR, Role.RESULT_KEEPER)


ModeratorDep = Annotated[Moderator, Depends(get_current_moderator)]
ResultEditorDep = Annotated[Moderator, Depends(get_current_result_editor)]
