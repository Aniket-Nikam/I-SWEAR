# Verification record

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

## Remaining coverage and limits

- Physical touch devices, Firefox, and Safari remain untested. Responsive viewport checks do not replace device testing.
- Adverse real-network conditions and sustained load remain untested. Simulation and socket ownership require one worker.
- No real paid Archivist request has been made. The game was played with AI disabled.
- Docker's engine was stopped; the prepared image has not been built or run. PostgreSQL remains untested.
- Phaser is lazy-loaded; its production chunk is about 339 KB gzip. No low-end device frame-rate claim is made.
- An abrupt crash may lose up to five seconds of position updates. Durable actions save immediately. Reconnect identity belongs to the same browser tab session.
- Public hosting is deferred at the user's request.
