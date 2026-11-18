"""Configuração lida do arquivo .env na raiz do repositório (ou de variáveis de ambiente)."""
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

RAIZ = Path(__file__).resolve().parents[2]  # pasta relata-visita/
load_dotenv(RAIZ / ".env")


def _caminho(var: str, padrao: Path) -> Path:
    valor = os.getenv(var, "").strip()
    return Path(valor) if valor else padrao


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
TRANSCRIBE_MODEL = os.getenv("TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")
DEMO = not OPENAI_API_KEY  # sem chave: transcrição e extração simuladas

# Banco: PostgreSQL em produção. Sem DATABASE_URL, usa SQLite local (dev/testes).
DADOS_DIR = _caminho("DADOS_DIR", RAIZ / "dados")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip() or f"sqlite:///{(DADOS_DIR / 'relata.db').as_posix()}"

AUDIO_DIR = _caminho("AUDIO_DIR", DADOS_DIR / "audios")

# Chave que assina o cookie de sessão. Em produção, defina no .env (senão todo
# reinício do servidor desloga todo mundo).
SECRET_KEY = os.getenv("SECRET_KEY", "").strip() or secrets.token_urlsafe(32)
SESSAO_DIAS = int(os.getenv("SESSAO_DIAS", "30"))
# Em produção (HTTPS) o cookie precisa ser Secure. Em http://localhost, não.
COOKIE_SEGURO = os.getenv("COOKIE_SEGURO", "0") == "1"

AUDIO_MAX_BYTES = 25 * 1024 * 1024  # limite da API da OpenAI
FRONTEND_DIST = RAIZ / "frontend" / "dist"
