# Verification record

## Casefile release / 2026-10-27

- Final regression: 78 backend tests and 30 client tests pass. TypeScript/Vite production build passes.
- Simultaneous real socket runs: four-player campus room UVSUA and eight-player ferry room 3HZ55. Both recovered thirteen partial records, saved a first theory by majority, linked a complete five-fact reconstruction and finished at 100%. Reconnect/private motive restoration, host migration, conflicting same-revision edits, all-client reveal delivery, saved replay and rematch reset passed. Runs took 180 and 183 seconds.
- All three maps remain collision-reachable and complete their scripted rehearsal. Each event has complementary physical sources on every map.
- Rule tests cover private owner-only motive messages, voluntary disclosure, late-record gating, linked evidence overriding false testimony, visible conflicts, four-source bounds, multiple withdrawals, immutable first theory, revision-bound votes, deadline closure, empty rooms pausing, checkpoints and legacy rules.
- Persistence tests cover coalescing during a slow database, idempotent replay/account statistics, final phase checkpoints and a committed replay superseding a stale exploration checkpoint.
- Transport tests cover frozen durable payloads, per-witness motion delta merging, reliable event ordering, message/byte bounds and slow-wire timeout without blocking another listener.
- Browser checked the motive dossier at desktop and 390 × 844, partial fact placement, floor-plan badge access, completed deductions, animated reveal with distortion explanation, first-to-final results and rematch. A transient zero-size framebuffer error and overly broad SVG path style were fixed during visual QA. Final resize checks use the rebuilt renderer. New notices sit below the case clock; its motive button remains clickable during a notice.
- The measured local rehearsal reported 92 FPS without recording. Performance numbers are local observations, not device guarantees.

Connection-recovery tests cover silent/one-way failures, healthy idle pongs, discarded late events from an old socket, no stale action replay, and cancelled retries after leaving. An initial parallel Windows Vitest run failed to start one worker; the single-worker run provides the final result.

The final server log check showed transport-close notices at the eight-client teardown after rematch; no application traceback or checkpoint failure appeared. Public performance and screenshots are observations from this Chromium session. Physical microphone quality, other browsers, wider device coverage and sustained/adverse-network load remain unverified.

Initial public Python checks stopped on dropped sockets. Render showed no application errors or restart and memory remained under 90 MB. The browser completed its case through automatic reconnects. The harness now uses browser-style application heartbeats and bounded authenticated reconnects, reporting their count rather than treating a transport interruption as a completed test. A later eight-player attempt encountered an interrupted read-only HTTP request; bounded transport retries and less frequent polling were added to the QA client. A test confirms it never retries POST mutations or masks HTTP errors. The complete final run below passed.

Earlier release checks below remain historical evidence. Public casefile deployment f4b8f61 passed the complete four-client campus run F7KED in 180 seconds with thirteen records, 100% recovery, first-theory majority, source linking, host migration, same-identity reconnect, stale-edit rejection, replay and rematch. No automatic transport reconnect occurred in that run. HTTPS account flow and bidirectional synthetic voice also passed. Live JS/CSS, music, cover and favicon matched local file hashes. The final runtime deployment 29bb09c (dep-dbg8bpmc6qcc73eln6bg) then passed the eight-client observatory case NPSPA in 185 seconds: thirteen records, 100%, first theory, linked facts, private-role restoration, host migration, stale-edit rejection, saved replay and rematch. It needed no automatic reconnects. The final live client/assets matched the local build; browser warnings/errors were empty. Settings measured 66 FPS, a 19.6 ms sampled 95th-percentile frame interval and 78 ms connection latency in this browser.

Run dates: 2026-10-25 and 2026-10-26. Windows, Python 3.11, Node 24, in-app Chromium browser. No OpenAI key used in live matches.

| Check | Result |
| --- | --- |
| Backend regression suite | 43 passed on patched dependencies |
| Client input and accessible-overlay tests | 5 passed |
| TypeScript and production Vite build | Passed |
| npm dependency audit | Zero reported vulnerabilities |
| Python dependency audit | No known vulnerabilities found in the declared requirements |
| Four live WebSocket clients | Complete match and changed rematch passed |
| SQLAlchemy persistence | Exact canonical variant, private memory, hashed credentials, replay, and group best passed |
| Archivist fake provider | Structured output, cache, budget, failure fallback, no-key zero calls passed |

Four-client runs created isolated QA rooms including UCUXB and 73UW4. Four clients walked real collision-constrained routes, recovered four physical records, shared conflicting memories, formed a false consensus, changed a belief, reconstructed six events, received 100% results, read a saved replay, and started a changed second round. The script uses only public REST and WebSocket actions; it does not assign positions, evidence, or scores.

## Live browser checks

- Four tabs created/joined/readied/started, moved, saw each other, and inspected objects.
- Refresh restored witness identity and position. Stopping and restarting the server restored an active solo room's private journal, evidence, testimony, and movement.
- Directional movement, authoritative wall stopping, doorway traversal, E inspection, and object closeups were exercised.
- Different journals, a shared false memory, Memory Clash, confidence sharing, and radio delivery were verified across clients.
- Evidence synchronized. Native dragging and keyboard source placement updated the shared board in another client.
- Solo rehearsal reached false consensus, physical discovery, reconstruction, camera reveal, results, and rematch. A later round changed Riya/Lab C/22:39 to Omar/Lab B/22:34. The corrected automatic reveal occurred around three minutes and returned 83% after preserving a false claim.
- The portrait share card was downloaded, opened, and visually checked. Saved replay remained available after rematch and server restart.
- QR invite, production replay copy feedback, challenge CTA, quick radio reaction, and in-world speech bubble were exercised.
- Mute and reduced-motion toggles changed visible state. Radio input received focus. Focus trapping and Escape closure are covered by client tests.
- FastAPI served the production client on port 8017 independently of Vite. Browser errors and warnings were empty at the end of the tested rematch.
- At a 390 × 844 viewport, the world controls and private journal remained readable. Archivist and clash notices now wait while a dossier is open, then appear after it closes; this behavior was verified live.
- The final build transforms 138 modules after using direct icon imports. A parallel test-worker startup timeout was resolved with one thread; all five client tests passed afterward.
- Submission checks validate the authentic JPEG cover at 1200 × 800 and the description at 427 characters. The archive uses an explicit allowlist, CRC validation, and a per-file SHA-256 manifest.
- A separate extraction served production HTML and compiled JavaScript and started a solo room through an authenticated WebSocket with five private memories. It used installed Python requirements and no frontend node_modules.

## Remaining coverage and limits (initial release; see current STATUS.md)

- Physical touch devices, Firefox, and Safari remain untested. Responsive viewport checks do not replace device testing.
- Adverse real-network conditions and sustained load remain untested. Simulation and socket ownership require one worker.
- No real paid Archivist request has been made. The game was played with AI disabled.
- Superseded: Render has now built and run the Docker image, and hosted Neon PostgreSQL has been verified.
- Phaser is lazy-loaded; its production chunk is about 339 KB gzip. No low-end device frame-rate claim is made.
- An abrupt crash may lose up to five seconds of position updates. Durable actions save immediately. Reconnect identity belongs to the same browser tab session.
- Superseded: public hosting is live at https://i-swear-game.onrender.com; current checks and limits are in STATUS.md.
