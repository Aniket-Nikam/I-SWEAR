# Release

The public game is https://i-swear-game.onrender.com. One Render Free Docker service in Singapore serves the client, API, game sockets, and voice sockets. Neon Free PostgreSQL persists accounts, checkpoints, and replays. Render built and ran the container successfully.

The current service imports a public Git URL; Git pushes alone did not deploy it. Publish with **Manual Deploy → Deploy latest commit** after pushing master. The existing deployment-policy setting is unchanged. The committed Blueprint is reproducible configuration, not a currently linked Blueprint manager.

## Portable package

artifacts/i-swear-local-release.zip includes source, compiled client, tests, docs, cover, and videos. Extract it, create a Python 3.11 environment in backend, install requirements.txt, and start Uvicorn as shown in README.md. Node is needed only to rebuild the client. Regenerate with python scripts/package_release.py. An internal manifest and external SHA-256 checksum protect integrity.

## Runtime contract

- One Uvicorn worker; HTTPS and WebSocket upgrades.
- Same-origin frontend/API; /api/health exposes no credentials.
- External SQLAlchemy PostgreSQL URL with the bundled psycopg driver, or persistent SQLite.
- COOKIE_SECURE=1 and ARCHIVIST_ENABLED=0 publicly.
- WebSocket query credentials stay out of access logs. Audio is never persisted.

## Verification

From backend with requirements installed:

```powershell
python -m pytest -q
python scripts/check_public_accounts.py --url https://i-swear-game.onrender.com
python scripts/check_public_voice.py --url https://i-swear-game.onrender.com
python scripts/smoke_match.py --url https://i-swear-game.onrender.com
```

Scripts create their own QA identities/rooms and never modify someone else's match. Voice tests use synthetic samples, never a microphone. Physical device and load coverage remain separate.

See SUBMISSION.md and artifacts/README.md for presentation assets and provenance. The showcase labels its UI still sections.
