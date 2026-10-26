"""Check a deployment database. Configuration arrives through hidden stdin, never argv."""
import getpass
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def check():
    configuration = json.loads(getpass.getpass("Database configuration (hidden): "))
    from app.main import app  # Registers account tables before repository setup.
    from app.persistence import Repository
    from app.room_manager import RoomManager
    from sqlalchemy import text

    repository = Repository(configuration["database_url"])
    with repository.engine.connect() as connection:
        assert connection.execute(text("select 1")).scalar() == 1
    rooms = RoomManager()
    room, player = rooms.create("Storage Check")
    player.avatar_color, player.hat = 2, "beanie"
    repository.save_rooms([room])
    restored = next(item for item in repository.load_rooms() if item.code == room.code)
    assert restored.players[player.id].token_hash == player.token_hash
    assert restored.players[player.id].hat == "beanie"
    repository.engine.dispose()
    print("Hosted PostgreSQL connection, schema, private credentials, and room checkpoint verified.")


if __name__ == "__main__":
    try:
        check()
    except Exception as error:
        print(f"Hosted database check failed ({type(error).__name__}). Connection details omitted.")
        raise SystemExit(1)
