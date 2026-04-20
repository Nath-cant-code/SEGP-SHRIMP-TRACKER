import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

# Default to a local SQLite file if DATABASE_URL is not set.
# This means the backend works out of the box with zero config.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./shrimp_tracker.db")

# SQLite needs check_same_thread=False so FastAPI can use it from async workers.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()