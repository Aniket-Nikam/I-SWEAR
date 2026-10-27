# Movement and rendering update

## Casefile release / 2026-10-27

The new clock updates only its subscribing widgets once per second. Motives and deductions use ordinary reliable actions; no new gameplay feature adds per-frame React work. Socket writers cap queued messages and bytes, merge movement deltas by witness, coalesce clock updates, and disconnect a stalled writer after eight seconds. Tests cover the important stopped-witness case, ordering, immutable queued events and a stalled listener beside a working listener.

The client checks for missing heartbeat replies, replaces a half-open connection, discards old transport callbacks and restores a fresh server snapshot. It never replays stale movements or board edits.

Database checkpoints coalesce into one background writer rather than blocking a witness's next input. Replay and account statistics save idempotently off the simulation loop. A committed replay reconciles a stale room checkpoint on recovery. WebGL resize dimensions are clamped to avoid zero-size attachments during panel/viewport changes.

In the local final rehearsal, Settings reported 92 FPS and a 12.3 ms sampled 95th-percentile frame interval, without recording. Simultaneous four-client campus and eight-client ferry cases completed in 180/183 seconds, each with thirteen records, 100% recovery, reconnect, host migration, stale-edit rejection, saved replay and rematch. These are measured scenarios, not broad hardware or adverse-network guarantees.

The original campus renderer repeatedly processed thousands of static vector commands every frame. A local Chromium check at the same desktop viewport, without recording, measured 11–14 FPS (a sampled 95th-percentile frame interval of 97.6 ms). After caching the same artwork into 1024px texture tiles, the campus measured 78–84 FPS, with a sampled 95th-percentile interval of 14.5 ms. Observatory and ferry were also inspected and remained above 60 FPS in this session; observatory recording measured 97 FPS. These are local observations, not cross-device or network guarantees.

The local witness now responds to input on the next rendered frame. The server publishes the last input sequence, direction and velocity with its existing position updates. The client replays pending input over a bounded latency window and smooths small corrections. The server continues to own collision, speed, evidence and all match decisions. Remote witnesses interpolate a short packet buffer and limit extrapolation after a gap. Camera following uses elapsed time rather than a fixed per-frame blend.

Map textures preserve the original depth ordering, room signs and furniture. If allocation fails, the original vector map remains available. Tiles and original drawing resources are destroyed with the scene. Recording prefers VP8 at 24 FPS and a lower bitrate to reduce encoding work. Settings displays real frame rate and connection round-trip latency; frame rate uses actual intervals rather than Phaser's smoothed delta.

Verification: 60 backend tests, 18 client tests and a production build pass. Tests include a simulated 160 ms round trip, normalized movement at different frame rates, wall sliding, delayed stop input, reconnect reset and bounded remote extrapolation. A complete four-client local match reached 100% recovery, delivered results to all clients, saved its replay and started a changed rematch. Held-key movement and release were also checked in the browser against the authoritative floor-plan position. The dedicated cover is original key art; gameplay captures remain separately available.
