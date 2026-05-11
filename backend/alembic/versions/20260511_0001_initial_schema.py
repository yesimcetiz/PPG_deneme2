"""initial_schema

Revision ID: 0001
Revises:
Create Date: 2026-05-11

Tüm tablolar: users, health_profiles, ppg_results, chat_messages, audit_logs
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ────────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id',              sa.Integer(),    nullable=False),
        sa.Column('email',           sa.String(),     nullable=False),
        sa.Column('full_name',       sa.String(),     nullable=False),
        sa.Column('hashed_password', sa.String(),     nullable=False),
        sa.Column('role',            sa.Enum('user', 'admin', name='userrole'), nullable=False, server_default='user'),
        sa.Column('is_active',       sa.Boolean(),    nullable=False, server_default='true'),
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_id',    'users', ['id'])

    # ── health_profiles ──────────────────────────────────────────
    op.create_table(
        'health_profiles',
        sa.Column('id',              sa.Integer(), nullable=False),
        sa.Column('user_id',         sa.Integer(), nullable=False),
        sa.Column('birth_year',      sa.Integer(), nullable=True),
        sa.Column('height_cm',       sa.Float(),   nullable=True),
        sa.Column('weight_kg',       sa.Float(),   nullable=True),
        sa.Column('gender',          sa.String(),  nullable=True),
        sa.Column('diagnoses',       sa.Text(),    nullable=True),
        sa.Column('medications',     sa.Text(),    nullable=True),
        sa.Column('allergies',       sa.Text(),    nullable=True),
        sa.Column('stress_source',   sa.String(),  nullable=True),
        sa.Column('avg_stress_level',sa.Integer(), nullable=True),
        sa.Column('updated_at',      sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index('ix_health_profiles_id', 'health_profiles', ['id'])

    # ── ppg_results ──────────────────────────────────────────────
    op.create_table(
        'ppg_results',
        sa.Column('id',              sa.Integer(), nullable=False),
        sa.Column('user_id',         sa.Integer(), nullable=False),
        sa.Column('p_stress',        sa.Float(),   nullable=False),
        sa.Column('y_pred_raw',      sa.Integer(), nullable=False),
        sa.Column('y_pred_smooth',   sa.Integer(), nullable=False),
        sa.Column('feature_set_used',sa.String(),  nullable=True),
        sa.Column('mean_hr',         sa.Float(),   nullable=True),
        sa.Column('sdnn',            sa.Float(),   nullable=True),
        sa.Column('rmssd',           sa.Float(),   nullable=True),
        sa.Column('mean_nn',         sa.Float(),   nullable=True),
        sa.Column('session_phase',   sa.String(),  nullable=True),
        sa.Column('notes',           sa.Text(),    nullable=True),
        sa.Column('created_at',      sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ppg_results_id',      'ppg_results', ['id'])
    op.create_index('ix_ppg_results_user_id', 'ppg_results', ['user_id'])
    op.create_index('ix_ppg_results_created', 'ppg_results', ['created_at'])

    # ── chat_messages ────────────────────────────────────────────
    op.create_table(
        'chat_messages',
        sa.Column('id',         sa.Integer(), nullable=False),
        sa.Column('user_id',    sa.Integer(), nullable=False),
        sa.Column('role',       sa.String(),  nullable=False),
        sa.Column('content',    sa.Text(),    nullable=False),
        sa.Column('model_used', sa.String(),  nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_chat_messages_user_id', 'chat_messages', ['user_id'])

    # ── audit_logs ───────────────────────────────────────────────
    op.create_table(
        'audit_logs',
        sa.Column('id',          sa.Integer(), nullable=False),
        sa.Column('user_id',     sa.Integer(), nullable=True),
        sa.Column('action',      sa.String(),  nullable=False),
        sa.Column('resource',    sa.String(),  nullable=True),
        sa.Column('resource_id', sa.String(),  nullable=True),
        sa.Column('ip_address',  sa.String(),  nullable=True),
        sa.Column('created_at',  sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audit_logs_user_id',   'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_action',    'audit_logs', ['action'])
    op.create_index('ix_audit_logs_created_at','audit_logs', ['created_at'])


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('chat_messages')
    op.drop_table('ppg_results')
    op.drop_table('health_profiles')
    op.drop_table('users')
    op.execute("DROP TYPE IF EXISTS userrole")
