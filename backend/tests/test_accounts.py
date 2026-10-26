import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts import Account, AccountSession, attempts
from app.main import admissions, app
from app.room_manager import manager


@pytest.fixture
def client():
    manager.rooms.clear()
    attempts.clear()
    admissions.clear()
    with TestClient(app) as browser:
        yield browser
    manager.rooms.clear()


def signup(client, **changes):
    return client.post("/api/auth/register", json={"username": "night_owl", "display_name": "Night Owl",
                       "password": "a-fake-test-password", "avatar_color": 2, "hat": "beanie", **changes})


def test_registration_hashes_password_and_session_and_restores_profile(client):
    response = signup(client)
    assert response.status_code == 201
    account = response.json()
    assert account["display_name"] == "Night Owl"
    assert account["hat"] == "beanie" and account["avatar_color"] == 2
    assert "password_hash" not in account
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie
    with Session(manager.repository.engine) as database:
        stored = database.scalar(select(Account))
        credential = database.scalar(select(AccountSession))
        assert stored.password_hash.startswith("$argon2id$")
        assert stored.password_hash != "a-fake-test-password"
        assert credential.token_hash != client.cookies.get("i_swear_account")
    assert client.get("/api/auth/me").json()["account"]["id"] == account["id"]


def test_login_errors_duplicates_and_logout_revocation(client):
    assert signup(client).status_code == 201
    assert signup(client, username="NIGHT_OWL").status_code == 409
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").json()["account"] is None
    assert client.post("/api/auth/login", json={"username": "night_owl", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "NIGHT_OWL", "password": "a-fake-test-password"}).status_code == 200
    token = client.cookies.get("i_swear_account")
    assert client.post("/api/auth/logout").status_code == 200
    client.cookies.set("i_swear_account", token)
    assert client.get("/api/auth/me").json()["account"] is None


def test_expired_session_and_cross_origin_auth_requests_are_rejected(client):
    assert signup(client).status_code == 201
    with Session(manager.repository.engine) as database:
        credential = database.scalar(select(AccountSession))
        credential.expires_at = int(time.time()) - 1
        database.commit()
    assert client.get("/api/auth/me").json()["account"] is None
    assert client.post("/api/auth/login", json={"username": "night_owl", "password": "a-fake-test-password"}, headers={"origin": "https://unrelated.invalid"}).status_code == 403


def test_profile_and_lobby_appearance_use_separate_badge_clearance(client):
    account = signup(client).json()
    updated = client.post("/api/auth/profile", json={"display_name": "Red Herring", "avatar_color": 5, "hat": "headphones"})
    assert updated.status_code == 200
    entry = client.post("/api/rooms", json={"name": "Red Herring", "avatar_color": 5, "hat": "headphones", "is_public": True, "max_players": 4}).json()
    room = manager.rooms[entry["room_code"]]
    player = room.players[entry["player_id"]]
    assert player.account_id == account["id"]
    assert player.color_index == 0 and player.avatar_color == 5
    with client.websocket_connect(f"/ws/rooms/{room.code}?player_id={player.id}&token={entry['reconnect_token']}") as socket:
        snapshot = socket.receive_json()
        assert snapshot["players"][0]["hat"] == "headphones"
        assert "account_id" not in snapshot["players"][0]
        assert client.get("/api/lobbies").json()["rooms"][0]["max_players"] == 4
        socket.send_json({"type": "appearance", "avatar_color": 3, "hat": "cap"})
        for _ in range(10):
            event = socket.receive_json()
            if event["type"] == "presence":
                assert event["player"]["avatar_color"] == 3
                break
        else:
            raise AssertionError("Outfit did not synchronize")


def test_leaving_a_lobby_releases_the_seat_and_preserves_other_witnesses(client):
    host = client.post("/api/rooms", json={"name": "Host"}).json()
    guest = client.post(f"/api/rooms/{host['room_code']}/join", json={"name": "Guest"}).json()
    with client.websocket_connect(f"/ws/rooms/{host['room_code']}?player_id={host['player_id']}&token={host['reconnect_token']}") as first:
        first.receive_json()
        with client.websocket_connect(f"/ws/rooms/{guest['room_code']}?player_id={guest['player_id']}&token={guest['reconnect_token']}") as second:
            second.receive_json()
            first.send_json({"type": "leave"})
            for _ in range(20):
                event = second.receive_json()
                if event["type"] == "snapshot" and len(event["players"]) == 1:
                    assert event["room"]["host_id"] == guest["player_id"]
                    break
            else:
                raise AssertionError("Departed witness kept a lobby seat")
    response = client.post(f"/api/rooms/{host['room_code']}/join", json={"name": "New Host"})
    assert response.status_code == 200


def test_password_validation_and_auth_rate_limit(client):
    assert signup(client, password="short").status_code == 422
    for _ in range(12):
        response = client.post("/api/auth/login", json={"username": "nobody", "password": "invalid"})
        assert response.status_code == 401
    assert client.post("/api/auth/login", json={"username": "nobody", "password": "invalid"}).status_code == 429
