"""Package an explicit source/build allowlist; exclude credentials and sessions."""

from hashlib import sha256
import json
from pathlib import Path
import struct
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "i-swear-local-release.zip"
DIRECTORIES = ("backend/app", "backend/tests", "backend/scripts", "frontend/src", "frontend/public", "frontend/dist", "docs", "scripts")
FILES = (
    "README.md", "STATUS.md", "DECISIONS.md", "Dockerfile", "compose.yaml", "render.yaml", ".dockerignore", ".gitignore",
    ".github/workflows/checks.yml", "backend/requirements.txt", "backend/pytest.ini", "backend/.env.example",
    "frontend/package.json", "frontend/package-lock.json", "frontend/index.html", "frontend/vite.config.ts",
    "frontend/tsconfig.json", "frontend/tsconfig.app.json", "frontend/tsconfig.node.json",
    "artifacts/gameplay.jpg", "artifacts/title-screen.jpg", "artifacts/lobby.jpg", "artifacts/inspection.jpg",
    "artifacts/memories.jpg", "artifacts/testimony.jpg", "artifacts/reconstruction-board.jpg",
    "artifacts/ferry.jpg", "artifacts/ferry-plan.jpg", "artifacts/voice-chat.jpg", "artifacts/observatory.jpg",
    "artifacts/i-swear-trailer.mp4", "artifacts/i-swear-gameplay.mp4", "artifacts/world-source.webm",
    "artifacts/submission-cover.jpg", "artifacts/i-swear-cover.svg", "artifacts/README.md",
    "artifacts/casefile-motive.jpg", "artifacts/casefile-board.jpg", "artifacts/casefile-reveal.jpg",
    "artifacts/i-swear-audio-preview.mp3",
    "artifacts/audio-settings.jpg",
    "artifacts/campus-3d.jpg", "artifacts/campus-3d-inspection.jpg", "artifacts/campus-3d-mobile.jpg",
    "artifacts/campus-3d-live.jpg",
    "artifacts/settings-notebook.jpg", "artifacts/settings-mobile.jpg",
    "artifacts/witness-3d-wardrobe.jpg", "artifacts/campus-entrances.jpg",
    "artifacts/observatory-3d.jpg", "artifacts/ferry-3d.jpg", "artifacts/headphones-3d.jpg",
    "artifacts/inspect-3d-mobile.jpg",
    "artifacts/tutorial-guide.jpg", "artifacts/tutorial-mobile.jpg",
    "artifacts/beanie-fitted.jpg", "artifacts/fedora-fitted.jpg",
    "artifacts/readable-tutorial.jpg", "artifacts/readable-board.jpg",
    "artifacts/readable-mobile.jpg", "artifacts/readable-settings-mobile.jpg",
)


def jpeg_size(path):
    with path.open("rb") as image:
        if image.read(2) != b"\xff\xd8":
            raise ValueError("The cover must be a JPEG image")
        while True:
            if image.read(1) != b"\xff":
                raise ValueError("Invalid JPEG marker")
            marker = image.read(1)
            while marker == b"\xff":
                marker = image.read(1)
            size = struct.unpack(">H", image.read(2))[0]
            if marker in (b"\xc0", b"\xc1", b"\xc2"):
                _, height, width = struct.unpack(">BHH", image.read(5))
                return width, height
            image.seek(size - 2, 1)


def package():
    if not (ROOT / "frontend/dist/index.html").is_file():
        raise SystemExit("Build the frontend before packaging.")
    width, height = jpeg_size(ROOT / "artifacts/submission-cover.jpg")
    assert width >= 1200 and width * 2 == height * 3, "Cover must be at least 1200px wide at 3:2"
    submission = (ROOT / "docs/SUBMISSION.md").read_text(encoding="utf-8")
    description = submission.split("## Description (under 500 characters)\n\n")[1].split("\n\n")[0]
    assert len(description) <= 500
    files = {ROOT / name for name in FILES if (ROOT / name).is_file()}
    for directory in DIRECTORIES:
        files.update(path for path in (ROOT / directory).rglob("*") if path.is_file()
                     and "__pycache__" not in path.parts and path.suffix not in (".pyc", ".tsbuildinfo"))
    manifest = {}
    OUTPUT.parent.mkdir(exist_ok=True)
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        for path in sorted(files):
            relative = path.relative_to(ROOT).as_posix()
            if path.name == ".env" or path.suffix == ".db":
                raise ValueError(f"Private file cannot be packaged: {relative}")
            manifest[relative] = sha256(path.read_bytes()).hexdigest()
            archive.write(path, f"i-swear/{relative}")
        archive.writestr("i-swear/MANIFEST.json", json.dumps(manifest, indent=2))
    with ZipFile(OUTPUT) as archive:
        assert archive.testzip() is None
        assert "i-swear/frontend/dist/index.html" in archive.namelist()
        assert "i-swear/backend/app/main.py" in archive.namelist()
    digest = sha256(OUTPUT.read_bytes()).hexdigest()
    OUTPUT.with_suffix(".zip.sha256").write_text(f"{digest}  {OUTPUT.name}\n", encoding="ascii")
    print(json.dumps({"archive": str(OUTPUT), "files": len(files), "bytes": OUTPUT.stat().st_size,
                      "sha256": digest}))


if __name__ == "__main__":
    package()
