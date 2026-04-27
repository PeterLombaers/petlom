from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.db import engine, init_db
from backend.routers import auth, competitions, matches, players

app = FastAPI()
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


@app.on_event("startup")
def on_startup():
    init_db(engine)
