# Public hosting

The game uses one Render Free Docker web service in Singapore and Neon Free PostgreSQL in the same region. A single Uvicorn worker owns rooms and WebSocket connections; do not add workers or replicas without introducing a shared room engine.

`render.yaml` is the reproducible service definition. Set `DATABASE_URL` through Render's secret environment settings using a Neon SQLAlchemy URL beginning `postgresql+psycopg://` with TLS enabled. Never commit the connection string. `COOKIE_SECURE=1` protects account cookies over HTTPS; `ARCHIVIST_ENABLED=0` keeps the complete game free of model calls.

Free Render services sleep after inactivity. The first visitor may wait roughly a minute for the service to wake. Keep the game open before presenting it. The database persists accounts, room checkpoints, and replay records across deployments; local container files are ephemeral. Neon can also suspend its compute when idle.

The current service imports a public Git URL. A push to master did not trigger automatic deployment, so publish using Render's Manual Deploy → Deploy latest commit. Its existing deployment-policy setting is unchanged. Check `/api/health`, then run `backend/scripts/smoke_match.py --url https://i-swear-game.onrender.com` against a new QA room. Deployments can briefly disconnect sockets; clients reconnect to their saved room records.

Accounts are optional and use a username, display name, and password. Passwords use Argon2id; sessions are stored as hashes and sent in HttpOnly, Secure, SameSite cookies. No email is collected and no password recovery flow is provided. Guests can use every game feature.
