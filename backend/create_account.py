"""Bootstrap script to create an account.

Usage: uv run python -m backend.create_account <username> <password> [--role ROLE]
"""

import argparse
import sys

from sqlmodel import Session, select

from backend.auth import hash_password
from backend.db import engine, init_db
from backend.enums import Role
from backend.models import Moderator


def main():
    parser = argparse.ArgumentParser(description="Create a Petlom account.")
    parser.add_argument("username")
    parser.add_argument("password")
    parser.add_argument(
        "--role",
        type=Role,
        choices=list(Role),
        default=Role.MODERATOR,
        help=(
            "moderator: full access (the default). "
            "result_keeper: may only update the result of an existing match."
        ),
    )
    args = parser.parse_args()

    init_db(engine)

    with Session(engine) as session:
        existing = session.exec(
            select(Moderator).where(Moderator.username == args.username)
        ).first()
        if existing:
            print(f"Error: account '{args.username}' already exists.")
            sys.exit(1)

        session.add(
            Moderator(
                username=args.username,
                hashed_password=hash_password(args.password),
                role=args.role,
            )
        )
        session.commit()
        print(f"Account '{args.username}' created with role '{args.role.value}'.")


if __name__ == "__main__":
    main()
