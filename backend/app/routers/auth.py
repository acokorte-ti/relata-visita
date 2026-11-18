from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import config
from ..db import get_db
from ..models import Usuario
from ..schemas import LoginIn, UsuarioOut
from ..seguranca import (COOKIE, criar_token, limpar_falhas, login_bloqueado,
                         registrar_falha, senha_confere, usuario_atual)

router = APIRouter(prefix="/api/auth", tags=["login"])


@router.post("/login", response_model=UsuarioOut)
def login(dados: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    login_ = dados.login.strip().lower()
    chave = f"{login_}|{request.client.host if request.client else ''}"
    if login_bloqueado(chave):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Muitas tentativas. Espere 15 minutos e tente de novo.")
    usuario = db.scalar(select(Usuario).where(Usuario.login == login_))
    if not usuario or not usuario.ativo or not senha_confere(usuario.senha_hash, dados.senha):
        registrar_falha(chave)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário ou senha incorretos.")
    limpar_falhas(chave)
    response.set_cookie(
        COOKIE, criar_token(usuario), max_age=config.SESSAO_DIAS * 86400,
        httponly=True, secure=config.COOKIE_SEGURO, samesite="strict", path="/")
    return usuario


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")


@router.get("/eu", response_model=UsuarioOut)
def eu(usuario: Usuario = Depends(usuario_atual)):
    return usuario
