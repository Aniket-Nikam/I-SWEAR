# Decisions

## Engine owns truth

FastAPI owns room state, identities, movement acceptance, interactions, and scoring. Phaser interpolates authoritative movement. Clients receive private claims and physically recovered evidence; canonical comparisons become public only at reveal.

## One game canvas, one interface shell

Phaser owns the continuous world. React owns room flow, accessible controls, overlays, and inspection documents. Communication crosses a small typed WebSocket boundary.

## Authored procedural art

The map and object closeups share authored Phaser geometry and a locked palette. Room fixtures, cabinets, monitors, light cones, floor markings, avatar frames, and inspection thumbnails form one visual system. Generated raster assets are unnecessary for this direction.

## Reconnect identity

Room entry returns an opaque player ID and reconnect token stored in the browser tab session per room. Refreshing restores the same player, while opening the invite in another tab can create a distinct witness.

## Controlled scope

Work is gated by live and automated checks. Foundation, private memory, and investigation gates were completed before endgame and solo implementation. Optional AI presentation, persistence, and release polish follow the working core loop.

## Reconstruction scoring

Reality Recovered is the percentage of six events placed in the correct order with all five logged facts correct. Timeline Accuracy reports ordering separately. Subjective memory confidence never predicts truth. Individual confidence points are added or deducted by server-owned claim accuracy; awards require nonzero recorded metrics.

## Rematch and recall

The first authored case remains stable for judge presentations. Later rounds change structured casting, times, objects, locations, and sequence using a room/round seed. All records and memory projections derive from that variant. Persistence saves the exact frozen incident, rather than regenerating it after restart.

## Optional AI and portability

AI embellishes sensory impressions and aggregate recap language through at most two requests per room per round. It cannot change factual memory text or adjudicate scores. The game is fully playable without a key. FastAPI serves a built client from one origin, making a conventional WebSocket-capable container host sufficient. One worker owns room simulation.
