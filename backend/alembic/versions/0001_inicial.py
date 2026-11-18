"""tabelas iniciais: usuarios e relatos

Revision ID: 0001
Revises:
Create Date: 2026-11-18
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("login", sa.String(60), nullable=False),
        sa.Column("senha_hash", sa.String(255), nullable=False),
        sa.Column("perfil", sa.String(20), nullable=False, server_default="vendedor"),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("versao_sessao", sa.Integer, nullable=False, server_default="1"),
        sa.Column("criado_em", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_usuarios_login", "usuarios", ["login"], unique=True)

    op.create_table(
        "relatos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("vendedor_id", sa.Integer, sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("data", sa.Date, nullable=False),
        sa.Column("cliente", sa.String(200), nullable=False),
        sa.Column("cidade", sa.String(120), nullable=False, server_default=""),
        sa.Column("contato", sa.String(200), nullable=False, server_default=""),
        sa.Column("ata", sa.Text, nullable=False, server_default=""),
        sa.Column("transcricao", sa.Text, nullable=False, server_default=""),
        sa.Column("audio_arquivo", sa.String(255), nullable=False, server_default=""),
        sa.Column("criado_em", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_relatos_vendedor_id", "relatos", ["vendedor_id"])
    op.create_index("ix_relatos_data", "relatos", ["data"])
    op.create_index("ix_relatos_cliente", "relatos", ["cliente"])


def downgrade() -> None:
    op.drop_table("relatos")
    op.drop_table("usuarios")
