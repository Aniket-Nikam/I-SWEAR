import asyncio
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from app.main import app
from app.voice import VoiceHub, FRAME_BYTES
from tests.test_movement import Socket

def test_voice_relay_is_room_scoped_does_not_echo_and_bounds_latency():
    async def run():
        hub=VoiceHub()
        a=SimpleNamespace(id="one",name="One",color_index=0)
        b=SimpleNamespace(id="two",name="Two",color_index=1)
        c=SimpleNamespace(id="three",name="Three",color_index=0)
        room=SimpleNamespace(code="FIRST",players={a.id:a,b.id:b})
        other=SimpleNamespace(code="OTHER",players={c.id:c})
        sender=await hub.connect(room,a,Socket());listener=await hub.connect(room,b,Socket())
        stranger=await hub.connect(other,c,Socket())
        for peer in (sender,listener,stranger):
            while not peer.queue.empty():peer.queue.get_nowait()
        for number in range(10):assert hub.relay(room,sender,bytes([number])*FRAME_BYTES)
        assert sender.queue.empty() and stranger.queue.empty()
        assert listener.queue.qsize()==6
        assert listener.queue.get_nowait()==bytes([0])+bytes([4])*FRAME_BYTES
        assert not hub.relay(room,sender,b"oversized-or-malformed")
        room.players.pop(a.id)
        assert not hub.relay(room,sender,bytes(FRAME_BYTES))
        hub.disconnect(room.code,sender);hub.disconnect(room.code,listener)
        assert room.code not in hub.rooms
    asyncio.run(run())

def test_voice_replacement_cannot_remove_new_connection_and_rate_is_bounded():
    async def run():
        hub=VoiceHub();player=SimpleNamespace(id="one",name="One",color_index=2)
        room=SimpleNamespace(code="ROOM",players={player.id:player})
        old=await hub.connect(room,player,Socket());new=await hub.connect(room,player,Socket())
        hub.disconnect(room.code,old)
        assert hub.rooms[room.code][player.id] is new
        for _ in range(35):assert hub.relay(room,new,bytes(FRAME_BYTES))
        assert not hub.relay(room,new,bytes(FRAME_BYTES))
    asyncio.run(run())

def test_real_voice_sockets_authenticate_and_relay_pcm(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL",f"sqlite:///{tmp_path / 'voice.db'}")
    with TestClient(app) as client:
        host=client.post("/api/rooms",json={"name":"Voice One"}).json()
        guest=client.post(f"/api/rooms/{host['room_code']}/join",json={"name":"Voice Two"}).json()
        path=lambda identity:f"/ws/voice/{identity['room_code']}?player_id={identity['player_id']}&token={identity['reconnect_token']}"
        with client.websocket_connect(path(host)) as first:
            assert len(first.receive_json()["players"])==1
            with client.websocket_connect(path(guest)) as second:
                assert len(second.receive_json()["players"])==2
                assert len(first.receive_json()["players"])==2
                frame=b"\x00\x20"*(FRAME_BYTES//2)
                first.send_bytes(frame)
                assert second.receive_bytes()==b"\x00"+frame
                second.send_bytes(frame)
                assert first.receive_bytes()==b"\x01"+frame
            assert len(first.receive_json()["players"])==1
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(path({**host,"reconnect_token":"invalid"})):pass
