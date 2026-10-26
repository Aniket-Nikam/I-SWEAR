from fastapi.testclient import TestClient

from app.main import app
from app.room_manager import manager

client = TestClient(app)


def setup_function() -> None:
    manager.rooms.clear()


def create(name: str = "Riya") -> dict:
    response = client.post("/api/rooms", json={"name": name})
    assert response.status_code == 201
    return response.json()


def join(code: str, name: str) -> dict:
    response = client.post(f"/api/rooms/{code}/join", json={"name": name})
    assert response.status_code == 200
    return response.json()


def test_room_create_and_join_four_players() -> None:
    host = create()
    for name in ("Aniket", "Mina", "Omar"):
        join(host["room_code"], name)
    response = client.get(f"/api/rooms/{host['room_code']}")
    body = response.json()
    assert len(body["players"]) == 4
    assert body["room"]["phase"] == "lobby"


def test_duplicate_names_are_case_insensitive() -> None:
    host = create("Riya")
    response = client.post(f"/api/rooms/{host['room_code']}/join", json={"name": "riya"})
    assert response.status_code == 409
    assert "already in use" in response.json()["detail"]


def test_room_capacity_is_eight() -> None:
    host = create()
    for index in range(7):
        join(host["room_code"], f"Witness {index}")
    response = client.post(f"/api/rooms/{host['room_code']}/join", json={"name": "One Too Many"})
    assert response.status_code == 409
    assert response.json()["detail"] == "Room is full"


def test_reconnect_token_restores_same_player() -> None:
    host = create()
    with client.websocket_connect(
        f"/ws/rooms/{host['room_code']}?player_id={host['player_id']}&token={host['reconnect_token']}"
    ) as socket:
        snapshot = socket.receive_json()
        assert snapshot["type"] == "snapshot"
        assert snapshot["players"][0]["id"] == host["player_id"]


def test_host_cannot_start_before_four_ready_players() -> None:
    host = create()
    with client.websocket_connect(
        f"/ws/rooms/{host['room_code']}?player_id={host['player_id']}&token={host['reconnect_token']}"
    ) as socket:
        assert socket.receive_json()["type"] == "snapshot"
        socket.send_json({"type": "start"})
        error = socket.receive_json()
        while error["type"] != "error":
            error = socket.receive_json()
        assert error == {"type": "error", "message": "At least 4 witnesses are required"}
