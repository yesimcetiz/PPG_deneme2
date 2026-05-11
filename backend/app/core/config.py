from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://ppguser:ppgpass@db:5432/ppgdb"
    SECRET_KEY: str = "change_this_in_production_min32chars_please"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ADMIN_EMAILS: str = ""

    @property
    def admin_email_list(self) -> List[str]:
        return [e.strip() for e in self.ADMIN_EMAILS.split(",") if e.strip()]

    class Config:
        env_file = ".env"


settings = Settings()