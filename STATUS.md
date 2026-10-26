# Status

## Completed

- Greenfield React, TypeScript, Vite, and Phaser client foundation
- FastAPI WebSocket server with explicit validated message schemas
- Create and join room flow for 4-8 players
- Duplicate-name and full-room rejection
- Reconnect tokens, presence recovery, and host migration
- Server-authoritative movement bounds and proximity-validated interaction
- Procedural top-down Blackout facility with eleven distinct spaces
- Smooth local movement, camera follow, wall collision, remote interpolation, and player labels
- Twelve physical interactables with authored environmental details
- Responsive lobby, in-world HUD, contextual controls, and inspection treatment
- Reduced-motion support and keyboard focus states
- Foundation documentation and automated room tests
- Frozen canonical Blackout incident and deterministic corruption engine
- Five private memories per witness, testimony, confidence stakes, retraction, and responses
- Programmatic Memory Clash and majority false-memory intervention
- Room radio without AI transcript processing
- Canonical evidence recovery with distributed badge clearances
- Shared six-position timeline with dragging and keyboard placement
- Majority lock, deterministic scoring, awards, room-by-room reveal, and rematch implementation
- Scripted solo rehearsal implementation and complete simulated match regression
- SQLite persistence, hashed reconnect credentials, saved replays, and group best scores
- Validated deterministic rematch incident variants saved as exact canonical records
- Optional two-call Archivist presentation with strict output checks, caching, and authored fallback
- Authored room fixtures and object closeups using the same Phaser geometry
- WebAudio cues, volume/mute, reduced motion, quick radio reactions, and speech bubbles
- Touch controls and responsive journal/reconstruction layouts
- Portrait share card, QR invitations, replay links, and challenge CTA
- Single-server production serving, container definitions, CI checks, demo guide, and submission text

## Current

- Local release selected by the user; public deployment deferred
- Full solo and four-client server matches completed
- Submission cover captured at 1200 × 800 (3:2); description validated at 427 characters
- Portable local archive built with compiled client, source, tests, documentation, submission assets, and a SHA-256 manifest
- Mobile dossier notices verified to wait until the document closes

## Next

- Local package handoff and optional additional incident content
- Physical device, additional browser, and adverse-network testing remain future coverage

## Known issues

- Physical touch devices, Firefox, and Safari remain untested
- Real paid Archivist calls and PostgreSQL remain untested
- Docker image is prepared but untested because the local Docker engine is stopped
- Single game worker required; sustained load and adverse-network testing remain pending
- Abrupt crashes can lose up to five seconds of position updates
- Test workers use one thread after a parallel worker startup timeout on this machine

## Tests passing

- Backend: 43 tests passed on patched dependencies
- Frontend: 5 tests passed on the final implementation
- Final TypeScript and production build passed; direct icon imports reduced transformation from 4,641 to 138 modules
- npm audit and declared Python requirements audit: no known vulnerabilities reported
- Browser: four clients joined, readied, started, moved, saw one another, and inspected objects
- Browser: refresh restored the same witness and position; movement resumed
- Browser: authoritative wall collision and keyboard inspection passed; console clear
- Browser: private journals differed, shared false memory appeared, and testimony triggered Memory Clash
- Browser: radio messages arrived in a second client
- Browser: canonical evidence recovered physically and synchronized to another client
- Browser: keyboard timeline placement and native dragging synchronized correctly
- Automated: complete three-minute scripted demo reaches reveal, results, and rematch without AI
- Live server: four real WebSocket clients finished movement, evidence, testimony, reconstruction, majority lock, results, replay, and a changed second round
- Browser: server restart restored the same private journal, evidence, testimony, identity, and movement
- Browser: room-by-room reveal, 83% and 100% results, portrait card export, QR invite, saved replay, and rematch verified
- Browser: mute/reduced-motion toggles and in-world radio bubbles verified
- Responsive viewport: 390 × 844 world and journal inspected; queued notification fix verified in the browser
- Submission checks: real 1200 × 800 JPEG cover, 427-character description, archive CRC and file manifest validated
- Extracted archive: production HTML, compiled JavaScript, solo API, authenticated socket, and five private memories passed without frontend dependencies

## Blockers

- None
