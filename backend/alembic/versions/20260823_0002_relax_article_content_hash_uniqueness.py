"""Relax article content hash uniqueness.

Revision ID: 20260823_0002
Revises: 20260823_0001
Create Date: 2026-08-23 00:10:00
"""
from alembic import op


revision = "20260823_0002"
down_revision = "20260823_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_articles_content_hash", table_name="articles")
    op.create_index("ix_articles_content_hash", "articles", ["content_hash"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_articles_content_hash", table_name="articles")
    op.create_index("ix_articles_content_hash", "articles", ["content_hash"], unique=True)
