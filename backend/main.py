from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.db import engine, init_db
from backend.routers import auth, competitions, external_ratings, matches, players


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    init_db(engine)
    yield


app = FastAPI(root_path="/api", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(competitions.router)
app.include_router(players.router)
app.include_router(matches.router)
app.include_router(external_ratings.router)
