import os

from backend.models import *
from sqlalchemy import Engine
from sqlmodel import SQLModel, create_engine


def init_engine(fp: str | None, *args, **kwargs) -> Engine:
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


if __name__ == "__main__":
    engine = init_engine()
    init_db(engine)
