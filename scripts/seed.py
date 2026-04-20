"""Seed script to populate the database with sample products"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.postgres import async_session
from app.models.postgres import Product, Customer, Order

SAMPLE_PRODUCTS = [
    {
        "name": "iPhone 15 Pro",
        "description": "Apple iPhone 15 Pro with A17 Pro chip, 6.1-inch Super Retina XDR display, titanium design, 48MP camera system, USB-C, and all-day battery life.",
        "price": 999.00,
        "compare_at_price": 1099.00,
        "sku": "APPL-IP15P-128",
        "category": "smartphones",
        "tags": ["apple", "iphone", "5g", "premium"],
        "image_urls": ["https://example.com/iphone15pro.jpg"],
        "stock_quantity": 50,
        "status": "active",
    },
    {
        "name": "Samsung Galaxy S24 Ultra",
        "description": "Samsung Galaxy S24 Ultra with Snapdragon 8 Gen 3, 6.8-inch Dynamic AMOLED display, 200MP camera, S Pen, titanium frame, and AI features.",
        "price": 1299.99,
        "compare_at_price": 1399.99,
        "sku": "SAMS-S24U-256",
        "category": "smartphones",
        "tags": ["samsung", "galaxy", "5g", "android", "s-pen"],
        "image_urls": ["https://example.com/galaxys24ultra.jpg"],
        "stock_quantity": 35,
        "status": "active",
    },
    {
        "name": "MacBook Air M3",
        "description": "Apple MacBook Air with M3 chip, 15.3-inch Liquid Retina display, 18-hour battery life, fanless design, MagSafe charging, and Thunderbolt ports.",
        "price": 1299.00,
        "compare_at_price": None,
        "sku": "APPL-MBA-M3-15",
        "category": "laptops",
        "tags": ["apple", "macbook", "m3", "lightweight"],
        "image_urls": ["https://example.com/macbookairm3.jpg"],
        "stock_quantity": 25,
        "status": "active",
    },
    {
        "name": "Sony WH-1000XM5",
        "description": "Sony WH-1000XM5 wireless noise cancelling headphones with industry-leading ANC, 30-hour battery, multipoint connection, and premium sound quality.",
        "price": 349.99,
        "compare_at_price": 399.99,
        "sku": "SONY-WH1000XM5",
        "category": "headphones",
        "tags": ["sony", "noise-cancelling", "wireless", "premium"],
        "image_urls": ["https://example.com/sonywh1000xm5.jpg"],
        "stock_quantity": 60,
        "status": "active",
    },
    {
        "name": "AirPods Pro 2",
        "description": "Apple AirPods Pro 2nd generation with H2 chip, adaptive audio, active noise cancellation, personalized spatial audio, and USB-C charging case.",
        "price": 249.00,
        "compare_at_price": None,
        "sku": "APPL-APP2-USBC",
        "category": "headphones",
        "tags": ["apple", "airpods", "noise-cancelling", "wireless"],
        "image_urls": ["https://example.com/airpodspro2.jpg"],
        "stock_quantity": 100,
        "status": "active",
    },
    {
        "name": "Dell XPS 15",
        "description": "Dell XPS 15 laptop with Intel Core i7-13700H, 15.6-inch OLED display, NVIDIA RTX 4060, 16GB RAM, 512GB SSD, premium build quality.",
        "price": 1499.00,
        "compare_at_price": 1699.00,
        "sku": "DELL-XPS15-I7",
        "category": "laptops",
        "tags": ["dell", "windows", "oled", "gaming"],
        "image_urls": ["https://example.com/dellxps15.jpg"],
        "stock_quantity": 15,
        "status": "active",
    },
    {
        "name": "PlayStation 5 Slim",
        "description": "Sony PlayStation 5 Slim with 1TB SSD, DualSense controller, 4K gaming at 120fps, ray tracing, and backward compatibility with PS4 games.",
        "price": 449.99,
        "compare_at_price": 499.99,
        "sku": "SONY-PS5-SLIM",
        "category": "gaming",
        "tags": ["sony", "playstation", "console", "4k"],
        "image_urls": ["https://example.com/ps5slim.jpg"],
        "stock_quantity": 20,
        "status": "active",
    },
    {
        "name": "Amazon Echo Dot 5th Gen",
        "description": "Amazon Echo Dot 5th generation smart speaker with Alexa, improved sound, temperature sensor, and smart home hub capabilities.",
        "price": 49.99,
        "compare_at_price": 59.99,
        "sku": "AMZN-ECHO-DOT5",
        "category": "smart-home",
        "tags": ["amazon", "alexa", "smart-speaker", "budget"],
        "image_urls": ["https://example.com/echodot5.jpg"],
        "stock_quantity": 200,
        "status": "active",
    },
    {
        "name": "Google Pixel 8 Pro",
        "description": "Google Pixel 8 Pro with Tensor G3 chip, 6.7-inch LTPO OLED display, 50MP triple camera system, 7 years of updates, and advanced AI features.",
        "price": 999.00,
        "compare_at_price": 1099.00,
        "sku": "GOOG-PIX8P-128",
        "category": "smartphones",
        "tags": ["google", "pixel", "android", "ai"],
        "image_urls": ["https://example.com/pixel8pro.jpg"],
        "stock_quantity": 30,
        "status": "active",
    },
    {
        "name": "Nintendo Switch OLED",
        "description": "Nintendo Switch OLED model with 7-inch OLED screen, 64GB storage, wide adjustable stand, wired LAN port, and enhanced audio.",
        "price": 349.99,
        "compare_at_price": None,
        "sku": "NINT-SW-OLED",
        "category": "gaming",
        "tags": ["nintendo", "switch", "portable", "oled"],
        "image_urls": ["https://example.com/switcholed.jpg"],
        "stock_quantity": 40,
        "status": "active",
    },
    {
        "name": 'Samsung 65" QLED 4K Smart TV',
        "description": "Samsung 65-inch QLED 4K Smart TV with Quantum HDR, Object Tracking Sound, Gaming Hub, and Alexa built-in.",
        "price": 899.99,
        "compare_at_price": 1199.99,
        "sku": "SAMS-Q65-QLED",
        "category": "smart-home",
        "tags": ["samsung", "tv", "4k", "qled", "smart-tv"],
        "image_urls": ["https://example.com/samsungqled65.jpg"],
        "stock_quantity": 10,
        "status": "active",
    },
    {
        "name": "Logitech MX Master 3S",
        "description": "Logitech MX Master 3S wireless mouse with 8K DPI sensor, quiet clicks, ergonomic design, USB-C charging, and multi-device support.",
        "price": 99.99,
        "compare_at_price": None,
        "sku": "LOGI-MXM3S",
        "category": "accessories",
        "tags": ["logitech", "mouse", "wireless", "ergonomic"],
        "image_urls": ["https://example.com/mxmaster3s.jpg"],
        "stock_quantity": 75,
        "status": "active",
    },
]


async def seed():
    async with async_session() as session:
        existing = await session.execute(Product.__table__.select().limit(1))
        if existing.scalars().first():
            print("Database already has products. Skipping seed.")
            return

        products = [Product(**p) for p in SAMPLE_PRODUCTS]
        session.add_all(products)
        await session.commit()
        print(f"Seeded {len(products)} products successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
