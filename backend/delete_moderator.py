"""Bootstrap script to create a moderator account.

Usage: uv run python -m backend.create_moderator <username> <password>
"""

import sys

from sqlmodel import Session, select

from backend.db import engine, init_db
from backend.models import Moderator


def main():
    if len(sys.argv) != 2:
        print("Usage: uv run python -m backend.delete_moderator <username>")
        sys.exit(1)

    username = sys.argv[1]

    init_db(engine)

    with Session(engine) as session:
        moderator = session.exec(
            select(Moderator).where(Moderator.username == username)
        ).first()
        if not moderator:
            print(f"Error: moderator '{username}' does not exist.")
            sys.exit(1)

        session.delete(moderator)
        session.commit()
        print(f"Moderator '{username}' deleted.")


if __name__ == "__main__":
    main()
