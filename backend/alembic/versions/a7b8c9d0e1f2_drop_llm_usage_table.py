"""drop_llm_usage_table

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-11-16 00:00:00.000000

LLM usage tracking was removed; drop its table where an earlier local
migration created it.
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'a7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('DROP TABLE IF EXISTS llm_usage')


def downgrade() -> None:
    # The feature is gone; there is nothing to restore the table for.
    pass
