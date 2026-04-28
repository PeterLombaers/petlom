from sqlalchemy import Engine
from sqlmodel import SQLModel, create_engine

from backend.config import settings


def init_engine(fp: str, *args, **kwargs) -> Engine:
    url = f"sqlite:///{fp}"
    return create_engine(url, *args, **kwargs)


def init_db(engine: Engine):
    SQLModel.metadata.create_all(engine)


engine = init_engine(
    fp=settings.database_fp,
    connect_args={"check_same_thread": False},
    echo=False,
)


if __name__ == "__main__":
    from backend.models import *  # noqa: F403

    init_db(engine)
