"""
Load Amazon Products dataset from Kaggle into PostgreSQL.

Usage (inside docker):
    docker compose exec api python scripts/load_kaggle_products.py

The script:
  1. Downloads the dataset via kagglehub
  2. Builds a category_id -> category_name lookup from amazon_categories.csv
  3. Streams amazon_products.csv in chunks of 10,000 rows
  4. Upserts rows into the `products` table (skips duplicates by SKU)
  5. Embeddings are NOT generated here — Celery Beat handles that in the background
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import kagglehub
import pandas as pd
from sqlalchemy.dialects.postgresql import insert

from app.db.postgres import sync_engine
from app.models.postgres import Product

DATASET = "asaniczka/amazon-products-dataset-2023-1-4m-products"
CHUNK_SIZE = 10_000


def build_category_map(dataset_path: str) -> dict:
    cat_path = os.path.join(dataset_path, "amazon_categories.csv")
    df = pd.read_csv(cat_path)
    return dict(zip(df["id"], df["category_name"]))


def transform_chunk(chunk: pd.DataFrame, category_map: dict) -> list:
    records = []
    for _, row in chunk.iterrows():
        price = row.get("price", 0.0)
        # Skip records with no valid price
        if not price or pd.isna(price) or float(price) <= 0:
            continue

        list_price = row.get("listPrice", 0.0)
        compare_at = float(list_price) if list_price and not pd.isna(list_price) and float(list_price) > 0 else None

        tags = []
        if row.get("isBestSeller"):
            tags.append("Best Seller")

        category_id = row.get("category_id")
        category = category_map.get(category_id, "Other")

        title = str(row.get("title", ""))[:255]
        asin = str(row.get("asin", ""))

        records.append({
            "name": title,
            "description": None,  # Dataset has no description column
            "price": float(price),
            "compare_at_price": compare_at,
            "sku": asin,
            "category": category,
            "tags": tags,
            "image_urls": [row["imgUrl"]] if row.get("imgUrl") else [],
            "stock_quantity": 100,
            "status": "active",
            "metadata_": {
                "stars": row.get("stars"),
                "reviews": row.get("reviews"),
                "bought_in_last_month": row.get("boughtInLastMonth"),
                "product_url": row.get("productURL"),
            },
        })
    return records


def load(dataset_path: str):
    category_map = build_category_map(dataset_path)
    print(f"Loaded {len(category_map)} categories.")

    products_csv = os.path.join(dataset_path, "amazon_products.csv")
    total_inserted = 0
    chunk_num = 0

    with sync_engine.connect() as conn:
        for chunk in pd.read_csv(products_csv, chunksize=CHUNK_SIZE):
            chunk_num += 1
            records = transform_chunk(chunk, category_map)

            if not records:
                continue

            stmt = insert(Product).values(records)
            # On duplicate SKU (asin), skip — don't overwrite
            stmt = stmt.on_conflict_do_nothing(index_elements=["sku"])
            result = conn.execute(stmt)
            conn.commit()

            total_inserted += result.rowcount
            print(f"  Chunk {chunk_num}: inserted {result.rowcount} rows | Total so far: {total_inserted}")

    print(f"\n✅ Done! Total products inserted: {total_inserted}")


def main():
    print("Downloading Amazon Products dataset from Kaggle...")
    dataset_path = kagglehub.dataset_download(DATASET)
    print(f"Dataset ready at: {dataset_path}")
    print("Files:", os.listdir(dataset_path))
    load(dataset_path)


if __name__ == "__main__":
    main()
