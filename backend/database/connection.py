"""Database connection and session management for FastAPI."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
from backend.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
pool_kwargs = {} if settings.DATABASE_URL.startswith("sqlite") else {"pool_size": 10, "max_overflow": 20}
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args=connect_args, **pool_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
