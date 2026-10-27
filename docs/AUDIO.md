# Lobby theme

Everybody Has a Version is an original 16-bar, 78 BPM composition for I SWEAR. Soft synthesized keys, a sparse melody, bass and brushed percussion share the game's quiet mystery tone. The score and instrument synthesis are in scripts/make_lobby_music.py. It uses no external recordings, sampled instruments or third-party songs.

frontend/public/audio/lobby-theme.mp3 is the 49.230771-second stereo master, encoded at 128 kbps (about 789 KB). NumPy and ffmpeg reproduce it; the intermediate WAV stays outside the release archive. The uncompressed signal peaks at 0.64, has no clipping, and its loop boundary changes by only 0.00054 of full scale. The MP3 fully decodes without errors.

Open the gear on the menu or in a room. Lobby music has its own toggle and volume, alongside master volume and mute. Preferences persist in local storage. Browser interaction unlocks audio; loading never starts merely from opening the page. The same decoded buffer and looping source continue from the menu into the witness room. Starting a case fades the theme out and stops its source after 650 ms, retaining quiet world ambience. Hidden tabs pause music. Returning to a visible lobby resumes it without downloading again.

Music is rendered ahead of time, with no per-frame JavaScript synthesis. Unit tests verify first-interaction gating, a single loop, buffer reuse, fades, menu/lobby transitions, master mute, the music toggle, hidden-page behavior, failed downloads and retry. Browser checks cover menu and lobby playback, saved music-off after reload, starting a four-witness case, and a 390px-wide settings layout. Physical speaker quality and other browser engines are not part of those checks.
