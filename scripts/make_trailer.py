"""Author the trailer and an honest gameplay showcase from actual game captures.

No UI automation, simulated gameplay, downloaded assets, or generated art. The
only authored visuals are typographic cards, borders and labels. The gameplay
showcase explicitly labels UI stills and retains the uninterrupted world clip.
Requires Pillow and ffmpeg/ffprobe on PATH.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
import os
from pathlib import Path
import shutil
import subprocess

from PIL import Image, ImageDraw, ImageFont, ImageOps


SIZE = (1280, 720)
INK = "#101d27"
PAPER = "#f2e4c8"
CORAL = "#ef805f"
STRAW = "#ecc574"
SAGE = "#b2ceba"
RULE = "#52707a"


@dataclass
class Scene:
    kind: str
    seconds: float
    title: str
    source: str = ""
    subtitle: str = ""
    start: float = 0


class Film:
    def __init__(self, artifacts: Path):
        self.artifacts = artifacts.resolve()
        self.work = self.artifacts / ".trailer-work"
        self.work.mkdir(parents=True, exist_ok=True)
        self.ffmpeg = shutil.which("ffmpeg")
        self.ffprobe = shutil.which("ffprobe")
        if not self.ffmpeg or not self.ffprobe:
            raise RuntimeError("ffmpeg and ffprobe must be available on PATH.")
        self.source = self.artifacts / "world-source.webm"
        if not self.source.is_file():
            raise FileNotFoundError(self.source)
        fonts = Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts"
        self.display_font = fonts / "impact.ttf"
        self.label_font = fonts / "arialbd.ttf"
        self.mono_font = fonts / "cour.ttf"
        self.caption_font = fonts / "arial.ttf"
        packets = json.loads(subprocess.check_output([
            self.ffprobe, "-v", "error", "-select_streams", "v:0", "-show_packets",
            "-show_entries", "packet=pts_time", "-of", "json", str(self.source)]))
        timestamps = [float(p["pts_time"]) for p in packets["packets"] if "pts_time" in p]
        if len(timestamps) < 2:
            raise RuntimeError("World capture contains fewer than two real frames.")
        self.source_seconds = max(timestamps) - min(timestamps)
        self.source_fps = (len(timestamps) - 1) / self.source_seconds
        self.audio = self.work / "original-game-audio.wav"
        self.run(["-i", str(self.source), "-map", "0:a:0", "-c:a", "pcm_s16le", str(self.audio)])
        self.world_still = self.work / "observatory-frame.png"
        self.run(["-ss", "8", "-i", str(self.source), "-frames:v", "1", "-update", "1", str(self.world_still)])

    def run(self, arguments: list[str]) -> None:
        subprocess.run([self.ffmpeg, "-hide_banner", "-loglevel", "error", "-y", *arguments], check=True)

    def font(self, size: int, role: str = "display") -> ImageFont.FreeTypeFont:
        path = {"display": self.display_font, "label": self.label_font,
                "mono": self.mono_font, "body": self.caption_font}[role]
        return ImageFont.truetype(str(path), size)

    def text(self, draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str,
             size: int, color: str = PAPER, role: str = "display", spacing: int = 4) -> None:
        draw.multiline_text(xy, text, font=self.font(size, role), fill=color, spacing=spacing,
                            stroke_width=0)

    def fitted_text(self, draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str,
                    width: int, size: int, color: str = PAPER, role: str = "display") -> None:
        while draw.textbbox((0, 0), text, font=self.font(size, role))[2] > width:
            size -= 1
        self.text(draw, xy, text, size, color, role)

    def base(self, label: str, *, paper: bool = False) -> Image.Image:
        image = Image.new("RGB", SIZE, PAPER if paper else INK)
        draw = ImageDraw.Draw(image)
        fg = INK if paper else PAPER
        draw.line((64, 51, 1216, 51), fill=RULE, width=1)
        self.text(draw, (64, 20), "I SWEAR", 22, fg)
        self.text(draw, (168, 25), "/  EVERYBODY HAS A VERSION.", 12, fg, "mono")
        self.fitted_text(draw, (870, 24), label.upper(), 346, 12, fg, "mono")
        return image

    def choose(self, *names: str) -> str:
        for name in names:
            if (self.artifacts / name).is_file():
                return name
        raise FileNotFoundError("None of these actual captures exists: " + ", ".join(names))

    def shot(self, name: str) -> Image.Image:
        path = self.artifacts / name
        if not path.is_file():
            raise FileNotFoundError(path)
        return Image.open(path).convert("RGB")

    def card(self, scene: Scene, index: int, total: int) -> Image.Image:
        paper = scene.kind in {"opening", "end"}
        label = {"showcase_intro": "GAMEPLAY SHOWCASE", "still": "IN-GAME CAPTURE",
                 "world": "WORLD CAPTURE", "end": "PLAY FREE"}.get(scene.kind, "TRAILER")
        image = self.base(label, paper=paper)
        draw = ImageDraw.Draw(image)
        fg = INK if paper else PAPER
        if scene.kind == "opening":
            self.text(draw, (66, 112), "YOU WERE", 136, INK)
            self.text(draw, (66, 275), "ALL THERE.", 168, INK)
            draw.rectangle((70, 502, 1208, 514), fill=CORAL)
            self.text(draw, (72, 555), "ONE INCIDENT. DIFFERENT MEMORIES.", 24, INK, "mono")
            self.text(draw, (1130, 613), "01", 38, INK, "mono")
        elif scene.kind == "end":
            self.text(draw, (65, 95), "I SWEAR", 224, INK)
            self.text(draw, (846, 108), "!", 224, CORAL)
            self.text(draw, (74, 389), "A SOCIAL MYSTERY ABOUT MEMORY.", 29, INK, "label")
            draw.rectangle((72, 458, 1208, 461), fill=INK)
            self.text(draw, (74, 493), "PLAY FREE", 28, INK, "mono")
            self.fitted_text(draw, (70, 541), "i-swear-game.onrender.com", 1135, 63, INK, "label")
            self.text(draw, (74, 638), "BRING YOUR VERSION.", 20, INK, "mono")
        elif scene.kind == "showcase_intro":
            self.text(draw, (68, 129), "EVERYBODY HAS", 106)
            self.text(draw, (68, 256), "A VERSION.", 144, CORAL)
            draw.line((74, 476, 1208, 476), fill=RULE, width=2)
            self.text(draw, (74, 513), "GAMEPLAY SHOWCASE", 29, PAPER, "mono")
            self.text(draw, (74, 566), "Actual world footage + labeled captures of the game UI.", 24, SAGE, "body")
        elif scene.kind == "cases":
            self.text(draw, (64, 86), "EXPLORE THREE INCIDENTS.", 72)
            sources = [self.shot(self.choose("blackout.jpg", "gameplay.jpg")),
                       Image.open(self.world_still).convert("RGB"), self.shot(self.choose("ferry.jpg"))]
            labels = [("01", "THE BLACKOUT"), ("02", "THE OBSERVATORY"), ("03", "THE NIGHT CROSSING")]
            for i, (source, (number, title)) in enumerate(zip(sources, labels)):
                x = 64 + i * 386
                draw.rectangle((x, 210, x + 356, 552), fill=RULE)
                # These panels crop actual capture pixels; they introduce no scene artwork.
                panel = ImageOps.fit(source, (352, 338), method=Image.Resampling.LANCZOS)
                image.paste(panel, (x + 2, 212))
                self.text(draw, (x, 577), number, 24, CORAL, "mono")
                self.fitted_text(draw, (x, 616), title, 355, 30, PAPER)
        elif scene.kind == "world":
            self.text(draw, (64, 106), scene.title, 70, PAPER, spacing=0)
            draw.rectangle((68, 407, 420, 413), fill=CORAL)
            self.text(draw, (68, 445), scene.subtitle, 22, SAGE, "body", spacing=10)
            self.text(draw, (68, 639), "ACTUAL WORLD FOOTAGE", 14, SAGE, "mono")
            draw.rectangle((490, 74, 1218, 706), outline=RULE, width=2)
        else:
            # Preserve the entire screenshot, never stretching or redrawing its UI.
            still = self.shot(scene.source)
            if still.size != SIZE:
                still = ImageOps.contain(still, SIZE, method=Image.Resampling.LANCZOS)
            still = ImageOps.contain(still, (1152, 648), method=Image.Resampling.LANCZOS)
            image.paste(still, ((1280 - still.width) // 2, 57))
            draw = ImageDraw.Draw(image)
            draw.rectangle((63, 56, 1216, 706), outline=RULE, width=1)
            # A quiet footer explicitly identifies stills instead of implying live video.
            draw.rectangle((64, 670, 1215, 705), fill=INK)
            self.text(draw, (76, 679), scene.title.upper(), 18, PAPER, "label")
            self.text(draw, (981, 682), "IN-GAME UI / STILL", 12, SAGE, "mono")
        if scene.kind not in {"end", "world"}:
            self.text(draw, (1160, 678), f"{index:02d}/{total:02d}", 11, fg, "mono")
        return image

    def encode_scene(self, scene: Scene, target: Path, index: int, total: int) -> None:
        background = target.with_suffix(".png")
        self.card(scene, index, total).save(background)
        arguments = ["-loop", "1", "-framerate", "30", "-i", str(background)]
        duration = scene.seconds
        fade = f"fade=t=in:st=0:d=0.12,fade=t=out:st={max(0, duration-.12):.4f}:d=0.12"
        if scene.kind == "world":
            arguments += ["-ss", str(scene.start), "-i", str(self.source), "-filter_complex",
                          "[1:v]setpts=PTS-STARTPTS,scale=720:624:force_original_aspect_ratio=decrease,"
                          "pad=720:624:(ow-iw)/2:(oh-ih)/2:color=0x101d27,fps=30[world];"
                          f"[0:v][world]overlay=494:78:shortest=1,{fade},format=yuv420p[v]",
                          "-map", "[v]"]
        else:
            arguments += ["-vf", f"{fade},format=yuv420p"]
        arguments += ["-t", f"{duration:.6f}", "-an", "-c:v", "libx264", "-crf", "19",
                      "-preset", "fast", "-threads", "4", "-r", "30", "-video_track_timescale", "30000", str(target)]
        self.run(arguments)

    def assemble(self, name: str, scenes: list[Scene]) -> dict:
        segments = []
        total = sum(scene.seconds for scene in scenes)
        for index, scene in enumerate(scenes, 1):
            target = self.work / f"{name}-{index:02d}.mp4"
            print(f"{name} {index}/{len(scenes)}: {scene.title.replace(chr(10), ' ')}", flush=True)
            self.encode_scene(scene, target, index, len(scenes))
            segments.append(target)
        manifest = self.work / f"{name}.ffconcat"
        def quote(path: Path) -> str:
            return "'" + path.as_posix().replace("'", "'\\''") + "'"
        manifest.write_text("ffconcat version 1.0\n" + "\n".join(f"file {quote(p)}" for p in segments) + "\n", encoding="utf-8")
        output = self.artifacts / f"i-swear-{name}.mp4"
        # Actual game audio supplies the editorial bed. No microphone or stock music.
        self.run(["-f", "concat", "-safe", "0", "-i", str(manifest), "-stream_loop", "-1", "-i", str(self.audio),
                  "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-af",
                  f"volume=0.75,afade=t=in:st=0:d=0.5,afade=t=out:st={total-1:.6f}:d=1",
                  "-c:a", "aac", "-b:a", "160k", "-t", f"{total:.6f}", "-movflags", "+faststart",
                  "-metadata", "title=I SWEAR | " + ("Trailer" if name == "trailer" else "Gameplay showcase"),
                  "-metadata", "comment=Actual world footage and labeled in-game UI stills. Audio from original game capture.",
                  str(output)])
        metadata = json.loads(subprocess.check_output([
            self.ffprobe, "-v", "error", "-show_entries",
            "stream=codec_name,width,height,avg_frame_rate:format=duration,size", "-of", "json", str(output)]))
        report = {"path": str(output), "source_average_fps": self.source_fps,
                  "moving_footage_seconds": sum(s.seconds for s in scenes if s.kind == "world"),
                  "audio": "Original captured game audio, looped as an editorial bed.",
                  "edit": [s.__dict__ for s in scenes], "probe": metadata}
        (self.work / f"{name}-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        self.contact_sheet(output, scenes)
        return report

    def contact_sheet(self, output: Path, scenes: list[Scene]) -> None:
        canvas = Image.new("RGB", (1280, 792), INK)
        draw = ImageDraw.Draw(canvas)
        samples = []
        world_samples = []
        cursor = 0.0
        for scene in scenes:
            samples.append(cursor + scene.seconds / 2)
            if scene.kind == "world":
                world_samples.extend((cursor + scene.seconds / 4, cursor + scene.seconds * .75))
            cursor += scene.seconds
        samples = sorted(samples + world_samples[:max(0, 12-len(samples))])
        for i, timestamp in enumerate(samples):
            frame = self.work / f"{output.stem}-sample-{i:02d}.jpg"
            self.run(["-ss", str(timestamp), "-i", str(output), "-frames:v", "1", "-update", "1", str(frame)])
            image = Image.open(frame).convert("RGB").resize((416, 234), Image.Resampling.LANCZOS)
            x, y = i % 3 * 432, i // 3 * 198
            image.thumbnail((416, 174))
            canvas.paste(image, (x, y + 20))
            self.text(draw, (x + 4, y + 3), f"{timestamp:05.1f}s", 13, PAPER, "mono")
        canvas.save(self.work / f"{output.stem}-contactsheet.jpg", quality=94)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifacts", type=Path, default=Path(__file__).resolve().parents[1] / "artifacts")
    parser.add_argument("--only", choices=["all", "trailer", "gameplay"], default="all")
    args = parser.parse_args()
    film = Film(args.artifacts)
    lobby = film.choose("lobby.jpg")
    title = film.choose("title-screen.jpg", "lobby.jpg")
    memories = film.choose("memories.jpg")
    inspection = film.choose("inspection.jpg")
    testimony = film.choose("testimony.jpg")
    reconstruction = film.choose("reconstruction-board.jpg", "reconstruction.jpg")
    ferry = film.choose("ferry.jpg")
    reveal = film.choose("reveal.jpg")
    trailer = [
        Scene("opening", 3, "You were all there."),
        Scene("world", 10, "NOBODY\nREMEMBERS IT\nTHE SAME.", subtitle="Walk the rooms.\nFind what everyone missed."),
        Scene("cases", 4, "Explore three incidents."),
        Scene("still", 3, "Everybody has a version.", lobby),
        Scene("still", 4, "Keep your own memory.", memories),
        Scene("still", 4, "Compare testimony.", testimony),
        Scene("still", 4, "Reconstruct reality.", reconstruction),
        Scene("world", 7, "WHAT WILL\nYOU SWEAR\nIS TRUE?", subtitle="A social mystery\nabout memory.", start=18),
        Scene("still", 2, "Bring your version.", title),
        Scene("end", 6, "I SWEAR"),
    ]
    gameplay = [
        Scene("showcase_intro", 4, "Actual gameplay showcase"),
        Scene("still", 2, "I SWEAR / The public release", title),
        Scene("still", 3, "01 / Gather in the lobby", lobby),
        Scene("world", film.source_seconds, "THE\nOBSERVATORY", subtitle="Explore the observatory.\nFollow the clues.\nFind something to inspect."),
        Scene("still", 5, "02 / Inspect a clue", inspection),
        Scene("still", 6, "03 / Review your private memory", memories),
        Scene("still", 6, "04 / Compare witness testimony", testimony),
        Scene("still", 6, "05 / Reconstruct the shared timeline", reconstruction),
        Scene("still", 5, "06 / A different incident: the night crossing", ferry),
        Scene("still", 5, "07 / Reveal what really happened", reveal),
        Scene("end", 4, "I SWEAR"),
    ]
    results = {}
    if args.only in {"all", "trailer"}:
        results["trailer"] = film.assemble("trailer", trailer)
    if args.only in {"all", "gameplay"}:
        results["gameplay"] = film.assemble("gameplay", gameplay)
    print(json.dumps({k: {"path": v["path"], "moving_footage_seconds": v["moving_footage_seconds"],
                         "probe": v["probe"]} for k, v in results.items()}, indent=2))


if __name__ == "__main__":
    main()
