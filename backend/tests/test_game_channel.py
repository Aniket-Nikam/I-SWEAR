import asyncio
import json
import pytest
from app.game_channel import GameChannel


class Wire:
    def __init__(self):
        self.sent = []
        self.closed = []
    async def send_text(self, value):
        self.sent.append(json.loads(value))
    async def close(self, **details):
        self.closed.append(details)


def test_transport_freezes_durable_events_and_coalesces_per_player_motion_in_order():
    async def run():
        wire = Wire(); channel = GameChannel(wire)
        data = {"type": "timeline", "timeline": {"revision": 1}}
        await channel.send_json(data)
        data["timeline"]["revision"] = 99
        await channel.send_json({"type": "positions", "players": [{"id": "a", "x": 1}, {"id": "b", "x": 2}]})
        await channel.send_json({"type": "chat", "text": "important"})
        await channel.send_json({"type": "positions", "players": [{"id": "a", "x": 3}]})
        assert len(channel.queue) == 3
        writer = asyncio.create_task(channel.write())
        for _ in range(20):
            await asyncio.sleep(0)
        await channel.close()
        await writer
        assert [item["type"] for item in wire.sent] == ["timeline", "chat", "positions"]
        assert wire.sent[0]["timeline"]["revision"] == 1
        assert wire.sent[-1]["players"] == [{"id": "a", "x": 3}, {"id": "b", "x": 2}]
        assert channel.bytes == 0
    asyncio.run(run())


def test_backpressure_has_message_and_byte_bounds_and_never_waits_for_the_wire():
    async def run():
        channel = GameChannel(Wire())
        for _ in range(channel.MAX_MESSAGES):
            await channel.send_json({"type": "chat", "text": "x"})
        with pytest.raises(OSError, match="fell behind"):
            await channel.send_json({"type": "chat", "text": "x"})
        assert channel.closed and len(channel.queue) == channel.MAX_MESSAGES
        huge = GameChannel(Wire())
        with pytest.raises(OSError):
            await huge.send_json({"type": "chat", "text": "x" * huge.MAX_BYTES})
        assert huge.bytes == 0
    asyncio.run(run())


def test_stalled_wire_times_out_while_another_listener_keeps_receiving():
    async def run():
        class Stalled(Wire):
            async def send_text(self, value):
                await asyncio.Event().wait()
        slow = GameChannel(Stalled()); slow.SEND_TIMEOUT = .02
        fast = GameChannel(Wire())
        await slow.send_json({"type":"chat", "text":"a"})
        await fast.send_json({"type":"chat", "text":"b"})
        slow_task, fast_task = asyncio.create_task(slow.write()), asyncio.create_task(fast.write())
        await asyncio.wait_for(slow_task, .5)
        assert slow.closed and slow.socket.closed[-1]["code"] == 4009
        assert fast.socket.sent == [{"type":"chat", "text":"b"}]
        await fast.close(); await fast_task
    asyncio.run(run())
