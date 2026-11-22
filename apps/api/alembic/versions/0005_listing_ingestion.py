"""add source_listings and listing_inbox (F7 slice S1); properties.source/source_url

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-22 00:00:00.000000

source_listings : global registry of ads discovered on external sites (not tenant-owned)
listing_inbox    : per-agency state on a source_listing (new / dismissed / converted)
properties       : + source, source_url (nullable; set when a file comes from a listing)

`source` columns are validated against the code registry (app/domain/sources.py), not an
enumerated CHECK — new sources need no migration. Only the key's SHAPE is enforced here.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None

SOURCE_KEY_SHAPE = "source ~ '^[a-z0-9_]{2,30}$'"


def upgrade() -> None:
    op.create_table(
        'source_listings',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('source', sa.String(length=30), nullable=False),
        sa.Column('external_id', sa.String(length=120), nullable=False),
        sa.Column('url', sa.String(length=500), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('owner_name', sa.String(length=120), nullable=True),
        sa.Column('owner_phone', sa.String(length=32), nullable=True),
        sa.Column('address', sa.String(length=255), nullable=True),
        sa.Column('city_id', sa.Integer(), nullable=True),
        sa.Column('district', sa.String(length=80), nullable=True),
        sa.Column('deal_type', sa.String(length=20), nullable=True),
        sa.Column(
            'property_types', postgresql.JSONB(astext_type=sa.Text()),
            nullable=False, server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column('price_total', sa.BigInteger(), nullable=True),
        sa.Column('deposit', sa.BigInteger(), nullable=True),
        sa.Column('monthly_rent', sa.BigInteger(), nullable=True),
        sa.Column('posted_at', sa.Date(), nullable=True),
        sa.Column(
            'first_seen_at', sa.DateTime(timezone=True),
            server_default=sa.text('now()'), nullable=False,
        ),
        sa.Column(
            'last_seen_at', sa.DateTime(timezone=True),
            server_default=sa.text('now()'), nullable=False,
        ),
        sa.Column('is_gone', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.ForeignKeyConstraint(['city_id'], ['cities.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(SOURCE_KEY_SHAPE, name=op.f('ck_source_listings_source_shape')),
    )
    op.create_index(
        op.f('ix_source_listings_source_external'),
        'source_listings', ['source', 'external_id'], unique=True,
    )

    op.create_table(
        'listing_inbox',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('agency_id', sa.Uuid(), nullable=False),
        sa.Column('source_listing_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='new', nullable=False),
        sa.Column('converted_property_id', sa.Uuid(), nullable=True),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            server_default=sa.text('now()'), nullable=False,
        ),
        sa.ForeignKeyConstraint(['agency_id'], ['agencies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['source_listing_id'], ['source_listings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['converted_property_id'], ['properties.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "status IN ('new', 'dismissed', 'converted')",
            name=op.f('ck_listing_inbox_status_valid'),
        ),
    )
    op.create_index('ix_listing_inbox_agency_id', 'listing_inbox', ['agency_id'])
    op.create_index(
        op.f('ix_listing_inbox_agency_source'),
        'listing_inbox', ['agency_id', 'source_listing_id'], unique=True,
    )

    op.add_column('properties', sa.Column('source', sa.String(length=30), nullable=True))
    op.add_column('properties', sa.Column('source_url', sa.String(length=500), nullable=True))
    op.create_check_constraint(
        op.f('ck_properties_source_shape'),
        'properties',
        f"source IS NULL OR {SOURCE_KEY_SHAPE}",
    )


def downgrade() -> None:
    op.drop_constraint(op.f('ck_properties_source_shape'), 'properties', type_='check')
    op.drop_column('properties', 'source_url')
    op.drop_column('properties', 'source')

    op.drop_index(op.f('ix_listing_inbox_agency_source'), table_name='listing_inbox')
    op.drop_index('ix_listing_inbox_agency_id', table_name='listing_inbox')
    op.drop_table('listing_inbox')

    op.drop_index(op.f('ix_source_listings_source_external'), table_name='source_listings')
    op.drop_table('source_listings')
