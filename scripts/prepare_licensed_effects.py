"""Prepare Kenney's CC0 effects from the author's OpenGameArt upload."""
from pathlib import Path
import hashlib
import json
import subprocess
import urllib.request
import zipfile

ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip'
TRACKS={'record-pickup.wav':('confirmation_002.ogg',.70), 'paper-inspect.wav':('click_003.ogg',.55),
        'memory-clash.wav':('error_004.ogg',.45), 'case-reveal.wav':('confirmation_004.ogg',.65)}

def build():
    work=ROOT/'artifacts/.trailer-work/kenney';work.mkdir(parents=True,exist_ok=True)
    archive=work/'interface.zip'
    if not archive.exists() or not zipfile.is_zipfile(archive):
        urllib.request.urlretrieve(SOURCE,archive)
    manifest={'artist':'Kenney','license':'CC0-1.0','page':'https://kenney.nl/assets/interface-sounds',
              'download':SOURCE,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'effects':{}}
    with zipfile.ZipFile(archive) as package:
        public=ROOT/'frontend/public/audio'
        (public/'KENNEY-LICENSE.txt').write_bytes(package.read('License.txt'))
        for output,(name,gain) in TRACKS.items():
            original=work/name;original.write_bytes(package.read('Audio/'+name))
            destination=public/output
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(original),'-af',f'volume={gain}',
                            '-ar','44100','-ac','1','-c:a','pcm_s16le',str(destination)],check=True)
            manifest['effects'][output]={'source':name,'gain':gain,'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()}
    (public/'sfx-credits.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print('Prepared four CC0 effects with source hashes and licence.')

if __name__=='__main__':
    build()
