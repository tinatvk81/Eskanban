"""add geography and property files

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-10 15:04:11.047067
"""
import json
from pathlib import Path

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


GEO_FILE = Path(__file__).resolve().parents[1] / "data" / "iran_geo_v3_2017.json"


def _normalize(name: str) -> str:
    # Frozen copy of the search normalisation, so this migration never changes meaning.
    return " ".join(name.replace("ي", "ی").replace("ك", "ک").replace("\u200c", " ").split()).lower()


def _seed_geography() -> None:
    data = json.loads(GEO_FILE.read_text(encoding="utf-8"))
    provinces = sa.table("provinces", sa.column("code", sa.Integer), sa.column("name", sa.String))
    op.bulk_insert(provinces, [{"code": p["code"], "name": p["name"]} for p in data["provinces"]])
    ids = {code: pid for code, pid in op.get_bind().execute(sa.text("SELECT code, id FROM provinces"))}
    cities = sa.table(
        "cities",
        sa.column("province_id", sa.Integer),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("name_normalized", sa.String),
    )
    op.bulk_insert(
        cities,
        [
            {
                "province_id": ids[p["code"]],
                "code": c["code"],
                "name": c["name"],
                "name_normalized": _normalize(c["name"]),
            }
            for p in data["provinces"]
            for c in p["cities"]
        ],
    )


