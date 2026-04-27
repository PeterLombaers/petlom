"""Bootstrap script to create a moderator account.

Usage: uv run python -m backend.create_moderator <username> <password>
"""

import sys

from sqlmodel import Session, select

from backend.auth import hash_password
from backend.db import engine, init_db
from backend.models import Moderator


def main():
    if len(sys.argv) != 3:
        print("Usage: uv run python -m backend.create_moderator <username> <password>")
        sys.exit(1)

    username, password = sys.argv[1], sys.argv[2]

    init_db(engine)

    with Session(engine) as session:
        existing = session.exec(
            select(Moderator).where(Moderator.username == username)
        ).first()
        if existing:
            print(f"Error: moderator '{username}' already exists.")
            sys.exit(1)

        session.add(
            Moderator(username=username, hashed_password=hash_password(password))
        )
        session.commit()
        print(f"Moderator '{username}' created.")


if __name__ == "__main__":
    main()
