"""add_refresh_token

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-11

users tablosuna refresh token alanları eklendi:
- refresh_token_hash: Token'ın bcrypt hash'i (güvenlik için düz token saklanmaz)
- refresh_token_expires_at: Token'ın son kullanma tarihi
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('refresh_token_hash', sa.String(), nullable=True)
    )
    op.add_column(
        'users',
        sa.Column('refresh_token_expires_at', sa.DateTime(timezone=True), nullable=True)
    )
    # Hash üzerinden hızlı arama için index
    op.create_index('ix_users_refresh_token_hash', 'users', ['refresh_token_hash'])


def downgrade() -> None:
    op.drop_index('ix_users_refresh_token_hash', table_name='users')
    op.drop_column('users', 'refresh_token_expires_at')
    op.drop_column('users', 'refresh_token_hash')
