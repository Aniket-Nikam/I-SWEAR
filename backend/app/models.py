from __future__ import annotations

from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

PlayerName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=18)]


class RoomPhase(str, Enum):
    LOBBY = "lobby"
    EXPLORING = "exploring"
    REVEAL = "reveal"
    RESULTS = "results"


class CreateRoomRequest(BaseModel):
    name: PlayerName
    map_id: Literal["campus", "observatory", "ferry"] = "campus"
    avatar_color: int | None = Field(default=None, ge=0, le=11)
    hat: Literal["none", "beanie", "cap", "headphones", "glasses", "beret", "fedora", "visor"] = "none"
    is_public: bool = False
    max_players: int = Field(default=8, ge=4, le=8)


class JoinRoomRequest(BaseModel):
    name: PlayerName
    avatar_color: int | None = Field(default=None, ge=0, le=11)
    hat: Literal["none", "beanie", "cap", "headphones", "glasses", "beret", "fedora", "visor"] = "none"


class SessionResponse(BaseModel):
    room_code: str
    player_id: str
    reconnect_token: str
    share_url: str


class ReadyAction(BaseModel):
    type: Literal["ready"]
    ready: bool


class StartAction(BaseModel):
    type: Literal["start"]


class MoveAction(BaseModel):
    type: Literal["move"]
    dx: float = Field(ge=-1, le=1)
    dy: float = Field(ge=-1, le=1)
    sequence: int = Field(ge=0)


class InteractAction(BaseModel):
    type: Literal["interact"]
    interactable_id: str = Field(min_length=1, max_length=64)


class PingAction(BaseModel):
    type: Literal["ping"]


class TestifyAction(BaseModel):
    type: Literal["testify"]
    memory_id: str = Field(min_length=1, max_length=32)
    stake: Literal[10, 25, 50] = 10


class RespondAction(BaseModel):
    type: Literal["respond"]
    testimony_id: str = Field(min_length=1, max_length=32)
    response: Literal["BELIEVE", "DOUBT", "CONTRADICTS_ME"]
    stake: Literal[10, 25, 50] = 10


class RetractAction(BaseModel):
    type: Literal["retract"]
    testimony_id: str = Field(min_length=1, max_length=32)


class ChatAction(BaseModel):
    type: Literal["chat"]
    text: str = Field(min_length=1, max_length=280)


class TimelineAction(BaseModel):
    type: Literal["timeline"]
    slot: int = Field(ge=0, le=5)
    source_id: str | None = Field(default=None, max_length=64)
    status: Literal["CONFIRMED", "DISPUTED", "UNKNOWN"] = "UNKNOWN"
    revision: int = Field(ge=0)


class LockVoteAction(BaseModel):
    type: Literal["lock_vote"]
    revision: int = Field(ge=0)
    vote: bool = True


class LinkSourceAction(BaseModel):
    type: Literal["link_source"]
    slot: int = Field(ge=0, le=5)
    source_id: str = Field(min_length=1, max_length=64)
    revision: int = Field(ge=0)
    remove: bool = False


class TheoryVoteAction(BaseModel):
    type: Literal["theory_vote"]
    revision: int = Field(ge=0)
    vote: bool = True


class RevealMotiveAction(BaseModel):
    type: Literal["reveal_motive"]


class RematchAction(BaseModel):
    type: Literal["rematch"]


class AppearanceAction(BaseModel):
    type: Literal["appearance"]
    avatar_color: int = Field(ge=0, le=11)
    hat: Literal["none", "beanie", "cap", "headphones", "glasses", "beret", "fedora", "visor"] = "none"


class LeaveAction(BaseModel):
    type: Literal["leave"]


ClientAction = ReadyAction | StartAction | MoveAction | InteractAction | PingAction | TestifyAction | RespondAction | RetractAction | ChatAction | TimelineAction | LockVoteAction | RematchAction | AppearanceAction | LeaveAction | LinkSourceAction | TheoryVoteAction | RevealMotiveAction
