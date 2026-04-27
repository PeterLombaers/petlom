from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import select

from backend.auth import ModeratorDep, create_access_token, verify_password
from backend.dependencies import SessionDep
from backend.models import Moderator, ModeratorPublic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
) -> dict:
    mod = session.exec(
        select(Moderator).where(Moderator.username == form_data.username)
    ).first()
    if not mod or not verify_password(form_data.password, mod.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": mod.username})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def me(current_mod: ModeratorDep) -> ModeratorPublic:
    return current_mod
