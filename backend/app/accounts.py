"""Optional witness accounts. Argon2 passwords and revocable, hashed cookie sessions."""

from collections import defaultdict, deque
from hashlib import sha256
import os
import secrets
import time
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from pwdlib import PasswordHash
from sqlalchemy import ForeignKey, Integer, String, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column
from starlette.concurrency import run_in_threadpool

from .persistence import Base
from .room_manager import manager

router = APIRouter(prefix="/api/auth", tags=["Witness accounts"])
passwords = PasswordHash.recommended()
dummy_hash = passwords.hash("a timing-only password that is never used")
COOKIE = "i_swear_account"
MAX_AGE = 60 * 60 * 24 * 30
attempts = defaultdict(deque)
Hat = Literal["none", "beanie", "cap", "headphones", "glasses", "beret", "fedora", "visor"]


class Account(Base):
    __tablename__ = "accounts"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    username: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(18))
    password_hash: Mapped[str] = mapped_column(String(256))
    avatar_color: Mapped[int] = mapped_column(Integer, default=0)
    hat: Mapped[str] = mapped_column(String(16), default="none")
    rounds: Mapped[int] = mapped_column(Integer, default=0)
    best_score: Mapped[int] = mapped_column(Integer, default=0)

    def public(self):
        return {key: getattr(self, key) for key in ("id", "username", "display_name", "avatar_color", "hat", "rounds", "best_score")}


class AccountSession(Base):
    __tablename__ = "account_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id"), index=True)
    expires_at: Mapped[int] = mapped_column(Integer)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=20, pattern=r"^[A-Za-z][A-Za-z0-9_]+$")
    display_name: str = Field(min_length=2, max_length=18)
    password: str = Field(min_length=8, max_length=128)
    avatar_color: int = Field(default=0, ge=0, le=11)
    hat: Hat = "none"


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=1, max_length=128)


class ProfileRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=18)
    avatar_color: int = Field(ge=0, le=11)
    hat: Hat = "none"


def limit(request):
    address = request.client.host if request.client else "unknown"
    now = time.monotonic()
    recent = attempts[address]
    while recent and now - recent[0] > 60:
        recent.popleft()
    if len(recent) >= 12:
        raise HTTPException(429, "Too many sign-in attempts. Try again in a minute.")
    recent.append(now)
    if len(attempts) > 4096:
        for key in list(attempts):
            if not attempts[key] or now - attempts[key][-1] > 60:
                del attempts[key]


def session_for_request(request):
    token = request.cookies.get(COOKIE)
    if not token or not manager.repository:
        return None
    with Session(manager.repository.engine) as database:
        credential = database.get(AccountSession, sha256(token.encode()).hexdigest())
        if not credential or credential.expires_at < time.time():
            return None
        account = database.get(Account, credential.account_id)
        return account.public() if account else None


def start_session(database, account, response, request):
    token = secrets.token_urlsafe(32)
    database.add(AccountSession(token_hash=sha256(token.encode()).hexdigest(), account_id=account.id, expires_at=int(time.time()) + MAX_AGE))
    database.commit()
    response.set_cookie(COOKIE, token, max_age=MAX_AGE, httponly=True, secure=os.getenv("COOKIE_SECURE") == "1" or request.url.scheme == "https", samesite="lax", path="/")
    return account.public()


@router.post("/register", status_code=201)
async def register(payload: RegisterRequest, response: Response, request: Request):
    limit(request)
    name = payload.display_name.strip()
    if len(name) < 2:
        raise HTTPException(422, "Your witness name needs at least two characters.")
    async with request.app.state.password_gate:
        hashed = await run_in_threadpool(passwords.hash, payload.password)
    with Session(manager.repository.engine, expire_on_commit=False) as database:
        account = Account(id=secrets.token_urlsafe(16), username=payload.username.casefold(), display_name=name,
                          password_hash=hashed, avatar_color=payload.avatar_color, hat=payload.hat)
        database.add(account)
        try:
            database.flush()
            return start_session(database, account, response, request)
        except IntegrityError:
            database.rollback()
            raise HTTPException(409, "That username is already registered.")


@router.post("/login")
async def login(payload: LoginRequest, response: Response, request: Request):
    limit(request)
    with Session(manager.repository.engine, expire_on_commit=False) as database:
        account = database.scalar(select(Account).where(Account.username == payload.username.casefold()))
        digest = account.password_hash if account else dummy_hash
        try:
            async with request.app.state.password_gate:
                valid = await run_in_threadpool(passwords.verify, payload.password, digest)
        except (ValueError, TypeError):
            valid = False
        if not account or not valid:
            raise HTTPException(401, "Username or password is incorrect.")
        return start_session(database, account, response, request)


@router.get("/me")
def me(request: Request):
    return {"account": session_for_request(request)}


@router.post("/profile")
def update_profile(payload: ProfileRequest, request: Request):
    identity = session_for_request(request)
    if not identity:
        raise HTTPException(401, "Sign in to save your witness profile.")
    name = payload.display_name.strip()
    if len(name) < 2:
        raise HTTPException(422, "Your witness name needs at least two characters.")
    with Session(manager.repository.engine, expire_on_commit=False) as database:
        account = database.get(Account, identity["id"])
        account.display_name, account.avatar_color, account.hat = name, payload.avatar_color, payload.hat
        database.commit()
        return account.public()


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE)
    if token:
        with Session(manager.repository.engine) as database:
            credential = database.get(AccountSession, sha256(token.encode()).hexdigest())
            if credential:
                database.delete(credential)
                database.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"signed_out": True}


def record_account_results(repository, room):
    with Session(repository.engine) as database:
        for player in room.players.values():
            if not player.account_id:
                continue
            account = database.get(Account, player.account_id)
            if account:
                account.rounds += 1
                account.best_score = max(account.best_score, room.result["reality_recovered"])
        database.commit()
