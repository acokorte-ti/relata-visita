import re
import time
import uuid
from datetime import date, datetime
from pathlib import Path

from fastapi import (APIRouter, Depends, File, HTTPException, Query, Response,
                     UploadFile, status)
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from .. import config, ia
from ..db import get_db
from ..excel import gerar_xlsx
from ..models import Relato, Usuario
from ..schemas import Rascunho, RelatoCriar, RelatoLista, RelatoOut, TextoRelato
from ..seguranca import exigir_gerente, usuario_atual

router = APIRouter(prefix="/api/relatos", tags=["relatos"])

EXTENSOES = {".mp3", ".m4a", ".ogg", ".opus", ".wav", ".webm", ".mp4", ".aac", ".mpeg", ".mpga"}
_AUDIO_ID = re.compile(r"^(\d+)_([0-9a-f]{32})(\.[a-z0-9]{2,5})$")


def _pasta_temp() -> Path:
    p = config.AUDIO_DIR / "temp"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _limpar_temp(horas: int = 24) -> None:
    """Apaga áudios de rascunhos que nunca foram enviados."""
    limite = time.time() - horas * 3600
    for arq in _pasta_temp().iterdir():
        try:
            if arq.is_file() and arq.stat().st_mtime < limite:
                arq.unlink()
        except OSError:
            pass


def _extensao(nome: str, tipo: str) -> str:
    ext = Path(nome or "").suffix.lower()
    if ext in EXTENSOES:
        return ext
    tipo = (tipo or "").split(";")[0].strip()
    return {"audio/webm": ".webm", "audio/mp4": ".mp4", "audio/ogg": ".ogg",
            "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-m4a": ".m4a",
            "audio/aac": ".aac"}.get(tipo, "")


def _para_saida(r: Relato) -> RelatoOut:
    return RelatoOut(
        id=r.id, data=r.data, vendedor_id=r.vendedor_id, vendedor_nome=r.vendedor.nome,
        cliente=r.cliente, cidade=r.cidade, contato=r.contato, ata=r.ata,
        transcricao=r.transcricao, tem_audio=bool(r.audio_arquivo), origem=r.origem,
        criado_em=r.criado_em)


@router.post("/transcrever", response_model=Rascunho)
async def transcrever(audio: UploadFile = File(...), usuario: Usuario = Depends(usuario_atual)):
    """Recebe o áudio gravado, transcreve e devolve os campos preenchidos pela IA."""
    ext = _extensao(audio.filename or "", audio.content_type or "")
    if not ext:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            "Formato de áudio não suportado.")
    dados = await audio.read(config.AUDIO_MAX_BYTES + 1)
    if len(dados) > config.AUDIO_MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE,
                            "Áudio maior que 25 MB. Grave um relato mais curto.")
    if len(dados) < 1000:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            "O áudio ficou vazio. Grave de novo.")
    _limpar_temp()
    audio_id = f"{usuario.id}_{uuid.uuid4().hex}{ext}"
    (_pasta_temp() / audio_id).write_bytes(dados)
    try:
        texto = ia.transcrever(f"relato{ext}", dados)
        campos = ia.extrair_campos(texto) if texto else dict.fromkeys(ia.CAMPOS_IA, "")
    except Exception as e:  # noqa: BLE001 - qualquer falha da API vira mensagem amigável
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            "Não foi possível transcrever agora. Tente de novo em instantes.") from e
    return Rascunho(audio_id=audio_id, transcricao=texto, **campos)


@router.post("/extrair", response_model=Rascunho)
def extrair(dados: TextoRelato, usuario: Usuario = Depends(usuario_atual)):
    """Relato digitado: a IA organiza o texto nos campos do formulário."""
    try:
        campos = ia.extrair_campos(dados.texto)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            "Não foi possível organizar o texto agora. Tente de novo em instantes.") from e
    return Rascunho(audio_id="", transcricao=dados.texto, **campos)


