from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db import engine, init_db
from backend.routers import competitions, matches, players, rating_types

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(competitions.router)
app.include_router(players.router)
app.include_router(matches.router)
app.include_router(rating_types.router)


@app.on_event("startup")
def on_startup():
    init_db(engine)
