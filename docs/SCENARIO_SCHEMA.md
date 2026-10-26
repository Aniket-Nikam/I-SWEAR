# Scenario Schema

The canonical scenario is implemented as frozen server-only dataclasses. Its serialized shape is:

```json
{
  "id": "blackout_001",
  "events": [
    {
      "id": "arrival",
      "time": "22:39",
      "actor": "Riya",
      "location": "Lab C",
      "action": "entered carrying",
      "object": "silver case",
      "cause": "scheduled transfer",
      "order": 1
    }
  ]
}
```

Validation and privacy rules:

- Event IDs are unique and ordered.
- Facts are validated nonempty strings; event order is contiguous and timestamps are valid.
- Evidence claims derive from one or more canonical events.
- Truth is frozen when the room leaves the lobby.
- Clients receive only player-specific projections before reveal.

`mystery.py` validates six unique events with increasing timestamps and contiguous ordering. Memories retain private truth-state and corruption metadata on the server. Client memory projections contain only the claimed facts, category, subjective confidence, and sensory prose.

`investigation.py` binds physical recorders to canonical events. A recovered record exposes only logged actor, location, time, action, and object fields. Cause and canonical ordering are not inferred by evidence. Badge clearances divide decisive records between four witness groups.

The example is an excerpt; an actual incident has six events. Evidence bindings and corruption enums live alongside the frozen scenario as explicit engine code. Later rounds create seeded variants before memory assignment. The exact event tuple is saved in the private room record and is never regenerated during recovery.
