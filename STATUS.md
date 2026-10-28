# I SWEAR — release status

Public game: https://i-swear-game.onrender.com
Repository: https://github.com/Aniket-Nikam/I-SWEAR (master)

## Implemented

- Orpheus Campus in stylized 3D, with a camera-relative control scheme, shared server simulation, batched geometry, adaptive backing resolution, cached mesh inspection images, physical furniture collision, marked entrances and automatic graphics-failure fallback. The observatory and terminal retain their illustrated views.

- Three illustrated maps: expanded 15-room Orpheus Campus, 13-room Meridian Observatory, and 15-room Saltwind Terminal, each with a different incident, physical records, geometry, memories, rematch variants, and scripted solo routes.
- Solo case selection before entry, staged loading that reaches 100% after the first rendered frame, then a brief fade. Private/public lobbies, optional accounts, invitations and ready states.
- Twelve coats and eight headwear choices (96 combinations). Lobby, wardrobe and results show cached portraits rendered from the actual 3D witness mesh, with no additional WebGL contexts.
- Paper field-kit Settings with Audio / Display / Capture sections, custom sliders/switches, keyboard trapping, responsive layout and persistent preferences.
- In-game field kit: progress notes, witness portraits, larger tools, zoomable floor plans, and nearby witness visibility blocked by walls.
- Private memories, testimony/confidence, contradictions, partial physical records, up to four linked sources per deduction, majority lock, animated sequence reveal, awards, replay, and rematch.
- Versioned six-minute case rhythm, first-theory checkpoint, timed backup records, deadline closure, private pre-incident motives and optional cooperative objectives. Floor plans list badge access. Legacy investigations retain their rules until rematch.
- Bounded ordered socket writers, per-room action locking, coalesced background checkpoints, idempotent replay/account-stat transactions, and completed-case recovery after a stale checkpoint.
- Optional room voice: listener-first joining, explicit microphone permission, hold-to-talk V/button, mute, deafen, individual listener mute, and leave. Audio is transient and never saved.
- Credited CC0 music: Moil by Ruskerdax in the lobby and Unsolved Investigation by isaiah658 during cases, with scene crossfades, voice-chat ducking, paper/stamp pickup and inspection sounds, separate effects/music/master levels and hidden-tab pause. Reproducible synthesis and a listening preview are included.
- Render Free Docker service and Neon Free PostgreSQL. Secrets remain outside source control.
- Dedicated illustrated 3:2 cover, trailer, gameplay showcase, portable source/build archive, and submission copy.
- Static map artwork cached into 1024px texture tiles; local movement predicts immediately and reconciles server acknowledgments, with buffered remote motion and frame-rate-independent camera smoothing.

## Verification

- Backend: 78 tests pass, including all-map reachability and solo completion, checkpoints, accounts, voice isolation, rate limits, connection-log redaction, and real voice sockets.
- Client: 53 tests pass, covering input, dossier accessibility, wall visibility, microphone resampling, reveal rendering, movement prediction, wall sliding, reconnect resets, delayed network updates, heartbeat recovery, audio lifecycle, 3D batching, graphics cleanup, adaptive resolution and renderer fallback.
- Production TypeScript/Vite build passes; Phaser loads only when entering a match.
- Public HTTPS registration, secure cookies, saved profile, logout, and login pass.
- Public casefile release: four-client campus case F7KED recovered thirteen records, saved a first theory, linked all five facts per event, reached 100%, saved its replay and reset on rematch in 180 seconds. Host migration, same-identity reconnect and stale-edit rejection passed; no automatic network reconnect was needed.
- Final public build 29bb09c: eight-player observatory case NPSPA completed in 185 seconds with thirteen records, 100% recovery, private-role restoration, host migration, stale-edit rejection, replay and rematch. No automatic transport reconnect was needed.
- New local casefile release: simultaneous four-player campus and eight-player ferry rounds recovered thirteen records each, recorded first theories, linked all five facts per event, and finished at 100%. Reconnect, host migration, stale-edit rejection, replay and rematch reset passed.
- Public synthetic voice relays both directions over TLS. Browser listener receives a second participant and speaking indicator; deafen, speaker test, and leave work without microphone access.
- All three environments, title/lobby, dossiers, and mobile floor-plan layout inspected in Chromium. Cover is original illustrated key art, 1200 × 800 JPEG.
- Same-browser campus benchmark without recording: original drawing 11–14 FPS, cached map 78–84 FPS. This is one local Chromium measurement, not a cross-device guarantee. Live frame rate and connection latency appear in Settings.
- Both videos decode fully. Source motion averages 13.47 fps; a 30 fps output container does not imply 30 fps source capture.

## Operational limits

- One worker/instance owns simulation and sockets; horizontal scaling needs shared state.
- Free hosting sleeps after inactivity. The first visitor may wait about a minute.
- Current public-Git-URL setup uses Render Manual Deploy → Deploy latest commit. Existing deployment policy remains unchanged.
- Accounts collect no email and have no password-recovery flow; guests have full gameplay access.
- Voice requires HTTPS and browser permission to speak. Physical microphones, two-device acoustic quality, Safari/Firefox, adverse networks, and sustained load remain untested.
- Paid Archivist calls remain untested and are disabled publicly.
- An abrupt crash can lose up to five seconds of movement. Durable actions request coalesced checkpoints; an uncommitted in-flight save can be lost. A committed replay prevents a stale checkpoint from reopening or rescoring a completed case.
