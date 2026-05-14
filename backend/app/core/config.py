from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://ppguser:ppgpass@db:5432/ppgdb"
    SECRET_KEY: str = "change_this_in_production_min32chars_please"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ADMIN_EMAILS: str = ""

    # Gemini AI
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Sentry error tracking
    SENTRY_DSN: str = ""

    # Ortam: "development" veya "production"
    ENVIRONMENT: str = "development"

    # CORS — virgülle ayrılmış izin verilen origin'ler
    # Development: * (hepsi)
    # Production: Railway URL + mobil bundle ID
    ALLOWED_ORIGINS: str = "*"

    @property
    def db_url(self) -> str:
        """
        DATABASE_URL'yi psycopg3 uyumlu formata çevir.
        Railway postgres:// veya postgresql:// verir;
        SQLAlchemy + psycopg3 postgresql+psycopg:// gerektirir.
        """
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://") and "+psycopg" not in url:
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    @property
    def admin_email_list(self) -> List[str]:
        return [e.strip() for e in self.ADMIN_EMAILS.split(",") if e.strip()]

    @property
    def cors_origins(self) -> List[str]:
        if self.ALLOWED_ORIGINS == "*":
            return ["*"]
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    class Config:
        env_file = ".env"


settings = Settings()
