# Presentation assets

- campus-3d.jpg and campus-3d-inspection.jpg: actual running screenshots of the new 3D campus and its cached mesh evidence view. Earlier gameplay/trailer images below document the illustrated release.
- campus-3d-live.jpg: the deployed 3D game over public HTTPS. campus-3d-mobile.jpg shows the responsive viewport; it is a desktop browser emulation, not an actual phone capture.

- submission-cover.jpg: dedicated 1200 × 800 (3:2) illustrated cover, composed from the game's campus SVG and four original witness characters. i-swear-cover.svg is its vector source; scripts/make_cover.cjs reproduces it using Sharp and existing frontend tooling. The public copy also supplies the link's social preview.
- title-screen.jpg: original public title-screen screenshot, retained separately.
- i-swear-audio-preview.mp3: 23 seconds of the revised lobby score, paper/stamp pickup and new investigation score. Original music and effects live in frontend/public/audio, with reproducible synthesis in scripts/make_game_audio.py and details in docs/AUDIO.md. The source/build archive includes the suite.
- gameplay.jpg, lobby.jpg, inspection.jpg, memories.jpg, testimony.jpg, reconstruction-board.jpg, ferry.jpg, ferry-plan.jpg, voice-chat.jpg: actual running UI captures, where present.
- casefile-motive.jpg, casefile-board.jpg, casefile-reveal.jpg: screenshots of the new private dossier, linked evidence, and incident sequence.
- i-swear-trailer.mp4: 47 seconds, 1280 × 720 H.264/AAC; 17 seconds of real moving world footage, actual UI captures, and authored typography.
- i-swear-gameplay.mp4: 75.7 seconds, 1280 × 720 H.264/AAC; full 29.7-second world recording plus explicitly labelled UI stills.
- world-source.webm: original canvas capture with synthesized game audio; about 13.47 average source frames/second. Videos use 30 fps output containers without interpolation. They document the earlier release; the new casefile UI is shown in the casefile screenshots.
- i-swear-local-release.zip and .sha256: source/build/media archive and checksum; internal MANIFEST.json hashes included files.

World imagery is authored SVG/Phaser geometry; no raster image-generation service was used. No fabricated gameplay states, microphone audio, private data, credentials, or databases are included.

.trailer-work/ and video-check.jpg are excluded intermediates. Older results.jpg, share-card.png, and transition captures are retained as legacy release evidence and are not the current cover or trailer.
