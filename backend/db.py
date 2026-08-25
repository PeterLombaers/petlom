import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, event
from sqlmodel import create_engine

from backend.config import settings

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"


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


def alembic_config(connection=None) -> Config:
    config = Config(ALEMBIC_INI)
    config.set_main_option("script_location", str(ALEMBIC_INI.parent / "migrations"))
    if connection is not None:
        # migrations/env.py runs on this connection instead of opening its own.
        config.attributes["connection"] = connection
    return config


def init_db(engine: Engine):
    """Bring the database up to the latest migration, creating it if needed.

    Alembic — not `SQLModel.metadata.create_all` — is the schema authority: a
    fresh file gets built by replaying the migrations, an existing one only gets
    what it is missing. The tests are the exception, they create the schema
    straight from the metadata against a throwaway in-memory database.
    """
    with engine.begin() as connection:
        command.upgrade(alembic_config(connection), "head")


engine = init_engine(
    fp=settings.database_fp,
    connect_args={"check_same_thread": False},
    echo=False,
)


if __name__ == "__main__":
    # migrations/env.py imports the models itself, so nothing to import here.
    init_db(engine)
