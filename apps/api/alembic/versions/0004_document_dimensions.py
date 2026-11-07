"""split property document info into separate dimensions

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-22 12:00:00.000000

document_type   : qolnameh -> informal, official added, waqfi removed
ownership_kind  : new (freehold / waqf); former waqfi files become 'waqf'
deed_scope      : new (land and building / land only / building only)
is_divided      : new (nullable boolean: divided / not divided / unknown)
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None

# Frozen copies of the vocabularies, so this migration never changes meaning when vocab.py does.
OLD_DOCUMENT_TYPES = ('tak_barg', 'mangoole_dar', 'qolnameh', 'waqfi', 'other')
NEW_DOCUMENT_TYPES = ('official', 'tak_barg', 'mangoole_dar', 'informal', 'other')
DEED_SCOPES = ('land_and_building', 'land_only', 'building_only')
OWNERSHIP_KINDS = ('freehold', 'waqf')


def _sql_list(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


def _doc_check(values: tuple[str, ...]) -> sa.CheckConstraint:
    return sa.CheckConstraint(
        f"document_type IS NULL OR document_type IN ({_sql_list(values)})",
        name=op.f('ck_properties_document_type_valid'),
    )


def upgrade() -> None:
    # The old CHECK would reject 'informal', so it goes first.
    op.drop_constraint(op.f('ck_properties_document_type_valid'), 'properties', type_='check')

    op.add_column('properties', sa.Column('is_divided', sa.Boolean(), nullable=True))
    op.add_column('properties', sa.Column('deed_scope', sa.String(length=20), nullable=True))
    op.add_column('properties', sa.Column('ownership_kind', sa.String(length=10), nullable=True))

    # Data migration. A waqf file keeps no document type: it was never one.
    op.execute(
        "UPDATE properties SET ownership_kind = 'waqf', document_type = NULL "
        "WHERE document_type = 'waqfi'"
    )
    op.execute("UPDATE properties SET document_type = 'informal' WHERE document_type = 'qolnameh'")

    op.create_check_constraint(
        op.f('ck_properties_document_type_valid'),
        'properties',
        f"document_type IS NULL OR document_type IN ({_sql_list(NEW_DOCUMENT_TYPES)})",
    )
    op.create_check_constraint(
        op.f('ck_properties_deed_scope_valid'),
        'properties',
        f"deed_scope IS NULL OR deed_scope IN ({_sql_list(DEED_SCOPES)})",
    )
    op.create_check_constraint(
        op.f('ck_properties_ownership_kind_valid'),
        'properties',
        f"ownership_kind IS NULL OR ownership_kind IN ({_sql_list(OWNERSHIP_KINDS)})",
    )


def downgrade() -> None:
    op.drop_constraint(op.f('ck_properties_document_type_valid'), 'properties', type_='check')

    # Lossy by nature: 'official' has no old equivalent, and a waqf file that also had a
    # document type loses that type (the old model had one field for both).
    op.execute("UPDATE properties SET document_type = 'other' WHERE document_type = 'official'")
    op.execute("UPDATE properties SET document_type = 'qolnameh' WHERE document_type = 'informal'")
    op.execute("UPDATE properties SET document_type = 'waqfi' WHERE ownership_kind = 'waqf'")

    op.create_check_constraint(
        op.f('ck_properties_document_type_valid'),
        'properties',
        f"document_type IS NULL OR document_type IN ({_sql_list(OLD_DOCUMENT_TYPES)})",
    )
    op.drop_constraint(op.f('ck_properties_ownership_kind_valid'), 'properties', type_='check')
    op.drop_constraint(op.f('ck_properties_deed_scope_valid'), 'properties', type_='check')
    op.drop_column('properties', 'ownership_kind')
    op.drop_column('properties', 'deed_scope')
    op.drop_column('properties', 'is_divided')
