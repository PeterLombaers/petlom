"""Alembic environment.

Two things make this file project-specific:

- ``target_metadata`` needs every model imported, or ``--autogenerate`` sees an
  empty schema and cheerfully generates "drop every table".
- SQLite cannot ``ALTER`` a column, so ``render_as_batch`` is on: Alembic
  rewrites such changes as create-new-table / copy / drop / rename.
- That rewrite is why migrations run with foreign keys disabled; see
  ``_foreign_keys_off``.
"""

from collections.abc import Generator
from contextlib import contextmanager
from logging.config import fileConfig

from alembic import context
from sqlalchemy import Connection
from sqlmodel import SQLModel

from backend.config import settings
from backend.db import init_engine

# Star import on purpose: every model has to be imported for SQLModel.metadata
# below to be the whole schema.
from backend.models import *

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def _configure(**kwargs) -> None:
    context.configure(
        target_metadata=target_metadata,
        # SQLite has no ALTER COLUMN / DROP CONSTRAINT.
        render_as_batch=True,
        # Notice a str -> int or nullable change, not just added/dropped columns.
        compare_type=True,
        compare_server_default=True,
        **kwargs,
    )


def run_migrations_offline() -> None:
    """Emit SQL to stdout instead of running it (``alembic upgrade head --sql``)."""
    _configure(
        url=f"sqlite:///{settings.database_fp}",
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


@contextmanager
def _foreign_keys_off(connection: Connection) -> Generator[None]:
    """Run migrations with referential integrity disabled.

    Alembic's batch mode rebuilds a table as create-new / copy / DROP old /
    rename, and ``backend.db`` turns ``PRAGMA foreign_keys`` on for every
    connection. Dropping a table that others reference then either errors, or —
    where the reference is ``ON DELETE CASCADE``, as most of ours are — silently
    deletes every child row. Alembic's own batch documentation requires the
    pragma to be off for exactly this reason.

    SQLite ignores the pragma inside an open transaction *without raising*, so
    this has to run before Alembic begins one, and the check is what stops that
    ordering from regressing into silent data loss.

    It goes through the raw DBAPI connection on purpose: running it through the
    SQLAlchemy ``Connection`` would implicitly begin a transaction around it, and
    Alembic's own transaction would then no longer be the outermost one — the
    migration runs but is never committed.
    """
    dbapi_connection = connection.connection.dbapi_connection
    dbapi_connection.execute("PRAGMA foreign_keys=OFF")
    if dbapi_connection.execute("PRAGMA foreign_keys").fetchone()[0]:
        raise RuntimeError(
            "Could not disable foreign keys before migrating; a transaction was "
            "already open. Running a batch migration now could delete rows."
        )
    try:
        yield
    finally:
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


def _run(connection: Connection) -> None:
    with _foreign_keys_off(connection):
        _configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


def run_migrations_online() -> None:
    # backend.db.init_db passes its own connection in; the CLI has none and
    # opens one against the configured database file.
    connection = config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return

    engine = init_engine(fp=settings.database_fp)
    with engine.connect() as connection:
        _run(connection)
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
