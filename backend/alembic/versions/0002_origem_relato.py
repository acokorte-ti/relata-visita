"""relatos.origem: se o relato foi feito por voz ou por texto

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-18
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("relatos") as t:
        t.add_column(sa.Column("origem", sa.String(10), nullable=False, server_default="voz"))


def downgrade() -> None:
    with op.batch_alter_table("relatos") as t:
        t.drop_column("origem")
