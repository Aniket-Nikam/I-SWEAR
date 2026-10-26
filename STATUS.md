# I SWEAR — release status

Public game: https://i-swear-game.onrender.com
Repository: https://github.com/Aniket-Nikam/I-SWEAR (master)

## Implemented

- Three illustrated maps: expanded 15-room Orpheus Campus, 13-room Meridian Observatory, and 15-room Saltwind Terminal, each with a different incident, physical records, geometry, memories, rematch variants, and scripted solo routes.
- Illustrated menu, wardrobe, optional accounts, private/public lobbies, invitations, and ready states.
- In-game field kit: progress notes, witness portraits, larger tools, zoomable floor plans, and nearby witness visibility blocked by walls.
- Private memories, testimony/confidence, contradictions, physical evidence, shared reconstruction, majority lock, reveal, awards, replay, and rematch.
- Optional room voice: listener-first joining, explicit microphone permission, hold-to-talk V/button, mute, deafen, individual listener mute, and leave. Audio is transient and never saved.
- Render Free Docker service and Neon Free PostgreSQL. Secrets remain outside source control.
- Real 3:2 cover, trailer, gameplay showcase, portable source/build archive, and submission copy.

## Verification

- Backend: 59 tests pass, including all-map reachability and solo completion, checkpoints, accounts, voice isolation, rate limits, and real voice sockets.
- Client: 11 tests pass, covering input, dossier accessibility, wall visibility, microphone resampling, and reveal rendering when the server clock is ahead.
- Production TypeScript/Vite build passes; Phaser loads only when entering a match.
- Public HTTPS registration, secure cookies, saved profile, logout, and login pass.
- Public four-client match completes movement, four records, testimony, reconstruction, 100% recovery, reveal, replay, and changed rematch.
- Public synthetic voice relays both directions over TLS. Browser listener receives a second participant and speaking indicator; deafen, speaker test, and leave work without microphone access.
- All three environments, title/lobby, dossiers, and mobile floor-plan layout inspected in Chromium. Cover is an authentic 1200 × 800 JPEG.
- Both videos decode fully. Source motion averages 13.47 fps; a 30 fps output container does not imply 30 fps source capture.

## Operational limits

- One worker/instance owns simulation and sockets; horizontal scaling needs shared state.
- Free hosting sleeps after inactivity. The first visitor may wait about a minute.
- Current public-Git-URL setup uses Render Manual Deploy → Deploy latest commit. Existing deployment policy remains unchanged.
- Accounts collect no email and have no password-recovery flow; guests have full gameplay access.
- Voice requires HTTPS and browser permission to speak. Physical microphones, two-device acoustic quality, Safari/Firefox, adverse networks, and sustained load remain untested.
- Paid Archivist calls remain untested and are disabled publicly.
- An abrupt crash can lose up to five seconds of movement; durable actions checkpoint immediately.
