# I SWEAR — release status

Public game: https://i-swear-game.onrender.com
Repository: https://github.com/Aniket-Nikam/I-SWEAR (master)

## Implemented

- Optional Nightmare mode: The Unsaid reacts to deliberately confirmed public-record contradictions, with a nine-second correction warning, collision-aware pursuit, capture/respawn, a voted false-story devour ending, CC0 creature recordings and cinematic controls. Calm training remains unchanged. See docs/NIGHTMARE.md.

- Shared readable typography across the game: 16px default reading/control text and 14px minimum secondary labels, with larger mobile controls, switches, wardrobe choices and witness names. Notebook tutorial, punched dossiers, taped testimony and a woven/pinned reconstruction board use static decoration. Document headers and tutorial navigation remain visible while scrolling; failed world downloads have a reload recovery screen. See docs/UI.md.

- Seven-step untimed training centered on one disputed event, with two witness statements, a marked physical lead, an evidence-based understanding check, a real challenge, a gated camera backup and one supported deduction. Training bots wait; the completion explains one event without presenting an incomplete full-case score. Tools appear progressively.
- Quieter investigation screen: one next action, three core tools, compact clock, and optional Field notes for map/crew/motive/radio. Removed recurring activity and clash popups; no voice control in solo. A short full-case briefing explains the premise and first action.
- Shared 20px collision boundary fits the rendered body and arms. Swept axis contact removes frame-sized collision gaps, local presentation has its own collision path, remote snapshots retain server timing across delivery bursts, and visible movement drives turns/gait. Alternate-map circulation lanes are wider and all doors/routes are revalidated.
- Rounded beanies with rolled ribbed cuffs, fitted hair beneath beanie/cap/beret/fedora crowns, curved cap peaks and oval fedora brims. Cached portraits regenerated from the same game meshes.
- Exact exponential displacement on both server and client removes frame-rate-dependent coast distance. Small valid presentation corrections wait at rest and settle during the next walk, preventing the release pull-back. Inspection proximity checks include the physics position. Campus entrances have more turning clearance.
- More authored in-game detail: painted room borders and window light, noticeboards and ventilation, slatted benches with armrests, and inexpensive baked furniture contact shapes. Static scenery remains within five draws and 80,000 triangles on all three maps.

- All three maps in stylized 3D, with a camera-relative control scheme, shared server simulation, batched geometry, adaptive backing resolution, cached mesh inspection images, physical furniture collision, marked entrances and automatic graphics-failure fallback. Rendering follows the display clock; character turns and position corrections are smoothed. Witnesses use physical 3D occlusion rather than abruptly toggling visibility.

- Three expanded maps: 18-room Orpheus Campus, 15-room Meridian Observatory, and 17-room Saltwind Terminal, each with a different incident, physical records, geometry, memories, rematch variants, and scripted solo routes.
- Solo case selection before entry, staged loading that reaches 100% after the first rendered frame, then a brief fade. Private/public lobbies, optional accounts, invitations and ready states.
- Twelve coats and eight headwear choices (96 combinations). Lobby, wardrobe and results show cached portraits rendered from the actual 3D witness mesh, with no additional WebGL contexts.
- Paper field-kit Settings with Audio / Display / Capture sections, custom sliders/switches, keyboard trapping, responsive layout and persistent preferences.
- A clickable, keyboard-accessible Inspect action with recovered-record state; compact side notifications keep the center of play clear.
- In-game field kit: progress notes, witness portraits, larger tools, zoomable floor plans, and physical 3D witness occlusion and click-to-inspect records.
- Private memories, testimony/confidence, contradictions, partial physical records, up to four linked sources per deduction, majority lock, animated sequence reveal, awards, replay, and rematch.
- Versioned six-minute case rhythm, first-theory checkpoint, timed backup records, deadline closure, private pre-incident motives and optional cooperative objectives. Floor plans list badge access. Legacy investigations retain their rules until rematch.
- Bounded ordered socket writers, per-room action locking, coalesced background checkpoints, idempotent replay/account-stat transactions, and completed-case recovery after a stale checkpoint.
- Optional room voice: listener-first joining, explicit microphone permission, hold-to-talk V/button, mute, deafen, individual listener mute, and leave. Audio is transient and never saved.
- Credited CC0 music: Moil by Ruskerdax in the lobby and Unsolved Investigation by isaiah658 during cases, with scene crossfades, voice-chat ducking, Kenney CC0 discovery, inspection, clash and reveal sounds, separate effects/music/master levels and hidden-tab pause. Reproducible asset preparation and a listening preview are included.
- Render Free Docker service and Neon Free PostgreSQL. Secrets remain outside source control.
- Dedicated illustrated 3:2 cover, trailer, gameplay showcase, portable source/build archive, and submission copy.
- Static map artwork cached into 1024px texture tiles; local movement predicts immediately and reconciles server acknowledgments, with buffered remote motion and frame-rate-independent camera smoothing.