def upgrade() -> None:
    op.create_table('provinces',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=60), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_provinces')),
    sa.UniqueConstraint('code', name=op.f('uq_provinces_code')),
    sa.UniqueConstraint('name', name=op.f('uq_provinces_name'))
    )
    op.create_table('cities',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('province_id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=20), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('name_normalized', sa.String(length=80), nullable=False),
    sa.ForeignKeyConstraint(['province_id'], ['provinces.id'], name=op.f('fk_cities_province_id_provinces'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_cities')),
    sa.UniqueConstraint('code', name=op.f('uq_cities_code')),
    sa.UniqueConstraint('province_id', 'name', name='uq_cities_province_name')
    )
    op.create_index(op.f('ix_cities_name_normalized'), 'cities', ['name_normalized'], unique=False)
    op.create_index(op.f('ix_cities_province_id'), 'cities', ['province_id'], unique=False)
    _seed_geography()
    op.create_table('properties',
    sa.Column('version', sa.Integer(), server_default='1', nullable=False),
    sa.Column('owner_user_id', sa.Uuid(), nullable=False),
    sa.Column('shared_with_agency', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('deal_type', sa.String(length=20), nullable=False),
    sa.Column('status', sa.String(length=20), server_default='active', nullable=False),
    sa.Column('deal_date', sa.Date(), nullable=True),
    sa.Column('property_types', postgresql.ARRAY(sa.String(length=30)), server_default=sa.text("'{}'"), nullable=False),
    sa.Column('city_id', sa.Integer(), nullable=False),
    sa.Column('district', sa.String(length=80), nullable=True),
    sa.Column('address', sa.String(length=255), nullable=True),
    sa.Column('location_url', sa.String(length=500), nullable=True),
    sa.Column('land_area_m2', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('built_area_m2', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('main_area_m2', sa.Numeric(precision=10, scale=2), sa.Computed('coalesce(built_area_m2, land_area_m2)', persisted=True), nullable=True),
    sa.Column('rooms', sa.SmallInteger(), nullable=True),
    sa.Column('floor', sa.SmallInteger(), nullable=True),
    sa.Column('total_floors', sa.SmallInteger(), nullable=True),
    sa.Column('total_units', sa.SmallInteger(), nullable=True),
    sa.Column('build_year', sa.SmallInteger(), nullable=True),
    sa.Column('direction', sa.String(length=10), nullable=True),
    sa.Column('is_corner', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('amenities', postgresql.ARRAY(sa.String(length=30)), server_default=sa.text("'{}'"), nullable=False),
    sa.Column('custom_amenities', postgresql.ARRAY(sa.String(length=60)), server_default=sa.text("'{}'"), nullable=False),
    sa.Column('document_type', sa.String(length=20), nullable=True),
    sa.Column('document_note', sa.String(length=200), nullable=True),
    sa.Column('ownership_dang', sa.SmallInteger(), server_default='6', nullable=False),
    sa.Column('occupancy', sa.String(length=20), nullable=True),
    sa.Column('vacate_date', sa.Date(), nullable=True),
    sa.Column('owner_name', sa.String(length=120), nullable=True),
    sa.Column('owner_phone', sa.String(length=16), nullable=True),
    sa.Column('price_total', sa.BigInteger(), nullable=True),
    sa.Column('price_per_m2', sa.BigInteger(), nullable=True),
    sa.Column('deposit', sa.BigInteger(), nullable=True),
    sa.Column('monthly_rent', sa.BigInteger(), nullable=True),
    sa.Column('convertible_options', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
    sa.Column('price_note', sa.String(length=500), nullable=True),
    sa.Column('sort_price', sa.BigInteger(), sa.Computed("CASE WHEN deal_type = 'rent' THEN monthly_rent ELSE coalesce(price_total, deposit) END", persisted=True), nullable=True),
    sa.Column('contract_end_date', sa.Date(), nullable=True),
    sa.Column('delivery_date', sa.Date(), nullable=True),
    sa.Column('payment_terms', sa.String(length=1000), nullable=True),
    sa.Column('is_urgent', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    sa.Column('urgent_until', sa.Date(), nullable=True),
    sa.Column('notes', sa.String(length=2000), nullable=True),
    sa.Column('search_text', sa.Text(), server_default='', nullable=False),
    sa.Column('last_confirmed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('review_due_at', sa.Date(), nullable=True),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by_user_id', sa.Uuid(), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('agency_id', sa.Uuid(), nullable=False),
    sa.CheckConstraint("amenities <@ ARRAY['elevator', 'parking', 'storage', 'balcony', 'yard', 'roof_garden', 'pool', 'sauna', 'jacuzzi', 'gym', 'lobby', 'security', 'caretaker', 'package_heating', 'radiator', 'split_ac', 'evaporative_cooler', 'fan_coil', 'chiller', 'built_in_wardrobe', 'anti_theft_door', 'double_glazed', 'master_bath', 'open_kitchen', 'renovated', 'new_build', 'unused']::varchar[]", name=op.f('ck_properties_amenities_valid')),
    sa.CheckConstraint("deal_type IN ('sale', 'presale', 'rent', 'mortgage')", name=op.f('ck_properties_deal_type_valid')),
    sa.CheckConstraint("direction IS NULL OR direction IN ('north', 'south', 'east', 'west')", name=op.f('ck_properties_direction_valid')),
    sa.CheckConstraint("document_type IS NULL OR document_type IN ('tak_barg', 'mangoole_dar', 'qolnameh', 'waqfi', 'other')", name=op.f('ck_properties_document_type_valid')),
    sa.CheckConstraint("occupancy IS NULL OR occupancy IN ('vacant', 'owner_occupied', 'tenant_occupied')", name=op.f('ck_properties_occupancy_valid')),
    sa.CheckConstraint("property_types <@ ARRAY['apartment', 'villa', 'old_house', 'land', 'demolishable', 'commercial_office', 'shop', 'office', 'workshop', 'educational', 'garden', 'industrial', 'other']::varchar[]", name=op.f('ck_properties_property_types_valid')),
    sa.CheckConstraint("status IN ('active', 'inactive', 'closed')", name=op.f('ck_properties_status_valid')),
    sa.CheckConstraint('build_year IS NULL OR build_year BETWEEN 1200 AND 1600', name=op.f('ck_properties_build_year_valid')),
    sa.CheckConstraint('coalesce(land_area_m2, 0) >= 0 AND coalesce(built_area_m2, 0) >= 0', name=op.f('ck_properties_areas_non_negative')),
    sa.CheckConstraint('coalesce(price_total, 0) >= 0 AND coalesce(price_per_m2, 0) >= 0 AND coalesce(deposit, 0) >= 0 AND coalesce(monthly_rent, 0) >= 0', name=op.f('ck_properties_prices_non_negative')),
    sa.CheckConstraint('floor IS NULL OR floor BETWEEN -10 AND 200', name=op.f('ck_properties_floor_valid')),
    sa.CheckConstraint('ownership_dang BETWEEN 1 AND 6', name=op.f('ck_properties_dang_valid')),
    sa.ForeignKeyConstraint(['agency_id'], ['agencies.id'], name=op.f('fk_properties_agency_id_agencies'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['city_id'], ['cities.id'], name=op.f('fk_properties_city_id_cities'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['deleted_by_user_id'], ['users.id'], name=op.f('fk_properties_deleted_by_user_id_users'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['owner_user_id'], ['users.id'], name=op.f('fk_properties_owner_user_id_users'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_properties'))
    )
    op.create_index(op.f('ix_properties_agency_id'), 'properties', ['agency_id'], unique=False)
    op.create_index('ix_properties_agency_status', 'properties', ['agency_id', 'status'], unique=False)
    op.create_index('ix_properties_amenities_gin', 'properties', ['amenities'], unique=False, postgresql_using='gin')
    op.create_index(op.f('ix_properties_city_id'), 'properties', ['city_id'], unique=False)
    op.create_index('ix_properties_contract_end_date', 'properties', ['contract_end_date'], unique=False)
    op.create_index(op.f('ix_properties_owner_user_id'), 'properties', ['owner_user_id'], unique=False)
    op.create_index('ix_properties_property_types_gin', 'properties', ['property_types'], unique=False, postgresql_using='gin')
    op.create_table('property_favorites',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('property_id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('agency_id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['agency_id'], ['agencies.id'], name=op.f('fk_property_favorites_agency_id_agencies'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['property_id'], ['properties.id'], name=op.f('fk_property_favorites_property_id_properties'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_property_favorites_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id', 'property_id', name=op.f('pk_property_favorites'))
    )
    op.create_index(op.f('ix_property_favorites_agency_id'), 'property_favorites', ['agency_id'], unique=False)
    op.create_table('property_history',
    sa.Column('property_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('action', sa.String(length=30), nullable=False),
    sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('agency_id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['agency_id'], ['agencies.id'], name=op.f('fk_property_history_agency_id_agencies'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['property_id'], ['properties.id'], name=op.f('fk_property_history_property_id_properties'), ondelete='RESTRICT'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_property_history_user_id_users'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_property_history'))
    )
    op.create_index(op.f('ix_property_history_agency_id'), 'property_history', ['agency_id'], unique=False)
    op.create_index('ix_property_history_property_created', 'property_history', ['property_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_property_history_property_created', table_name='property_history')
    op.drop_index(op.f('ix_property_history_agency_id'), table_name='property_history')
    op.drop_table('property_history')
    op.drop_index(op.f('ix_property_favorites_agency_id'), table_name='property_favorites')
    op.drop_table('property_favorites')
    op.drop_index('ix_properties_property_types_gin', table_name='properties', postgresql_using='gin')
    op.drop_index(op.f('ix_properties_owner_user_id'), table_name='properties')
    op.drop_index('ix_properties_contract_end_date', table_name='properties')
    op.drop_index(op.f('ix_properties_city_id'), table_name='properties')
    op.drop_index('ix_properties_amenities_gin', table_name='properties', postgresql_using='gin')
    op.drop_index('ix_properties_agency_status', table_name='properties')
    op.drop_index(op.f('ix_properties_agency_id'), table_name='properties')
    op.drop_table('properties')
    op.drop_index(op.f('ix_cities_province_id'), table_name='cities')
    op.drop_index(op.f('ix_cities_name_normalized'), table_name='cities')
    op.drop_table('cities')
    op.drop_table('provinces')
