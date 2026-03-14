import os

from sqlalchemy import Engine
from sqlmodel import SQLModel, create_engine


def init_engine(fp: str | None = None, *args, **kwargs) -> Engine:
    if fp is None:
        try:
            fp = os.environ["DATABASE_FP"]
        except KeyError:
            raise ValueError(
                "Database file path should be provided by argument or via environment"
                " variable."
            )
    url = f"sqlite:///{fp}"
    return create_engine(url, *args, **kwargs)


def init_db(engine: Engine):
    SQLModel.metadata.create_all(engine)


engine = init_engine(
    fp="database.db", connect_args={"check_same_thread": False}, echo=True
)


if __name__ == "__main__":
    from backend.models import *  # noqa: F403

    _engine = init_engine()
    init_db(_engine)
