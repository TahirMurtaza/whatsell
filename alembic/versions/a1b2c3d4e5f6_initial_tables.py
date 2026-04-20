"""initial tables

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-04-08 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("phone", sa.String(20), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("address", sa.JSON(), nullable=True),
        sa.Column("preferences", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("compare_at_price", sa.Float(), nullable=True),
        sa.Column("sku", sa.String(100), unique=True, nullable=True, index=True),
        sa.Column("category", sa.String(100), nullable=True, index=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("image_urls", sa.JSON(), nullable=True),
        sa.Column("stock_quantity", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("embedding", Vector(3072), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "order_number", sa.String(50), unique=True, nullable=False, index=True
        ),
        sa.Column(
            "customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=False
        ),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("subtotal", sa.Float(), nullable=False),
        sa.Column("tax", sa.Float(), server_default="0.0"),
        sa.Column("shipping", sa.Float(), server_default="0.0"),
        sa.Column("total", sa.Float(), nullable=False),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("payment_status", sa.String(50), server_default="pending"),
        sa.Column("payment_link", sa.String(500), nullable=True),
        sa.Column("shipping_address", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source", sa.String(50), server_default="chatbot"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("orders")
    op.drop_table("products")
    op.drop_table("customers")
