import csv
import random
from datetime import datetime, timedelta

random.seed(42)

PRODUCTS = ["Koszulka Premium", "Kubek ceramiczny", "Torba bawełniana", "Notatnik A5", "Długopis metalowy"]
PRICES = {"Koszulka Premium": 79.99, "Kubek ceramiczny": 49.99, "Torba bawełniana": 39.99, "Notatnik A5": 29.99, "Długopis metalowy": 19.99}

end_date = datetime.now().date()
start_date = end_date - timedelta(days=60)

rows = []
order_id = 1000
current = start_date

while current <= end_date:
    daily = random.randint(25, 55)
    if current.weekday() >= 5:
        daily = int(daily * 1.25)
    # Make yesterday specifically good
    if current == end_date - timedelta(days=1):
        daily = int(daily * 1.35)
    for _ in range(daily):
        product = random.choice(PRODUCTS)
        qty = random.randint(1, 4)
        amount = round(PRICES[product] * qty, 2)
        status = "refunded" if random.random() < 0.04 else "completed"
        if status == "refunded":
            amount = -abs(amount)
        rows.append({
            "date": current.isoformat(),
            "order_id": f"ORD-{order_id}",
            "product": product,
            "quantity": qty,
            "amount": amount,
            "status": status,
        })
        order_id += 1
    current += timedelta(days=1)

out = __import__('pathlib').Path(__file__).parent / "sales_data.csv"
with open(out, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["date", "order_id", "product", "quantity", "amount", "status"])
    w.writeheader()
    w.writerows(rows)

print(f"Generated {len(rows)} orders from {start_date} to {end_date}")
