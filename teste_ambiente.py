"""
Checa se está tudo pronto antes de abrir o app.
Uso:
    .venv\\Scripts\\python teste_ambiente.py                 (checa pacotes, .env, banco, pasta dos áudios e chave)
    .venv\\Scripts\\python teste_ambiente.py meu_audio.ogg   (também transcreve e extrai os campos de um áudio)
"""
import os
import sys
import uuid
from pathlib import Path

BASE = Path(__file__).parent
sys.path.insert(0, str(BASE / "backend"))
ok_geral = True


def passo(nome, ok, detalhe=""):
    global ok_geral
    ok_geral &= ok
    print(f"[{'OK ' if ok else 'ERRO'}] {nome}" + (f"  ->  {detalhe}" if detalhe else ""))


print(f"Python {sys.version.split()[0]}")
try:
    import fastapi, openai, sqlalchemy  # noqa: F401,E401
    passo("Pacotes instalados", True,
          f"fastapi {fastapi.__version__}, sqlalchemy {sqlalchemy.__version__}, openai {openai.__version__}")
except ImportError as e:
    passo("Pacotes instalados", False,
          f"{e}  (rode: .venv\\Scripts\\python -m pip install -r backend\\requirements.txt)")
    sys.exit(1)

env = BASE / ".env"
passo("Arquivo .env", env.exists(), str(env) if env.exists() else "copie .env.exemplo para .env")

from app import config  # noqa: E402  (lê o .env)

tem_chave = bool(os.getenv("SECRET_KEY"))
passo("SECRET_KEY definida", tem_chave, "" if tem_chave else "sem ela, reiniciar o servidor desloga todo mundo")
compilado = (config.FRONTEND_DIST / "index.html").exists()
passo("Frontend compilado", compilado, "" if compilado else "rode: cd frontend; npm install; npm run build")

# --- banco
try:
    from sqlalchemy import text
    from app.db import engine
    with engine.connect() as c:
        c.execute(text("select 1"))
    passo("Banco de dados", True, "SQLite local" if config.DATABASE_URL.startswith("sqlite") else "PostgreSQL")
except Exception as e:  # noqa: BLE001
    passo("Banco de dados", False, f"{e}  (confira DATABASE_URL e se o PostgreSQL está rodando)")

# --- pasta dos áudios
try:
    config.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    tmp = config.AUDIO_DIR / f"_teste_escrita_{uuid.uuid4().hex[:6]}.tmp"
    tmp.write_text("ok")
    tmp.unlink()
    passo("Pasta dos áudios com escrita", True, str(config.AUDIO_DIR))
except OSError as e:
    passo("Pasta dos áudios com escrita", False, f"{config.AUDIO_DIR}: {e}")

# --- OpenAI
if config.DEMO:
    passo("OPENAI_API_KEY", False, "vazia -> o app vai rodar em MODO DEMO")
else:
    from openai import OpenAI
    cli = OpenAI(api_key=config.OPENAI_API_KEY)
    try:
        r = cli.chat.completions.create(
            model=config.LLM_MODEL, messages=[{"role": "user", "content": "Responda só: ok"}], max_tokens=5)
        passo("Chave OpenAI funcionando", True, f"resposta: {r.choices[0].message.content!r}")
    except Exception as e:  # noqa: BLE001
        passo("Chave OpenAI funcionando", False,
              f"{e}  (sem crédito? chave errada? proxy/firewall bloqueando api.openai.com?)")

    if len(sys.argv) > 1:
        from app import ia
        audio = Path(sys.argv[1])
        try:
            texto = ia.transcrever(audio.name, audio.read_bytes())
            passo("Transcrição de áudio", True)
            print("\n--- TRANSCRIÇÃO ---\n" + texto)
            print("\n--- CAMPOS ---")
            for k, v in ia.extrair_campos(texto).items():
                print(f"{k}: {v}")
            print("--------------")
        except Exception as e:  # noqa: BLE001
            passo("Transcrição de áudio", False, str(e))

print("\nTudo pronto! Rode iniciar.bat" if ok_geral else "\nCorrija os itens com ERRO acima.")
