"""add source ingestion runs and listing gone timestamp

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "source_listings",
        sa.Column("gone_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "source_ingestion_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="running",
            nullable=False,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "records_seen",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "listings_created",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "listings_updated",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "listings_marked_gone",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "source ~ '^[a-z0-9_]{2,30}$'",
            name=op.f("ck_source_ingestion_runs_source_shape"),
        ),
        sa.CheckConstraint(
            "status IN ('running', 'succeeded', 'failed')",
            name=op.f("ck_source_ingestion_runs_status_valid"),
        ),
        sa.CheckConstraint(
            "records_seen >= 0 AND listings_created >= 0 "
            "AND listings_updated >= 0 AND listings_marked_gone >= 0",
            name=op.f("ck_source_ingestion_runs_counts_nonnegative"),
        ),
    )

    op.create_index(
        "ix_source_ingestion_runs_source_started",
        "source_ingestion_runs",
        ["source", "started_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_source_ingestion_runs_source_started",
        table_name="source_ingestion_runs",
    )
    op.drop_table("source_ingestion_runs")
    op.drop_column("source_listings", "gone_at")
