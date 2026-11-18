"""Aplica as migrações do Alembic (cria/atualiza as tabelas) a partir do código."""
from pathlib import Path

from alembic import command
from alembic.config import Config

from . import config

BACKEND = Path(__file__).resolve().parents[1]


def alembic_cfg(url: str | None = None) -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    cfg.attributes["url"] = url or config.DATABASE_URL
    return cfg


def migrar(url: str | None = None) -> None:
    command.upgrade(alembic_cfg(url), "head")
