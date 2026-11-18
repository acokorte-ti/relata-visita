"""Senhas (Argon2), cookie de sessão assinado e controle de acesso por perfil."""
import time
from collections import defaultdict, deque

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, status
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from . import config
from .db import get_db
from .models import Usuario

COOKIE = "relata_sessao"
_hasher = PasswordHasher()
_assinador = URLSafeTimedSerializer(config.SECRET_KEY, salt="relata-sessao")

SENHA_MIN = 8


def gerar_hash(senha: str) -> str:
    return _hasher.hash(senha)


def senha_confere(hash_: str, senha: str) -> bool:
    try:
        return _hasher.verify(hash_, senha)
    except (VerificationError, InvalidHashError):
        return False


def validar_senha_nova(senha: str) -> None:
    if len(senha) < SENHA_MIN:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT,
                            f"A senha precisa ter pelo menos {SENHA_MIN} caracteres.")


def criar_token(usuario: Usuario) -> str:
    return _assinador.dumps({"id": usuario.id, "v": usuario.versao_sessao})


def ler_token(token: str) -> dict | None:
    try:
        return _assinador.loads(token, max_age=config.SESSAO_DIAS * 86400)
    except BadSignature:
        return None


# ------------------------------------------------ limite de tentativas de login
_TENTATIVAS_MAX = 5
_JANELA_S = 15 * 60
_falhas: dict[str, deque] = defaultdict(deque)


def _limpar(chave: str) -> deque:
    fila = _falhas[chave]
    agora = time.monotonic()
    while fila and agora - fila[0] > _JANELA_S:
        fila.popleft()
    return fila


def login_bloqueado(chave: str) -> bool:
    return len(_limpar(chave)) >= _TENTATIVAS_MAX


def registrar_falha(chave: str) -> None:
    _limpar(chave).append(time.monotonic())


def limpar_falhas(chave: str) -> None:
    _falhas.pop(chave, None)


# ------------------------------------------------ dependências do FastAPI
def usuario_atual(request: Request, db: Session = Depends(get_db)) -> Usuario:
    dados = ler_token(request.cookies.get(COOKIE, ""))
    if not dados:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Faça login para continuar.")
    usuario = db.get(Usuario, dados.get("id"))
    if not usuario or not usuario.ativo or usuario.versao_sessao != dados.get("v"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sua sessão expirou. Entre de novo.")
    return usuario


def exigir_gerente(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
    if usuario.perfil != "gerente":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso só para o gerente.")
    return usuario
