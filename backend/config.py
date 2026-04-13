from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://postgres:AdeelAhmad%4012345@localhost:5432/lis_db"
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    WA_API_KEY: str = ""
    WA_API_URL: str = "http://187.127.138.168/api/v1/messages/send"

    SERIAL_PORT: str = "COM3"
    SERIAL_BAUD_RATE: int = 9600
    LOG_DIR: str = "./logs"

    LAB_NAME: str = "City Diagnostic Laboratory"
    LAB_PHONE: str = "+92-300-1234567"
    LAB_ADDRESS: str = "Main Boulevard, Lahore, Pakistan"
    LAB_EMAIL: str = "info@citydiagnostics.pk"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
