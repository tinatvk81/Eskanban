"""add login and sessions

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-09 07:48:05.947671
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Phase 1: no production data exists yet. `phone` is mandatory and cannot be invented for
    # existing rows, so refuse (clearly) instead of failing on the NOT NULL column below.
    existing = op.get_bind().execute(sa.text("SELECT count(*) FROM users")).scalar_one()
    if existing:
        raise RuntimeError(
            "migration 0002 needs an empty users table (found %d). Back up and clear the "
            "development data, or add a backfill step for phone numbers." % existing
        )
    op.create_table('auth_sessions',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('user_agent', sa.String(length=255), nullable=True),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_auth_sessions_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_auth_sessions')),
    sa.UniqueConstraint('token_hash', name=op.f('uq_auth_sessions_token_hash'))
    )
    op.create_index(op.f('ix_auth_sessions_user_id'), 'auth_sessions', ['user_id'], unique=False)
    op.add_column('users', sa.Column('phone', sa.String(length=16), nullable=False))
    op.add_column('users', sa.Column('password_hash', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('must_change_password', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('users', sa.Column('failed_login_attempts', sa.Integer(), server_default=sa.text('0'), nullable=False))
    op.add_column('users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True))
    op.alter_column('users', 'email',
               existing_type=sa.VARCHAR(length=254),
               nullable=True)
    op.create_unique_constraint(op.f('uq_users_phone'), 'users', ['phone'])
    op.create_check_constraint(
        op.f('ck_users_failed_attempts_non_negative'), 'users', 'failed_login_attempts >= 0'
    )


def downgrade() -> None:
    op.drop_constraint(op.f('ck_users_failed_attempts_non_negative'), 'users', type_='check')
    op.drop_constraint(op.f('uq_users_phone'), 'users', type_='unique')
    # email becomes mandatory again: give users without one a clearly fake placeholder
    op.execute("UPDATE users SET email = phone || '@placeholder.invalid' WHERE email IS NULL")
    op.alter_column('users', 'email',
               existing_type=sa.VARCHAR(length=254),
               nullable=False)
    op.drop_column('users', 'last_login_at')
    op.drop_column('users', 'locked_until')
    op.drop_column('users', 'failed_login_attempts')
    op.drop_column('users', 'must_change_password')
    op.drop_column('users', 'password_hash')
    op.drop_column('users', 'phone')
    op.drop_index(op.f('ix_auth_sessions_user_id'), table_name='auth_sessions')
    op.drop_table('auth_sessions')
