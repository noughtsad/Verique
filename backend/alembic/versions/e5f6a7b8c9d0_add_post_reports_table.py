"""ensure_post_reports_table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-11-15 22:50:00.000000

A since-removed local migration (add_llm_usage_table) reused revision id
d4e5f6a7b8c9, so a database stamped with that id may lack post_reports.
Create it here only if it is missing; on every other database this is a no-op.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if not inspector.has_table('post_reports'):
        op.create_table(
            'post_reports',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('post_id', sa.Integer(), nullable=False),
            sa.Column('reporter_id', sa.Integer(), nullable=False),
            sa.Column('reason_code', sa.String(length=30), nullable=False),
            sa.Column('details', sa.Text(), nullable=True),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('post_id', 'reporter_id', name='uq_post_report_pair'),
        )
        op.create_index(op.f('ix_post_reports_id'), 'post_reports', ['id'])
        op.create_index(op.f('ix_post_reports_post_id'), 'post_reports', ['post_id'])
        op.create_index(op.f('ix_post_reports_reporter_id'), 'post_reports', ['reporter_id'])


def downgrade() -> None:
    # post_reports belongs to d4e5f6a7b8c9; this revision only filled a gap.
    pass
