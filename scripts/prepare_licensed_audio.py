"""Download the two CC0 releases and build bounded-memory game loops (FFmpeg required)."""
from pathlib import Path
import hashlib
import json
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'artifacts/.trailer-work/audio-sources'
TRACKS = {
    'lobby': ('Moil', 'Ruskerdax', 'https://opengameart.org/content/moil',
              'https://opengameart.org/sites/default/files/ruskerdax_-_moil.mp3', 'moil.mp3'),
    'investigation': ('Unsolved Investigation', 'isaiah658', 'https://opengameart.org/content/unsolved-investigation',
                      'https://opengameart.org/sites/default/files/Unsolved-Investigation-isaiah658_0.ogg', 'investigation.ogg'),
}

def build():
    SOURCES.mkdir(parents=True, exist_ok=True)
    metadata = {}
    for key, (title, artist, source, download, filename) in TRACKS.items():
        original = SOURCES / filename
        if not original.exists():
            urllib.request.urlretrieve(download, original)
        destination = ROOT / f'frontend/public/audio/{key}-theme.mp3'
        command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y']
        if key == 'lobby':
            command += ['-ss', '20', '-t', '62']
        command += ['-i', str(original)]
        if key == 'lobby':
            command += ['-filter_complex', '[0:a]asplit=2[a][b];[a]atrim=start=2:end=62,asetpts=PTS-STARTPTS[body];[b]atrim=end=2,asetpts=PTS-STARTPTS[head];[body][head]acrossfade=d=2:c1=tri:c2=tri,volume=0.72[out]', '-map', '[out]']
        else:
            command += ['-af', 'volume=0.72']
        command += ['-ar', '32000', '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '128k', '-metadata', f'title={title}', '-metadata', f'artist={artist}', str(destination)]
        subprocess.run(command, check=True)
        digest = hashlib.sha256(destination.read_bytes()).hexdigest()
        metadata[key] = dict(title=title, artist=artist, source=source, license='CC0-1.0',
                             file=f'/audio/{key}-theme.mp3?v={digest[:10]}', duration=60 if key=='lobby' else 48,
                             source_sha256=hashlib.sha256(original.read_bytes()).hexdigest())
    (ROOT/'frontend/src/game/score.json').write_text(json.dumps(metadata, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({key: {'title':item['title'], 'duration':item['duration']} for key,item in metadata.items()}))

if __name__ == '__main__':
    build()
