"""add_post_reports_table

Revision ID: d4e5f6a7b8c9
Revises: f1a2b3c4d5e6
Create Date: 2026-10-13 10:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
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
    op.drop_index(op.f('ix_post_reports_reporter_id'), table_name='post_reports')
    op.drop_index(op.f('ix_post_reports_post_id'), table_name='post_reports')
    op.drop_index(op.f('ix_post_reports_id'), table_name='post_reports')
    op.drop_table('post_reports')
