# PostgreSQL
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Boolean,
    Text,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from pgvector.sqlalchemy import Vector
from app.db.postgres import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    compare_at_price = Column(Float, nullable=True)
    sku = Column(String(100), unique=True, nullable=True, index=True)
    category = Column(String(100), nullable=True, index=True)
    tags = Column(JSON, nullable=True)
    image_urls = Column(JSON, nullable=True)
    stock_quantity = Column(Integer, default=0)
    status = Column(String(20), default="active")
    metadata_ = Column("metadata", JSON, nullable=True)
    embedding = Column(Vector(3072), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(JSON, nullable=True)
    preferences = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    orders = relationship("Order", back_populates="customer")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    items = Column(JSON, nullable=False)
    subtotal = Column(Float, nullable=False)
    tax = Column(Float, default=0.0)
    shipping = Column(Float, default=0.0)
    total = Column(Float, nullable=False)
    status = Column(String(50), default="pending")
    payment_status = Column(String(50), default="pending")
    payment_link = Column(String(500), nullable=True)
    shipping_address = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    source = Column(String(50), default="chatbot")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer = relationship("Customer", back_populates="orders")


# ---------------------------------------------------------------------------
# Knowledge Base Models
# ---------------------------------------------------------------------------


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(255), nullable=True, index=True)  # None = global
    filename = Column(String(500), nullable=False)
    content_type = Column(String(200), nullable=True)
    status = Column(String(20), default="pending")  # pending | processing | ready | error
    error_msg = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    chunks = relationship(
        "DocumentChunk", back_populates="document", cascade="all, delete-orphan"
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(3072), nullable=True)  # gemini-embedding-001 → 3072 dims

    document = relationship("Document", back_populates="chunks")
