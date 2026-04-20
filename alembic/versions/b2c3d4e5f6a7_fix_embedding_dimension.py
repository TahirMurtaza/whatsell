"""fix embedding dimension 768 -> 3072

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-20 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
from pgvector.sqlalchemy import Vector


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old 768-dim column and recreate as 3072-dim
    # (pgvector doesn't support ALTER COLUMN to change dimensions)
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS embedding;")
    op.execute("ALTER TABLE products ADD COLUMN embedding vector(3072);")


def downgrade() -> None:
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS embedding;")
    op.execute("ALTER TABLE products ADD COLUMN embedding vector(768);")
