from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Usuario
from ..schemas import UsuarioAlterar, UsuarioCriar, UsuarioOut
from ..seguranca import exigir_gerente, gerar_hash, validar_senha_nova

router = APIRouter(prefix="/api/usuarios", tags=["usuários"],
                   dependencies=[Depends(exigir_gerente)])


@router.get("", response_model=list[UsuarioOut])
def listar(db: Session = Depends(get_db)):
    return db.scalars(select(Usuario).order_by(Usuario.ativo.desc(), Usuario.nome)).all()


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def criar(dados: UsuarioCriar, db: Session = Depends(get_db)):
    validar_senha_nova(dados.senha)
    if db.scalar(select(Usuario).where(Usuario.login == dados.login)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe um usuário com esse login.")
    usuario = Usuario(nome=dados.nome.strip(), login=dados.login,
                      senha_hash=gerar_hash(dados.senha), perfil=dados.perfil)
    db.add(usuario)
    db.commit()
    return usuario


@router.patch("/{usuario_id}", response_model=UsuarioOut)
def alterar(usuario_id: int, dados: UsuarioAlterar, db: Session = Depends(get_db),
            gerente: Usuario = Depends(exigir_gerente)):
    usuario = db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado.")
    if usuario.id == gerente.id and (dados.ativo is False or dados.perfil == "vendedor"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "Você não pode desativar nem rebaixar o próprio usuário.")
    if dados.nome is not None:
        usuario.nome = dados.nome.strip()
    if dados.perfil is not None:
        usuario.perfil = dados.perfil
    if dados.ativo is not None and dados.ativo != usuario.ativo:
        usuario.ativo = dados.ativo
        usuario.versao_sessao += 1  # derruba as sessões abertas
    if dados.senha is not None:
        validar_senha_nova(dados.senha)
        usuario.senha_hash = gerar_hash(dados.senha)
        usuario.versao_sessao += 1
    db.commit()
    return usuario
