"""Bounded ordered game transport: slow listeners cannot stall room simulation."""
import asyncio
import json
from collections import deque
from contextlib import suppress
from starlette.websockets import WebSocketDisconnect


class GameChannel:
    MAX_MESSAGES = 64
    MAX_BYTES = 512 * 1024
    SEND_TIMEOUT = 2
    COALESCED = {"positions", "case_state"}

    def __init__(self, socket):
        self.socket = socket
        self.queue = deque()
        self.bytes = 0
        self.ready = asyncio.Event()
        self.closed = False

    async def send_json(self, payload):
        if self.closed:
            raise OSError("Game channel closed")
        kind = payload.get("type")
        if kind == "positions":
            # Position packets contain deltas. Preserve each witness's latest
            # state when replacing queued packets, including witnesses who stop.
            players = {}
            for pending in self.queue:
                if pending[0] == kind:
                    players.update((item["id"], item) for item in json.loads(pending[1])["players"])
            players.update((item["id"], item) for item in payload["players"])
            payload = {**payload, "players": list(players.values())}
        encoded = json.dumps(payload, separators=(",", ":"), allow_nan=False)
        size = len(encoded.encode("utf-8"))
        if kind in self.COALESCED:
            for pending in tuple(self.queue):
                if pending[0] == kind:
                    self.queue.remove(pending)
                    self.bytes -= pending[2]
        if len(self.queue) >= self.MAX_MESSAGES or self.bytes + size > self.MAX_BYTES:
            self.closed = True
            self.ready.set()
            raise OSError("Game listener fell behind")
        self.queue.append((kind, encoded, size))
        self.bytes += size
        self.ready.set()

    async def close(self, code=1000, reason=""):
        self.closed = True
        self.ready.set()
        with suppress(RuntimeError, OSError, asyncio.TimeoutError, WebSocketDisconnect):
            await asyncio.wait_for(self.socket.close(code=code, reason=reason), timeout=1)

    async def write(self):
        try:
            while not self.closed:
                await self.ready.wait()
                while self.queue and not self.closed:
                    _, encoded, size = self.queue.popleft()
                    self.bytes -= size
                    await asyncio.wait_for(self.socket.send_text(encoded), timeout=self.SEND_TIMEOUT)
                self.ready.clear()
        except (RuntimeError, OSError, asyncio.TimeoutError, WebSocketDisconnect):
            pass
        finally:
            await self.close(code=4009, reason="Game connection could not keep up")
