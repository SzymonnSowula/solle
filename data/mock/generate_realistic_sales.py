#!/usr/bin/env python3
"""Generate realistic mock sales data with seasonality, weekend spikes, trends."""

import csv
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(42)

PRODUCTS = [
    ("Koszulka Premium", 79.99, 0.15),
    ("Kubek ceramiczny", 49.99, 0.12),
    ("Długopis metalowy", 19.99, 0.18),
    ("Torba bawełniana", 39.99, 0.14),
    ("Notatnik A5", 29.99, 0.16),
    ("Plecak miejski", 149.99, 0.08),
    ("Bidon sportowy", 34.99, 0.10),
    ("Czapka z daszkiem", 59.99, 0.07),
]

STATUSES = ["completed", "completed", "completed", "completed", "completed", "refunded", "cancelled"]

START_DATE = date(2026, 2, 1)
DAYS = 90
OUTPUT = Path(__file__).with_name("sales_data.csv")


def daily_multiplier(d: date) -> float:
    """Return multiplier for date based on weekday and seasonality."""
    base = 1.0
    # Weekend spike
    if d.weekday() >= 5:
        base *= 1.6
    # Monday dip
    elif d.weekday() == 0:
        base *= 0.85
    # March spring trend
    if d.month == 3:
        base *= 1.25
    # May holiday bump
    if d.month == 5 and d.day >= 1:
        base *= 1.35
    # Random daily noise
    base *= random.uniform(0.85, 1.15)
    return base


def generate():
    order_id = 1000
    rows = []
    current_date = START_DATE
    for _ in range(DAYS):
        mult = daily_multiplier(current_date)
        base_orders = int(random.gauss(12, 4) * mult)
        n_orders = max(0, base_orders)
        for _ in range(n_orders):
            product, price, return_rate = random.choice(PRODUCTS)
            qty = random.choices([1, 2, 3, 4], weights=[60, 25, 10, 5])[0]
            status = random.choices(STATUSES, weights=[85, 5, 5, 3, 2, 3, 2])[0]
            # Refunds more likely for expensive items
            if random.random() < return_rate:
                status = "refunded"
            amount = round(price * qty, 2)
            rows.append({
                "date": current_date.isoformat(),
                "order_id": f"ORD-{order_id}",
                "product": product,
                "quantity": qty,
                "amount": amount,
                "status": status,
            })
            order_id += 1
        current_date += timedelta(days=1)

    with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "order_id", "product", "quantity", "amount", "status"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} orders across {DAYS} days → {OUTPUT}")


if __name__ == "__main__":
    generate()