## Verification

- Public Nightmare acceptance **H8JUW**: eight clients passed cancellation, actual pursuit/capture, other-player movement, respawn, identity reconnect, false-story devour ending, replay **H8JUW-1** and rematch in **170 seconds, zero automatic reconnects**. No filtered application errors during the check.
- Nightmare local acceptance **GPZJD**: eight human socket clients, six primary records, warning cancellation, actual pursuit/contact, target freeze while another player moved, respawn, identity reconnect, final devour, persisted replay **GPZJD-1**, rematch reset; **157 seconds, zero automatic reconnects**. Local release checks pass (104 backend / 93 client tests and production build). Desktop/390 × 844 creature preview and scare-off controls checked; the hosted build is verified as **948e831**, Render deploy **dep-dbhnt9uc6qcc73ftknfg**, completed **2026-10-29 17:14:32 UTC**. The entry, CSS, lazy 3D/world loader and both creature recordings match local SHA-256 checks.

- Earlier clarity runtime **745f395** shipped as Render deploy **dep-dbhi49jbc2fs73a3s0hg**, completed 2026-10-29 10:39:27 UTC. Entry JavaScript, CSS, GameCanvas and the 3D world match the tested local build. This client-only follow-up closes a briefing/case-switch focus edge case. The unchanged gameplay backend passed public eight-player campus AXT84 (16 records, 100%, replay/reconnect/stale edits/rematch, 196 seconds, zero automatic reconnects) and local eight-player ferry MZWHD (15 records, 100%, 178 seconds, zero automatic reconnects). Full browser lesson KSQVE and public lesson N2AQE are documented in docs/QA.md.
- Backend: **104 tests pass**, including tutorial gating/persistence, exact stopping distance, entrance clearance, physical furniture, all-map reachability, checkpoints, accounts, voice isolation, rate limits and real voice sockets.
- Client: **93 tests pass**, including world-download recovery, lesson progression/reconnects, fitted headwear, delayed stopping, inspection reach, solo selection, loading, settings, audio lifecycle, 3D batching, cleanup and automatic fallback.
- Production TypeScript/Vite build passes. The 3D world loads on entering a match; Phaser is fetched only for graphics fallback.
- Earlier guided-training runtime c94212c: the complete local tutorial passed. Public eight-client campus FUDK6 recovered 16 records, reached 100% in 209 seconds, saved replay and rematched. It recovered from 16 automatic transport reconnects; the cause was unconfirmed and is recorded in docs/QA.md.
- Earlier 3D expansion 132fd8f: public eight-client terminal M5HUG recovered 15 records, reached 100%, saved replay and rematched in 189 seconds with no automatic reconnects. All three 3D maps and phone Inspect behavior were checked.
- Earlier functionality release 9267a8a: eight-client campus MS2MY recovered 13 records, reached 100%, saved replay, restored identity, rejected stale edits and rematched in 190 seconds with zero automatic network reconnects. Public solo, settings, music and inspection were checked in Chromium; one sample showed 59 FPS / 77 ms latency.
- Public HTTPS registration, secure cookies, saved profile, logout, and login pass.
- Public casefile release: four-client campus case F7KED recovered thirteen records, saved a first theory, linked all five facts per event, reached 100%, saved its replay and reset on rematch in 180 seconds. Host migration, same-identity reconnect and stale-edit rejection passed; no automatic network reconnect was needed.
- Earlier public build 29bb09c: eight-player observatory case NPSPA completed in 185 seconds with thirteen records, 100% recovery, private-role restoration, host migration, stale-edit rejection, replay and rematch. No automatic transport reconnect was needed.
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

## Objective clarity follow-up

A map-specific premise now states the team’s questions and six-event final answer. The explanation is available before entry, in How to play, and through Goal & field notes during play. The board says Submit final answer, and practice begins with one explicit room question. Client regression checks pass (93); runtime publication follows the local objective check.
