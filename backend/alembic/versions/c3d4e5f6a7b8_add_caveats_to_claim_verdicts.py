"""add caveats to claim_verdicts

Revision ID: c3d4e5f6a7b8
Revises: b7c8d9e0f1a2
Create Date: 2026-10-11
"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("claim_verdicts", sa.Column("caveats", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("claim_verdicts", "caveats")
