# Architecture

## Frontend

- React owns entry, lobby, HUD, accessible dialogs, and connection state.
- Phaser owns rendering, camera behavior, avatar interpolation, and proximity detection.
- One accessible keyboard controller sends directional intent and release events with a 100 ms heartbeat.
- `GameSocket` owns reconnect behavior and typed message distribution.
- The scene subscribes directly to movement events to avoid continuous React renders.

## Backend

- FastAPI exposes room creation, room joining, inspection, and one WebSocket endpoint.
- Pydantic validates every client action.
- `RoomManager` owns authoritative room and player state.
- Movement messages contain intent vectors, not scores or trusted positions.
- A 20 Hz server simulation owns acceleration, collision, normalized diagonals, and world bounds.
- The server supplies the same room and wall geometry to every client.
- Input expires after 300 ms without a heartbeat; disconnect and focus loss stop movement.
- Interaction is accepted only when the authoritative player position is within range.

## Data flow

```text
keyboard -> input controller -> input vector -> FastAPI validation -> server simulation
         <- avatar interpolation <- authoritative position broadcast

React room UI -> validated action -> RoomManager -> room snapshot/event
```

## Persistence

SQLAlchemy stores private room JSON and finished result records in SQLite. Reconnect credentials are hashed at rest. The exact frozen scenario is persisted, including rematch variants. Restored humans start offline with zero movement; bots retain script progress. Durably accepted actions save immediately; positions save every five seconds. The same JSON models can use PostgreSQL with an installed driver. Only SQLite has been exercised.

Run one worker. In-memory simulation, socket ownership, and room admission are process-local. Multiple workers require shared room routing and coordination; adding workers behind a round-robin proxy does not scale this implementation safely.

## Mystery and presentation boundaries

`mystery.py` owns frozen scenarios and deterministic memory projections. `investigation.py` projects logged facts from canonical truth and validates public sources. `scoring.py` computes facts, order, confidence, challenges, belief propagation, awards, and archetypes. Consensus and response history survive later belief changes.

The first round uses the authored Blackout incident. `scenario_for_round` creates validated rematch variants before start. AI never chooses these facts. `archivist.py` optionally embellishes sensory prose and one aggregate recap using the Responses API with strict JSON schema. It has a two-request budget, a four-second timeout, bounded cache, output checks, and authored fallback. Full chat and private witness transcripts are excluded. [Structured output contract](https://developers.openai.com/api/docs/guides/structured-outputs).

## Transport and deployment

Room creation and joins are limited to sixty requests per address per minute. WebSockets validate origins, opaque reconnect credentials, action schemas, message sizes, and per-player rates. Positions are derived from intent; inspection requires server proximity and recorder clearance. Reconstruction uses revisions; edits invalidate votes. Concurrent majority votes produce one reveal.

FastAPI serves the built Vite client from the same origin when `frontend/dist` exists. A reverse proxy must support WebSocket upgrades. Access logging is disabled in documented launch commands because reconnect credentials occur in WebSocket URLs. The container supports `PORT`, `DATABASE_URL`, `STATIC_DIR`, and `ALLOWED_ORIGINS`.
