"""Initial schema — create all tables and migrate resource_specs columns.

Handles both fresh deployments (tables don't exist) and existing deployments
(tables exist but resource_specs may have old cost_type column instead of
gpus_per_instance).

Revision ID: 001_initial
Revises: -
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    """Check if a table already exists in the database."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :t"
        ),
        {"t": table_name},
    )
    return result.fetchone() is not None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column exists in a table."""
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": table_name, "c": column_name},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    # ── 1. Create tables if they don't exist (fresh deployment) ──

    if not _table_exists("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
            sa.Column("hashed_password", sa.String(255), nullable=False),
            sa.Column("display_name", sa.String(255), nullable=False),
            sa.Column("is_admin", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists("pipelines"):
        op.create_table(
            "pipelines",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.String(1024), nullable=True),
            sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("current_version_id", sa.Integer, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists("pipeline_versions"):
        op.create_table(
            "pipeline_versions",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("pipeline_id", sa.Integer, sa.ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False),
            sa.Column("version_number", sa.Integer, nullable=False),
            sa.Column("config", sa.JSON, nullable=False),
            sa.Column("cost_snapshot", sa.JSON, nullable=True),
            sa.Column("description", sa.String(1024), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists("resource_specs"):
        op.create_table(
            "resource_specs",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("gpu_type", sa.String(255), nullable=False),
            sa.Column("gpu_count", sa.Integer, nullable=False, server_default="1"),
            sa.Column("cost_per_unit", sa.Float, nullable=False),
            sa.Column("gpus_per_instance", sa.Integer, nullable=True),
            sa.Column("gpus_per_machine", sa.Integer, nullable=True),
            sa.Column("qps_per_instance", sa.Float, nullable=True),
            sa.Column("avg_response_time_ms", sa.Float, nullable=True),
            sa.Column("is_system", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists("module_templates"):
        op.create_table(
            "module_templates",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.String(1024), nullable=True),
            sa.Column("config", sa.JSON, nullable=False),
            sa.Column("is_global", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if not _table_exists("share_links"):
        op.create_table(
            "share_links",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("pipeline_id", sa.Integer, sa.ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False),
            sa.Column("version_id", sa.Integer, sa.ForeignKey("pipeline_versions.id", ondelete="SET NULL"), nullable=True),
            sa.Column("token", sa.String(64), unique=True, nullable=False, index=True),
            sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # ── 2. Migrate resource_specs for existing deployments ──

    if _table_exists("resource_specs"):
        # Add gpus_per_instance if missing
        if not _column_exists("resource_specs", "gpus_per_instance"):
            op.add_column("resource_specs", sa.Column("gpus_per_instance", sa.Integer, nullable=True))

        # Drop legacy cost_type column
        if _column_exists("resource_specs", "cost_type"):
            op.drop_column("resource_specs", "cost_type")


def downgrade() -> None:
    # Reverse the column changes on resource_specs
    if _table_exists("resource_specs"):
        if not _column_exists("resource_specs", "cost_type"):
            op.add_column("resource_specs", sa.Column("cost_type", sa.String(20), nullable=True))
        if _column_exists("resource_specs", "gpus_per_instance"):
            op.drop_column("resource_specs", "gpus_per_instance")

    # Drop tables in reverse dependency order
    for table in ("share_links", "module_templates", "resource_specs",
                  "pipeline_versions", "pipelines", "users"):
        if _table_exists(table):
            op.drop_table(table)
