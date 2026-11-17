"""
Checa se está tudo pronto antes de abrir o app.
Uso:
    .venv\\Scripts\\python teste_ambiente.py                 (checa chave + pasta de rede)
    .venv\\Scripts\\python teste_ambiente.py meu_audio.ogg   (também transcreve um áudio)
"""
import os
import sys
import uuid
from pathlib import Path

BASE = Path(__file__).parent
ok_geral = True


def passo(nome, ok, detalhe=""):
    global ok_geral
    ok_geral &= ok
    print(f"[{'OK ' if ok else 'ERRO'}] {nome}" + (f"  ->  {detalhe}" if detalhe else ""))


print(f"Python {sys.version.split()[0]}")
try:
    from dotenv import load_dotenv
    import openai, openpyxl, streamlit  # noqa: F401
    passo("Pacotes instalados", True, f"streamlit {streamlit.__version__}, openai {openai.__version__}")
except ImportError as e:
    passo("Pacotes instalados", False, f"{e}  (rode: pip install -r requirements.txt)")
    sys.exit(1)

env = BASE / ".env"
passo("Arquivo .env", env.exists(), str(env) if env.exists() else "copie .env.exemplo para .env")
load_dotenv(env)

# --- pasta da planilha na rede
xlsx = Path(os.getenv("VISITAS_XLSX", BASE / "dados" / "visitas.xlsx"))
pasta = xlsx.parent
passo("Pasta da planilha existe", pasta.exists(), str(pasta))
if pasta.exists():
    tmp = pasta / f"_teste_escrita_{uuid.uuid4().hex[:6]}.tmp"
    try:
        tmp.write_text("ok")
        tmp.unlink()
        passo("Permissão de escrita na pasta", True)
    except OSError as e:
        passo("Permissão de escrita na pasta", False, str(e))
    if xlsx.exists():
        try:
            with open(xlsx, "r+b"):
                pass
            passo("Planilha livre (não está aberta no Excel)", True)
        except PermissionError:
            passo("Planilha livre (não está aberta no Excel)", False,
                  "alguém está com ela aberta; o app vai usar a fila de pendentes")

# --- OpenAI
key = os.getenv("OPENAI_API_KEY", "")
if not key:
    passo("OPENAI_API_KEY", False, "vazia -> o app vai rodar em MODO DEMO")
else:
    from openai import OpenAI
    cli = OpenAI(api_key=key)
    try:
        r = cli.chat.completions.create(
            model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
            messages=[{"role": "user", "content": "Responda só: ok"}], max_tokens=5)
        passo("Chave OpenAI funcionando", True, f"resposta: {r.choices[0].message.content!r}")
    except Exception as e:  # noqa: BLE001
        passo("Chave OpenAI funcionando", False,
              f"{e}  (sem crédito? chave errada? proxy/firewall bloqueando api.openai.com?)")

    if len(sys.argv) > 1:
        audio = Path(sys.argv[1])
        nome = audio.name[:-5] + ".ogg" if audio.name.lower().endswith(".opus") else audio.name
        try:
            t = cli.audio.transcriptions.create(
                model=os.getenv("TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe"),
                file=(nome, audio.read_bytes()), language="pt")
            passo("Transcrição de áudio", True)
            print("\n--- TRANSCRIÇÃO ---\n" + t.text + "\n-------------------")
        except Exception as e:  # noqa: BLE001
            passo("Transcrição de áudio", False, str(e))

print("\nTudo pronto! Rode iniciar.bat" if ok_geral else "\nCorrija os itens com ERRO acima.")
