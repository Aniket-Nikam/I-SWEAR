# Release package

The repository includes a production client build, a same-origin FastAPI static server, Dockerfile, persistent Docker Compose volume, and GitHub Actions checks. The user selected a local release; public hosting is deferred.

`artifacts/i-swear-local-release.zip` contains source, the compiled client, and a SHA-256 manifest. Extract it, create a Python 3.11 environment in `backend`, install `requirements.txt`, and run Uvicorn as shown in the README. Node is needed only to rebuild the included client. Regenerate the archive with `python scripts/package_release.py` after building. Submission field text and the cover specification are in `docs/SUBMISSION.md`.

## Host contract

- One Python game worker; do not use multiple Uvicorn workers or stateless function hosting.
- HTTPS termination and WebSocket upgrades with an idle timeout suitable for a full match.
- Persistent `/data` for SQLite, or `DATABASE_URL` plus a PostgreSQL driver for an external database.
- `PORT` defaults to 8080 in the container. `/api/health` is the health probe.
- Exact separate frontend origins in `ALLOWED_ORIGINS`; same-origin clients work without extra entries.
- Keep API keys server-only. Disable access logs or redact WebSocket query credentials at the proxy.

The Docker engine on the development machine was stopped, so the image has not been built or run here. The equivalent single-server production build was served and opened successfully in the browser. PostgreSQL and multiple-host deployment are untested.

## Verification after deployment

Open the public URL and finish the solo rehearsal without an API key. Join a second browser using the room QR. Run `python scripts/smoke_match.py --url https://YOUR_GAME_HOST` to exercise four real connections in a disposable QA room. Restart the service and confirm an active browser reconnects with its evidence intact. Check that replay URLs work after rematch and after restart.

## Presentation assets

Use `docs/DEMO_SCRIPT.md` for the judge walkthrough. The in-game **Share card** action exports a verified 1080 × 1920 PNG suitable for Stories or messaging. Saved replay URLs provide the interactive result and challenge CTA. `artifacts/share-card.png`, when present, is a real downloaded result from the tested build.

Before a public competition submission, complete physical mobile, Chrome/Firefox/Safari, adverse network, and target-host load checks recorded in `docs/QA.md`. These are pending coverage, not claims of a passed gate.
