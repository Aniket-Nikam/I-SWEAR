"""Optional presentation only. Two bounded room-wide calls; no chat or truth mutation."""

import json
import logging
import os
import re
from dataclasses import replace
from hashlib import sha256

import httpx
from fastapi import WebSocketDisconnect

logger = logging.getLogger("i-swear.archivist")
FALLBACK_INTRO = "You all experienced the same night. Some recollections are wrong. Explore, compare, and let the records interrupt your certainty."


def safe_prose(value: str, maximum=240) -> bool:
    # Generated flavor may not introduce incident actors, locations, times, or objects.
    forbidden = r"\d|riya|mina|omar|leena|lab\s*[abc]|silver|camera|breaker|archive|storage|exit|<|>"
    return isinstance(value, str) and 8 <= len(value) <= maximum and not re.search(forbidden, value, re.I) and all(character.isprintable() for character in value)


class Archivist:
    def __init__(self, transport=None):
        self.transport = transport
        self.cache = {}

    async def generate(self, room, stage, payload, schema):
        if os.getenv("ARCHIVIST_ENABLED", "1") == "0" or not os.getenv("OPENAI_API_KEY"):
            return None
        if room.ai_requests >= 2:
            return None
        key = sha256(json.dumps({"stage": stage, "payload": payload}, sort_keys=True).encode()).hexdigest()
        if key in self.cache:
            return self.cache[key]
        room.ai_requests += 1
        instructions = (
            "You are the Archivist, an atmospheric narrator for a fictional social memory game. "
            "Write concise investigative noir prose. Only provide presentation, never evidence or judgments. "
            "Do not name people, rooms, objects, times, numbers, winners, or actual events. "
            "Use sensory impressions and uncertainty, without inventing facts. No markup. "
            "For setup write one brief introduction and exactly five sensory fragments. "
            "For recap write one wry sentence about the supplied aggregate group pattern."
        )
        try:
            async with httpx.AsyncClient(timeout=4, transport=self.transport) as client:
                response = await client.post("https://api.openai.com/v1/responses", headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"}, json={
                    "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"), "store": False,
                    "instructions": instructions, "input": json.dumps(payload), "max_output_tokens": 650,
                    "text": {"format": {"type": "json_schema", "name": f"archivist_{stage}", "strict": True, "schema": schema}},
                })
                response.raise_for_status()
                body = response.json()
            if body.get("status") != "completed":
                return None
            text = "".join(content.get("text", "") for output in body.get("output", [])
                           for content in output.get("content", []) if content.get("type") == "output_text")
            result = json.loads(text)
            strings = [result["intro"], *result["sensory"]] if stage == "setup" else [result["recap"]]
            if stage == "setup" and len(result["sensory"]) != 5:
                return None
            if not all(safe_prose(value) for value in strings):
                return None
            self.cache[key] = result
            if len(self.cache) > 64:
                self.cache.pop(next(iter(self.cache)))
            return result
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            logger.info("Archivist presentation unavailable; handcrafted fallback retained")
            return None

    async def setup(self, manager, room):
        if room.ai_setup_done:
            return
        room.ai_setup_done = True
        round_number = room.round_number
        schema = {"type": "object", "additionalProperties": False,
                  "properties": {"intro": {"type": "string"}, "sensory": {"type": "array", "items": {"type": "string"}}}, "required": ["intro", "sensory"]}
        result = await self.generate(room, "setup", {"scenario": "a blackout in a university research complex", "theme": "uncertain recollections"}, schema)
        if room.round_number != round_number:
            return
        if result:
            room.intro = result["intro"]
            for witness in room.players.values():
                witness.memories = tuple(replace(memory, sensory=result["sensory"][index]) for index, memory in enumerate(witness.memories))
                if witness.websocket:
                    try:
                        await witness.websocket.send_json({"type": "memories", "memories": [memory.private() for memory in witness.memories]})
                    except (RuntimeError, OSError, WebSocketDisconnect):
                        pass
        if not room.solo:
            await manager.broadcast(room, {"type": "archivist", "text": room.intro})

    async def recap(self, manager, room):
        if not room.result or room.ai_recap_done:
            return
        room.ai_recap_done = True
        round_number = room.round_number
        schema = {"type": "object", "additionalProperties": False, "properties": {"recap": {"type": "string"}}, "required": ["recap"]}
        result = await self.generate(room, "recap", {key: room.result[key] for key in ("archetype", "reality_recovered", "consensus_mistakes")}, schema)
        if room.round_number != round_number or not room.result:
            return
        if result:
            room.result = {**room.result, "archivist_line": result["recap"]}
            if manager.repository:
                room.result = manager.repository.save_match(room.result, [witness.name for witness in room.players.values()])
            await manager.broadcast(room, {"type": "recap", "text": result["recap"]})
