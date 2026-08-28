"""add_user_follows_and_bio

Revision ID: e99d22734ac3
Revises: 20260823_0002
Create Date: 2026-08-28 16:40:10.092672
"""
from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = 'e99d22734ac3'
down_revision = '20260823_0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the user_follows association table
    op.create_table('user_follows',
    sa.Column('follower_id', sa.Integer(), nullable=False),
    sa.Column('followed_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['followed_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['follower_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('follower_id', 'followed_id'),
    sa.UniqueConstraint('follower_id', 'followed_id', name='uq_follow_pair')
    )
    # Add optional bio column to users
    op.add_column('users', sa.Column('bio', sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'bio')
    op.drop_table('user_follows')
