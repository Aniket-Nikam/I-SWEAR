"""Encode actual, timestamped UI screenshots; this script does not capture a UI.

Example manifest.json (timestamps use the capture clock, in milliseconds):
  {"frames": [{"file": "frame000001.jpg", "timestamp_ms": 900.2},
              {"file": "frame000002.jpg", "timestamp_ms": 1067.8}]}

The first timestamp is normalized to zero. Real gaps are preserved, including
slow capture periods. The output's frame rate does not imply that the source was
captured at that rate. Optional audio must already be a recording of the game.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import shutil
import statistics
import subprocess
import sys
import tempfile


def read_frames(directory: Path, manifest: Path) -> tuple[list[tuple[Path, float]], float]:
    raw = json.loads(manifest.read_text(encoding="utf-8-sig"))
    entries = raw.get("frames") if isinstance(raw, dict) else raw
    if not isinstance(entries, list) or len(entries) < 2:
        raise ValueError("The manifest must contain at least two captured frames.")
    frames: list[tuple[Path, float]] = []
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("file"), str):
            raise ValueError("Each frame requires file and timestamp_ms fields.")
        path = (directory / entry["file"]).resolve()
        if not path.is_relative_to(directory) or not path.is_file():
            raise ValueError(f"Missing frame or path outside frame directory: {entry['file']}")
        timestamp = float(entry["timestamp_ms"]) / 1000
        if not math.isfinite(timestamp) or (frames and timestamp <= frames[-1][1]):
            raise ValueError("Frame timestamps must be finite and strictly increasing.")
        frames.append((path, timestamp))
    intervals = [b[1] - a[1] for a, b in zip(frames, frames[1:])]
    last_hold = statistics.median(intervals)
    if isinstance(raw, dict) and "last_frame_duration_ms" in raw:
        last_hold = float(raw["last_frame_duration_ms"]) / 1000
        if not math.isfinite(last_hold) or last_hold <= 0:
            raise ValueError("last_frame_duration_ms must be finite and positive.")
    return frames, last_hold


def concat_quote(path: Path) -> str:
    # ffconcat uses its own quoting rules, independently of the shell.
    return "'" + path.as_posix().replace("'", "'\\''") + "'"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--frames", type=Path, required=True, help="Directory containing real captured frames")
    parser.add_argument("--manifest", type=Path, required=True, help="Timestamp manifest JSON")
    parser.add_argument("--output", type=Path, required=True, help="Output .mp4 path")
    parser.add_argument("--fps", type=int, default=30, help="Output cadence; repeated frames preserve capture timing")
    parser.add_argument("--audio", type=Path, help="Optional existing game-audio recording, aligned to the first frame")
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"), help="ffmpeg executable (defaults to PATH)")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    if not args.ffmpeg:
        parser.error("ffmpeg was not found on PATH; pass --ffmpeg with its executable path.")
    if not 1 <= args.fps <= 120:
        parser.error("--fps must be between 1 and 120.")
    directory = args.frames.resolve()
    output = args.output.resolve()
    if output.suffix.lower() != ".mp4":
        parser.error("--output must end in .mp4.")
    if output.exists() and not args.overwrite:
        parser.error("Output already exists; use --overwrite to replace it.")
    if args.audio and not args.audio.is_file():
        parser.error("--audio does not exist.")
    try:
        frames, last_hold = read_frames(directory, args.manifest.resolve())
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.error(str(exc))
    if output in {path for path, _ in frames} or output == args.manifest.resolve():
        parser.error("Output must not replace an input file.")
    elapsed = frames[-1][1] - frames[0][1]
    duration = elapsed + last_hold
    intervals = [b[1] - a[1] for a, b in zip(frames, frames[1:])]
    stats = {
        "source_frames": len(frames),
        "source_average_fps": round((len(frames) - 1) / elapsed, 3),
        "source_median_fps": round(1 / statistics.median(intervals), 3),
        "largest_capture_gap_seconds": round(max(intervals), 3),
        "duration_seconds": round(duration, 3),
        "output_fps": args.fps,
        "interpolated": False,
    }
    print(json.dumps(stats, indent=2), flush=True)
    if stats["source_average_fps"] < 8 or max(intervals) > 0.5:
        print("Capture cadence is low or uneven; encoding preserves those real gaps. "
              "Use a native tab recording for smooth gameplay.", file=sys.stderr)
    lines = ["ffconcat version 1.0"]
    for index, (path, timestamp) in enumerate(frames):
        hold = frames[index + 1][1] - timestamp if index + 1 < len(frames) else last_hold
        lines.extend((f"file {concat_quote(path)}", "option framerate 1000", f"duration {hold:.9f}"))
    # The concat demuxer needs a final repeated entry to honor the last duration.
    lines.extend((f"file {concat_quote(frames[-1][0])}", "option framerate 1000"))
    output.parent.mkdir(parents=True, exist_ok=True)
    concat_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".ffconcat", encoding="utf-8", delete=False) as handle:
            handle.write("\n".join(lines) + "\n")
            concat_path = Path(handle.name)
        command = [str(args.ffmpeg), "-hide_banner", "-loglevel", "warning", "-y" if args.overwrite else "-n",
                   "-f", "concat", "-safe", "0", "-i", str(concat_path)]
        if args.audio:
            command += ["-i", str(args.audio.resolve()), "-map", "0:v:0", "-map", "1:a:0", "-af", "apad",
                        "-c:a", "aac", "-b:a", "192k"]
        else:
            command += ["-an"]
        command += ["-vf", f"fps={args.fps},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
                    "-t", f"{duration:.9f}", "-c:v", "libx264", "-crf", "18", "-preset", "medium",
                    "-movflags", "+faststart", str(output)]
        subprocess.run(command, check=True)
    finally:
        if concat_path is not None:
            concat_path.unlink(missing_ok=True)
    print(f"Saved {output}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"ffmpeg failed with exit code {exc.returncode}", file=sys.stderr)
        raise SystemExit(exc.returncode)
