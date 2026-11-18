from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

PERFIS = ("vendedor", "gerente")


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    login: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    perfil: Mapped[str] = mapped_column(String(20), default="vendedor")
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    # Incrementa ao trocar a senha ou desativar: invalida as sessões abertas.
    versao_sessao: Mapped[int] = mapped_column(Integer, default=1)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, server_default=func.now())

    relatos: Mapped[list["Relato"]] = relationship(back_populates="vendedor")


class Relato(Base):
    __tablename__ = "relatos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendedor_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), index=True)
    data: Mapped[date] = mapped_column(Date, index=True)
    cliente: Mapped[str] = mapped_column(String(200), index=True)
    cidade: Mapped[str] = mapped_column(String(120), default="")
    contato: Mapped[str] = mapped_column(String(200), default="")
    ata: Mapped[str] = mapped_column(Text, default="")
    transcricao: Mapped[str] = mapped_column(Text, default="")
    audio_arquivo: Mapped[str] = mapped_column(String(255), default="")
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, server_default=func.now())

    vendedor: Mapped[Usuario] = relationship(back_populates="relatos")
