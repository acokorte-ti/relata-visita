"""Relata Visita - API (FastAPI) + arquivos do app/painel (frontend/dist).

Rodar (na pasta backend):  ..\\.venv\\Scripts\\python -m uvicorn app.main:app --port 8502
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import config
from .migracoes import migrar
from .routers import auth, dashboard, relatos, usuarios


@asynccontextmanager
async def ciclo(_: FastAPI):
    migrar()  # cria/atualiza as tabelas do banco
    yield


app = FastAPI(title="Relata Visita", version="2.0", lifespan=ciclo,
              docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)
app.include_router(auth.router)
app.include_router(relatos.router)
app.include_router(usuarios.router)
app.include_router(dashboard.router)


@app.get("/api/status")
def status_api():
    return {"ok": True, "demo": config.DEMO}


# ------------------------------------------------ frontend (build do Vite)
_DIST = config.FRONTEND_DIST
if (_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")


@app.get("/{caminho:path}", include_in_schema=False)
def spa(caminho: str):
    if caminho.startswith("api/"):
        raise HTTPException(404)
    arquivo = (_DIST / caminho).resolve()
    if caminho and arquivo.is_file() and arquivo.is_relative_to(_DIST.resolve()):
        return FileResponse(arquivo)  # manifest, sw.js, ícones
    indice = _DIST / "index.html"
    if not indice.is_file():
        raise HTTPException(404, "Frontend não compilado. Rode 'npm run build' na pasta frontend.")
    return FileResponse(indice, headers={"Cache-Control": "no-cache"})
