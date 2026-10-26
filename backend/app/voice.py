"""Opt-in room voice. Short PCM frames use a separate authenticated TLS socket.

No recording or database writes. Bounded per-listener queues discard stale audio.
This relay works across NAT without requiring a paid TURN provider.
"""
import asyncio
import time
from dataclasses import dataclass, field
from fastapi import WebSocket

FRAME_BYTES = 1280  # 640 little-endian PCM16 samples: 40 ms at 16 kHz.

@dataclass
class VoicePeer:
    player: object
    socket: WebSocket
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=6))
    tokens: float = 35.0
    updated: float = field(default_factory=time.monotonic)

class VoiceHub:
    def __init__(self):
        self.rooms = {}

    @staticmethod
    def enqueue(peer, message):
        if peer.queue.full():
            peer.queue.get_nowait()
        peer.queue.put_nowait(message)

    def status(self, code):
        peers = self.rooms.get(code, {})
        message = {"type": "voice_members", "players": [{"id": p.player.id, "name": p.player.name,
                    "index": p.player.color_index} for p in peers.values()]}
        for peer in peers.values():
            self.enqueue(peer, message)

    async def connect(self, room, player, socket):
        peers = self.rooms.setdefault(room.code, {})
        old = peers.get(player.id)
        peer = VoicePeer(player, socket)
        peers[player.id] = peer
        if old:
            try:
                await old.socket.close(code=4001, reason="Voice opened elsewhere")
            except (RuntimeError, OSError):
                pass
        self.status(room.code)
        return peer

    def disconnect(self, code, peer):
        peers = self.rooms.get(code, {})
        if peers.get(peer.player.id) is not peer:
            return
        peers.pop(peer.player.id)
        if not peers:
            self.rooms.pop(code, None)
        else:
            self.status(code)

    def relay(self, room, peer, frame):
        if len(frame) != FRAME_BYTES or room.players.get(peer.player.id) is not peer.player:
            return False
        now = time.monotonic()
        peer.tokens = min(35, peer.tokens + (now-peer.updated)*25)
        peer.updated = now
        if peer.tokens < 1:
            return False
        peer.tokens -= 1
        # The server supplies the speaker identity; clients cannot impersonate it.
        message = bytes([peer.player.color_index]) + frame
        for other in self.rooms.get(room.code, {}).values():
            if other is not peer:
                self.enqueue(other, message)
        return True

    async def write(self, peer):
        while True:
            try:
                message = await asyncio.wait_for(peer.queue.get(), timeout=10)
            except asyncio.TimeoutError:
                await peer.socket.send_json({"type": "voice_ping"})
                continue
            if isinstance(message, bytes):
                await peer.socket.send_bytes(message)
            else:
                await peer.socket.send_json(message)

voice_hub = VoiceHub()
