import sqlite3

from sqlalchemy import Engine, event
from sqlmodel import SQLModel, create_engine

from backend.config import settings


@event.listens_for(Engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
    if not isinstance(dbapi_connection, sqlite3.Connection):
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


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
