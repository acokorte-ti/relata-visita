from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoginIn(BaseModel):
    login: str = Field(min_length=1, max_length=60)
    senha: str = Field(min_length=1, max_length=200)


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str
    login: str
    perfil: str
    ativo: bool


class UsuarioCriar(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    login: str = Field(min_length=3, max_length=60, pattern=r"^[a-zA-Z0-9._-]+$")
    senha: str = Field(min_length=1, max_length=200)
    perfil: Literal["vendedor", "gerente"] = "vendedor"

    @field_validator("login")
    @classmethod
    def _minusculo(cls, v: str) -> str:
        return v.lower()


class UsuarioAlterar(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    ativo: bool | None = None
    senha: str | None = Field(default=None, min_length=1, max_length=200)
    perfil: Literal["vendedor", "gerente"] | None = None


class Rascunho(BaseModel):
    """O que a IA devolve depois de ouvir o áudio, para o vendedor conferir."""
    audio_id: str
    transcricao: str
    cliente: str
    cidade: str
    contato: str
    ata: str


class TextoRelato(BaseModel):
    texto: str = Field(max_length=20000)

    @field_validator("texto")
    @classmethod
    def _minimo(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 15:
            raise ValueError("Escreva um pouco mais sobre a visita: cliente, cidade, contato e assunto.")
        return v


class RelatoCriar(BaseModel):
    data: date
    cliente: str = Field(min_length=1, max_length=200)
    cidade: str = Field(default="", max_length=120)
    contato: str = Field(default="", max_length=200)
    ata: str = Field(default="", max_length=20000)
    transcricao: str = Field(default="", max_length=50000)
    audio_id: str = Field(default="", max_length=80)

    @field_validator("cliente", "cidade", "contato", "ata", "transcricao")
    @classmethod
    def _aparar(cls, v: str) -> str:
        return v.strip()

    @field_validator("cliente")
    @classmethod
    def _cliente_preenchido(cls, v: str) -> str:
        if not v:
            raise ValueError("Informe o cliente.")
        return v


class RelatoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    data: date
    vendedor_id: int
    vendedor_nome: str
    cliente: str
    cidade: str
    contato: str
    ata: str
    transcricao: str
    tem_audio: bool
    origem: str
    criado_em: datetime


class RelatoLista(BaseModel):
    itens: list[RelatoOut]
    total: int
    clientes: int
    vendedores: int