@router.post("", response_model=RelatoOut, status_code=status.HTTP_201_CREATED)
def criar(dados: RelatoCriar, db: Session = Depends(get_db),
          usuario: Usuario = Depends(usuario_atual)):
    audio_final = ""
    if dados.audio_id:
        m = _AUDIO_ID.match(dados.audio_id)
        temp = _pasta_temp() / dados.audio_id
        if not m or int(m.group(1)) != usuario.id or not temp.is_file():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Áudio não encontrado. Grave de novo.")
        slug = re.sub(r"[^A-Za-z0-9]+", "_", dados.cliente)[:40].strip("_") or "cliente"
        audio_final = f"{datetime.now():%Y%m%d_%H%M%S}_{usuario.login}_{slug}{m.group(3)}"
        config.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        temp.replace(config.AUDIO_DIR / audio_final)
    relato = Relato(vendedor_id=usuario.id, data=dados.data, cliente=dados.cliente,
                    cidade=dados.cidade, contato=dados.contato, ata=dados.ata,
                    transcricao=dados.transcricao, audio_arquivo=audio_final,
                    origem="voz" if audio_final else "texto")
    db.add(relato)
    db.commit()
    db.refresh(relato)
    return _para_saida(relato)


def _consulta(usuario: Usuario, inicio: date | None, fim: date | None,
              cliente: str, vendedor_id: int | None, busca: str):
    q = select(Relato).options(joinedload(Relato.vendedor))
    if usuario.perfil != "gerente":
        q = q.where(Relato.vendedor_id == usuario.id)  # vendedor só vê os próprios
    elif vendedor_id:
        q = q.where(Relato.vendedor_id == vendedor_id)
    if inicio:
        q = q.where(Relato.data >= inicio)
    if fim:
        q = q.where(Relato.data <= fim)
    if cliente.strip():
        q = q.where(Relato.cliente.ilike(f"%{cliente.strip()}%"))
    if busca.strip():
        termo = f"%{busca.strip()}%"
        q = q.where(or_(Relato.cliente.ilike(termo), Relato.cidade.ilike(termo),
                        Relato.contato.ilike(termo), Relato.ata.ilike(termo)))
    return q


@router.get("", response_model=RelatoLista)
def listar(inicio: date | None = None, fim: date | None = None, cliente: str = "",
           vendedor_id: int | None = None, busca: str = "",
           limite: int = Query(200, ge=1, le=1000),
           db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual)):
    q = _consulta(usuario, inicio, fim, cliente, vendedor_id, busca)
    sub = q.subquery()
    total, clientes, vendedores = db.execute(select(
        func.count(), func.count(func.distinct(func.lower(sub.c.cliente))),
        func.count(func.distinct(sub.c.vendedor_id)))).one()
    itens = db.scalars(q.order_by(Relato.data.desc(), Relato.id.desc()).limit(limite)).all()
    return RelatoLista(itens=[_para_saida(r) for r in itens], total=total,
                       clientes=clientes, vendedores=vendedores)


@router.get("/exportar.xlsx")
def exportar(inicio: date | None = None, fim: date | None = None, cliente: str = "",
             vendedor_id: int | None = None, busca: str = "",
             db: Session = Depends(get_db), gerente: Usuario = Depends(exigir_gerente)):
    q = _consulta(gerente, inicio, fim, cliente, vendedor_id, busca)
    relatos = db.scalars(q.order_by(Relato.data.desc(), Relato.id.desc())).all()
    nome = f"relatos_{date.today():%Y%m%d}.xlsx"
    return Response(gerar_xlsx(relatos),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{nome}"'})


def _relato_visivel(relato_id: int, db: Session, usuario: Usuario) -> Relato:
    relato = db.get(Relato, relato_id)
    if not relato or (usuario.perfil != "gerente" and relato.vendedor_id != usuario.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Relato não encontrado.")
    return relato


@router.get("/{relato_id}", response_model=RelatoOut)
def detalhe(relato_id: int, db: Session = Depends(get_db),
            usuario: Usuario = Depends(usuario_atual)):
    return _para_saida(_relato_visivel(relato_id, db, usuario))


@router.get("/{relato_id}/audio")
def audio(relato_id: int, db: Session = Depends(get_db),
          usuario: Usuario = Depends(usuario_atual)):
    relato = _relato_visivel(relato_id, db, usuario)
    caminho = config.AUDIO_DIR / relato.audio_arquivo if relato.audio_arquivo else None
    if not caminho or not caminho.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Áudio não encontrado.")
    return FileResponse(caminho)
