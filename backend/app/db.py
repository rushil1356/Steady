
from sqlmodel import SQLModel, Session, create_engine

from app.config import settings

# Connect to the SQLite database
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},   # manages connection to data base
)


def create_db_and_tables():
    from app import models

    SQLModel.metadata.create_all(engine)


def get_session():  # creates data base session for a request
    with Session(engine) as session:
        yield session
