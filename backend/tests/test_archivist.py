import asyncio
import json

import httpx

from app.archivist import Archivist, safe_prose
from app.room_manager import RoomManager


def test_no_key_means_no_request_and_gameplay_needs_no_ai(monkeypatch):
    monkeypatch.setenv("ARCHIVIST_ENABLED", "1")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    async def run():
        room = RoomManager().create("Judge")[0]
        assert await Archivist().generate(room, "recap", {}, {}) is None
        assert room.ai_requests == 0
    asyncio.run(run())


def test_structured_api_budget_cache_and_failure_fallback(monkeypatch):
    monkeypatch.setenv("ARCHIVIST_ENABLED", "1")
    monkeypatch.setenv("OPENAI_API_KEY", "fake-test-key")
    calls = []
    def handler(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"status": "completed", "output": [{"content": [{"type": "output_text", "text": json.dumps({"recap": "Certainty arrived early. The records took their time."})}]}]})
    async def run():
        room = RoomManager().create("Judge")[0]
        archivist = Archivist(httpx.MockTransport(handler))
        first = await archivist.generate(room, "recap", {"archetype": "THE SKEPTICS"}, {})
        assert first["recap"]
        assert await archivist.generate(room, "recap", {"archetype": "THE SKEPTICS"}, {}) == first
        assert len(calls) == 1
        assert calls[0]["text"]["format"]["strict"] is True
        assert "chat" not in calls[0]["input"]
        await archivist.generate(room, "recap", {"archetype": "THE ANCHORS"}, {})
        assert await archivist.generate(room, "recap", {"archetype": "THE HIVE MIND"}, {}) is None
        assert len(calls) == 2
        failing = Archivist(httpx.MockTransport(lambda request: httpx.Response(503)))
        other = RoomManager().create("Other Judge")[0]
        assert await failing.generate(other, "recap", {}, {}) is None
    asyncio.run(run())


def test_generated_flavor_cannot_introduce_incident_facts():
    assert safe_prose("The silence feels colder than you remember.")
    assert not safe_prose("Riya entered Lab B at 22:39.")
    assert not safe_prose("The silver case was in storage.")
