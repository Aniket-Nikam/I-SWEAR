# Original game audio

The score and instruments are authored in `scripts/make_game_audio.py`, using NumPy and ffmpeg. No external recordings, sampled instruments, third-party songs, or image/audio generation service is used. `scripts/make_lobby_music.py` remains a compatible entry point for rebuilding the complete suite. Lossless intermediate masters stay outside the release archive.

| Asset | Composition | Delivery |
| --- | --- | --- |
| `lobby-theme.mp3` | Everybody Has a Version: 16 bars at 84 BPM, felt piano, plucked strings, warm detuned harmony, bass and brushed percussion | 45.714 seconds, stereo 44.1 kHz, 128 kbps, 732,362 bytes |
| `investigation-theme.mp3` | Footnotes After Midnight: 16 bars at 64 BPM, sparse plucked pulse, dark strings, glass accents and restrained percussion | 60 seconds, stereo 44.1 kHz, 128 kbps, 960,987 bytes |
| `record-pickup.wav` | Paper flick, wooden stamp and a short three-note glass accent | 0.95 seconds, mono 44.1 kHz PCM16 |
| `paper-inspect.wav` | Soft paper/wood inspection click | 0.18 seconds, mono 44.1 kHz PCM16 |

The 23-second `artifacts/i-swear-audio-preview.mp3` presents the lobby, pickup and investigation in that order. Both score masters peak at 0.72 before encoding; RMS levels are approximately 0.141 and 0.139. Their PCM loop-boundary changes are 0.01154 and 0.00148 of full scale. Pickup peak is 0.68. The release MP3s and pickup decode fully without errors. These measurements check signal integrity; speaker quality remains subjective.

Open Settings for master volume/mute, Music toggle/volume, Sound effects volume and Preview pickup. Preferences persist locally, including older music-off settings. The current track title and loading/playback state appear beside the music controls. Audio starts only after a browser interaction.

Menu and lobby share one source. Starting an investigation crossfades to the quieter case score; reveal/results pause music. Sources fade and disconnect after 1.2 seconds. Rapid scene changes reuse a fading source. Only the current scene's decoded score is retained after transitions (about 23 MB at a 48 kHz context); the previous source temporarily retains its own buffer during the crossfade. Scores are rendered ahead of time, with no per-frame synthesis or additional multiplayer messages.

Hidden tabs fade music and effects. Voice activity lowers music to 32% of its selected level. Pickups lower it to 62% for approximately one second without overriding a stronger voice duck. Remote discoveries play more quietly; a local pickup takes precedence over a simultaneous remote one. Duplicate inspection/pickup cues are suppressed, and sampled effects are bounded to four overlapping voices. Missing effects use an immediate soft fallback, with no delayed playback after downloading.

The existing recording bus captures game music and effects only. Voice audio and microphones stay separate and are never included. Eleven audio lifecycle tests cover gesture gating, scene transitions, buffer eviction, rapid crossfades, hidden pages, mute, failures/retry, speech/discovery ducking, duplicate suppression, voice bounds and capture routing. Three Settings tests cover preference migration/persistence, credits, preview and silent controls. Physical speakers, microphone acoustics and other browser engines require separate listening checks.
