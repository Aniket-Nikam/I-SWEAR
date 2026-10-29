"""Reproduce credited CC0 creature excerpts with FFmpeg; verify originals first."""
from hashlib import sha256
from pathlib import Path
import subprocess
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/"artifacts/.trailer-work/horror-source"
SOURCES={
 "growl":("monster-snarls_0.ogg","7401193d0cc5eb193379cf326c8868d6823a284ebc32ffaa298c1a94d2e25994"),
 "attack":("monster-snarl-attack.ogg","34bf1ceef265725abf00ab3263bbbb492792e126bb1619addd4a5d3ad123347f"),
}

def main():
 CACHE.mkdir(parents=True,exist_ok=True)
 for kind,(filename,digest) in SOURCES.items():
  original=CACHE/f"{kind}.ogg"
  if not original.exists():
   request=Request("https://opengameart.org/sites/default/files/"+filename,headers={"User-Agent":"I-SWEAR-audio-preparation"})
   with urlopen(request,timeout=60) as response:
    data=response.read(10*1024*1024+1)
   if len(data)>10*1024*1024:raise ValueError("Unexpected source size")
   if sha256(data).hexdigest()!=digest:raise ValueError("Source hash changed; review licence and source")
   original.write_bytes(data)
  if sha256(original.read_bytes()).hexdigest()!=digest:raise ValueError("Cached source hash mismatch")
  output=ROOT/f"frontend/public/audio/unsaid-{kind}.ogg"
  subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(original),"-t","3.4","-af","loudnorm=I=-19:TP=-6:LRA=7","-ar","44100","-ac","1","-c:a","libvorbis","-q:a","4",str(output)],check=True)
  print(f"{output.relative_to(ROOT)}: {output.stat().st_size} bytes")

if __name__=="__main__":main()
