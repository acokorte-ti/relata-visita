"""Comandos de administração.

Criar o primeiro gerente (na pasta backend):
    ..\\.venv\\Scripts\\python -m app.cli criar-usuario --perfil gerente --login gerente --nome "Gerente de Vendas"
A senha é pedida no terminal (não aparece na tela).
"""
import argparse
import getpass
import sys

from sqlalchemy import select

from .db import SessionLocal
from .migracoes import migrar
from .models import Usuario
from .seguranca import SENHA_MIN, gerar_hash


def criar_usuario(args) -> int:
    migrar()
    login = args.login.strip().lower()
    senha = getpass.getpass("Senha: ")
    if len(senha) < SENHA_MIN:
        print(f"A senha precisa ter pelo menos {SENHA_MIN} caracteres.")
        return 1
    if senha != getpass.getpass("Repita a senha: "):
        print("As senhas não conferem.")
        return 1
    with SessionLocal() as db:
        if db.scalar(select(Usuario).where(Usuario.login == login)):
            print(f"Já existe um usuário com o login '{login}'.")
            return 1
        db.add(Usuario(nome=args.nome, login=login, senha_hash=gerar_hash(senha),
                       perfil=args.perfil))
        db.commit()
    print(f"Usuário '{login}' ({args.perfil}) criado.")
    return 0


# Usuários de teste para o MODO DEMO (sem chave da OpenAI e banco SQLite local).
# Nunca use em produção: o comando se recusa a rodar fora do modo demo.
USUARIOS_DEMO = [
    ("gerente", "Gerente de Vendas (teste)", "gerente", "gerente"),
    ("marcos", "Marcos (teste)", "vendedor", "marcos"),
    ("renato", "Renato (teste)", "vendedor", "renato"),
]


def semear_demo(_args) -> int:
    from . import config
    if not config.DEMO or not config.DATABASE_URL.startswith("sqlite"):
        print("Só funciona no MODO DEMO (sem OPENAI_API_KEY) com o banco SQLite local.")
        return 1
    migrar()
    with SessionLocal() as db:
        for login, nome, perfil, senha in USUARIOS_DEMO:
            u = db.scalar(select(Usuario).where(Usuario.login == login))
            if not u:
                db.add(Usuario(nome=nome, login=login, senha_hash=gerar_hash(senha), perfil=perfil))
                print(f"criado: {login} ({perfil})")
            else:  # já existe: volta nome, perfil e senha para os valores de teste
                u.nome, u.perfil, u.ativo = nome, perfil, True
                u.senha_hash = gerar_hash(senha)
                u.versao_sessao += 1
                print(f"atualizado: {login} ({perfil})")
        db.commit()
    print("Usuários de teste prontos. As senhas estão em backend/app/cli.py (USUARIOS_DEMO).")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(prog="python -m app.cli")
    sub = p.add_subparsers(dest="comando", required=True)
    d = sub.add_parser("semear-demo", help="cria usuários de teste (só no modo demo)")
    d.set_defaults(func=semear_demo)
    c = sub.add_parser("criar-usuario", help="cria um vendedor ou gerente")
    c.add_argument("--login", required=True)
    c.add_argument("--nome", required=True)
    c.add_argument("--perfil", choices=["vendedor", "gerente"], default="vendedor")
    c.set_defaults(func=criar_usuario)
    args = p.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
