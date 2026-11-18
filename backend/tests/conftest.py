"""Testes rodam em MODO DEMO, com banco SQLite e pasta de áudios temporários."""
import os
import shutil
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="relata_teste_"))
os.environ.update({
    "OPENAI_API_KEY": "",
    "DADOS_DIR": str(_TMP),
    "DATABASE_URL": f"sqlite:///{(_TMP / 'teste.db').as_posix()}",
    "AUDIO_DIR": str(_TMP / "audios"),
    "SECRET_KEY": "chave-de-teste",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import seguranca  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Relato, Usuario  # noqa: E402

SENHA = "senha-forte-1"
AUDIO_FALSO = b"\x1aE\xdf\xa3" + b"\x00" * 4000  # cabeçalho webm + bytes


@pytest.fixture(scope="session", autouse=True)
def _limpar_tmp():
    yield
    shutil.rmtree(_TMP, ignore_errors=True)


@pytest.fixture
def client():
    with TestClient(app) as c:  # roda o lifespan (migrações)
        yield c
    with SessionLocal() as db:
        db.query(Relato).delete()
        db.query(Usuario).delete()
        db.commit()
    seguranca._falhas.clear()


def criar(login: str, perfil: str = "vendedor", nome: str | None = None) -> Usuario:
    with SessionLocal() as db:
        u = Usuario(nome=nome or login.title(), login=login,
                    senha_hash=seguranca.gerar_hash(SENHA), perfil=perfil)
        db.add(u)
        db.commit()
        return u


def entrar(client: TestClient, login: str, senha: str = SENHA):
    client.cookies.clear()
    return client.post("/api/auth/login", json={"login": login, "senha": senha})
