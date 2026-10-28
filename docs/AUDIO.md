# Game audio

Lobby: **Moil — Ruskerdax**, [source and CC0 declaration](https://opengameart.org/content/moil).
Investigation: **Unsolved Investigation — isaiah658**, [source and CC0 declaration](https://opengameart.org/content/unsolved-investigation).
Both releases use the [CC0 public-domain dedication](https://creativecommons.org/publicdomain/zero/1.0/). The game credits both artists in Settings and serves `/audio/CREDITS.md`.

| Asset | Editing and delivery |
| --- | --- |
| lobby-theme.mp3 | Source excerpt 20–82 seconds, two-second wrap crossfade; 60-second loop, 32 kHz stereo, 128 kbps MP3 |
| investigation-theme.mp3 | Original seamless 48-second loop, 32 kHz stereo, 128 kbps MP3 |
| record-pickup.wav | Original paper/stamp and three-note glass effect, 0.95 seconds, mono PCM16 |
| paper-inspect.wav | Original paper/wood inspection click, 0.18 seconds, mono PCM16 |

Run `python scripts/prepare_licensed_audio.py` with FFmpeg to download and prepare the tracks. Source hashes, titles, artist names, licence and cache versions are recorded in `frontend/src/game/score.json`. Originals stay in ignored `artifacts/.trailer-work/audio-sources` and outside the release package. `make_game_audio.py` retains the earlier original composer as source history; its default entry point now rebuilds only effects so it cannot silently overwrite the licensed tracks.

The 22-second `artifacts/i-swear-audio-preview.mp3` presents lobby, pickup and investigation in that order.

The Audio page includes master mute/volume, independent music/effects levels, music on/off, current title/playback state, credits and Preview pickup. Preferences persist, including older music-off choices. Browser interaction enables audio.

Menu and lobby share one source. Investigation crossfades to its own track; reveal/results pause music. Sources fade and disconnect after 1.2 seconds. Only the current decoded score is retained after transitions: at a 48 kHz stereo context the longest loop uses about 23 MB, with a temporary second buffer during crossfade. There is no per-frame music synthesis or additional multiplayer traffic.

Hidden tabs fade music and effects. Voice activity lowers music to 32% of its selected level. Pickups lower it to 62% for about one second without overriding stronger speech ducking. Remote discoveries are quieter; duplicate cues are suppressed and sampled effects are bounded to four overlapping voices. Missing effects use an immediate soft fallback.

The recording bus captures game music and effects only. Voice audio and microphones stay separate. Automated lifecycle checks cover gesture gating, scene transitions, buffer eviction, crossfades, hidden pages, mute, retries, ducking, duplicate suppression, voice bounds and capture routing. Browser checks cover the Settings recording start/stop/download flow. Physical speaker quality and other browser engines still need broader listening checks.
