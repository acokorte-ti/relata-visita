"""Indicadores para a aba Dashboard do gerente.

O volume é pequeno (dezenas de vendedores, milhares de relatos por ano), então
a agregação é feita em Python: funciona igual no SQLite e no PostgreSQL e
permite juntar grafias diferentes do mesmo cliente ("Gerdau", "GERDAU ").
"""
from collections import Counter, defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import Relato, Usuario
from ..seguranca import exigir_gerente

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(exigir_gerente)])


class Resumo(BaseModel):
    relatos: int
    clientes: int
    vendedores_com_relato: int
    vendedores_ativos: int
    media_por_vendedor: float
    por_voz: int
    por_texto: int
    dias_no_periodo: int


class Semana(BaseModel):
    inicio: date
    total: int


class PorVendedor(BaseModel):
    vendedor_id: int
    nome: str
    total: int
    clientes: int
    ultima: date | None


class PorCliente(BaseModel):
    cliente: str
    total: int
    vendedores: list[str]
    ultima: date


class ClienteVendedor(BaseModel):
    cliente: str
    vendedor: str
    total: int
    ultima: date


class SemVisita(BaseModel):
    cliente: str
    ultima: date
    dias: int
    vendedor: str


class Dashboard(BaseModel):
    resumo: Resumo
    por_semana: list[Semana]
    por_vendedor: list[PorVendedor]
    top_clientes: list[PorCliente]
    cliente_vendedor: list[ClienteVendedor]
    clientes_sem_visita: list[SemVisita]


def _chave(nome: str) -> str:
    return " ".join(nome.split()).casefold()


def _segunda(d: date) -> date:
    return d - timedelta(days=d.weekday())


@router.get("", response_model=Dashboard)
def dashboard(inicio: date | None = None, fim: date | None = None,
              vendedor_id: int | None = None, cliente: str = "",
              dias_alerta: int = Query(30, ge=7, le=365),
              db: Session = Depends(get_db)):
    hoje = date.today()
    fim = fim or hoje
    inicio = inicio or (fim - timedelta(days=89))

    q = select(Relato).options(joinedload(Relato.vendedor))
    if vendedor_id:
        q = q.where(Relato.vendedor_id == vendedor_id)
    if cliente.strip():
        q = q.where(Relato.cliente.ilike(f"%{cliente.strip()}%"))
    todos = db.scalars(q).all()  # histórico inteiro (para "clientes sem visita")
    periodo = [r for r in todos if inicio <= r.data <= fim]

    # nome de exibição do cliente = grafia mais usada
    grafias: dict[str, Counter] = defaultdict(Counter)
    for r in todos:
        grafias[_chave(r.cliente)][r.cliente.strip()] += 1
    nome_cliente = {k: c.most_common(1)[0][0] for k, c in grafias.items()}

    # ---------------------------------------------------- por vendedor
    vendedores = db.scalars(select(Usuario).where(Usuario.perfil == "vendedor")).all()
    if vendedor_id:
        vendedores = [v for v in vendedores if v.id == vendedor_id]
    ativos = [v for v in vendedores if v.ativo]
    por_vend: dict[int, list[Relato]] = defaultdict(list)
    for r in periodo:
        por_vend[r.vendedor_id].append(r)
    linhas_vend = []
    for v in vendedores:
        rs = por_vend.get(v.id, [])
        if not v.ativo and not rs:
            continue  # inativo sem relato no período não aparece
        linhas_vend.append(PorVendedor(
            vendedor_id=v.id, nome=v.nome, total=len(rs),
            clientes=len({_chave(r.cliente) for r in rs}),
            ultima=max((r.data for r in rs), default=None)))
    linhas_vend.sort(key=lambda x: (-x.total, x.nome))

    # ---------------------------------------------------- por cliente
    por_cli: dict[str, list[Relato]] = defaultdict(list)
    for r in periodo:
        por_cli[_chave(r.cliente)].append(r)
    top = sorted(
        (PorCliente(cliente=nome_cliente[k], total=len(rs),
                    vendedores=sorted({r.vendedor.nome for r in rs}),
                    ultima=max(r.data for r in rs))
         for k, rs in por_cli.items()),
        key=lambda x: (-x.total, x.cliente.casefold()))

    pares: dict[tuple[str, int], list[Relato]] = defaultdict(list)
    for r in periodo:
        pares[(_chave(r.cliente), r.vendedor_id)].append(r)
    cli_vend = sorted(
        (ClienteVendedor(cliente=nome_cliente[k], vendedor=rs[0].vendedor.nome,
                         total=len(rs), ultima=max(r.data for r in rs))
         for (k, _), rs in pares.items()),
        key=lambda x: (x.cliente.casefold(), -x.total, x.vendedor))

    # ---------------------------------------------------- semanas (sem buracos)
    contagem = Counter(_segunda(r.data) for r in periodo)
    semanas, s = [], _segunda(inicio)
    while s <= fim:
        semanas.append(Semana(inicio=s, total=contagem.get(s, 0)))
        s += timedelta(days=7)

    # ---------------------------------------------------- clientes esfriando
    ultimo: dict[str, Relato] = {}
    for r in todos:
        k = _chave(r.cliente)
        if k not in ultimo or (r.data, r.id) > (ultimo[k].data, ultimo[k].id):
            ultimo[k] = r
    sem_visita = sorted(
        (SemVisita(cliente=nome_cliente[k], ultima=r.data, dias=(hoje - r.data).days,
                   vendedor=r.vendedor.nome)
         for k, r in ultimo.items() if (hoje - r.data).days >= dias_alerta),
        key=lambda x: -x.dias)

    com_relato = len(por_vend)
    resumo = Resumo(
        relatos=len(periodo), clientes=len(por_cli), vendedores_com_relato=com_relato,
        vendedores_ativos=len(ativos),
        media_por_vendedor=round(len(periodo) / com_relato, 1) if com_relato else 0,
        por_voz=sum(1 for r in periodo if r.origem != "texto"),
        por_texto=sum(1 for r in periodo if r.origem == "texto"),
        dias_no_periodo=(fim - inicio).days + 1)

    return Dashboard(resumo=resumo, por_semana=semanas, por_vendedor=linhas_vend,
                     top_clientes=top[:10], cliente_vendedor=cli_vend,
                     clientes_sem_visita=sem_visita[:50])
