from pathlib import Path, path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]

class settings ():
    app_name: str ="Coach Ron"
    ollama_base_url :str = "http://localhost:11434"
    ollama_model :str = "qwn:3.1.7b"

    model_config =SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = settings()
