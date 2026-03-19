from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./lis_database.db"
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

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
