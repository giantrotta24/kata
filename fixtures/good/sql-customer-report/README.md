# Customer report: who never ordered

The reporting folder `starter/queries/` already has `customer_totals.sql`, which lists every customer with their lifetime spend. Its tests pass; keep them passing.

Add the next report: **`starter/queries/inactive_customers.sql`** should list the customers who have never placed an order.

- Columns: `name`, and `signed_up` as `YYYY-MM-DD` text (cast with `::text`).
- Row order doesn't matter.

## Schema

```sql
customers (id serial PRIMARY KEY, name text NOT NULL, created_at date NOT NULL)
orders    (id serial PRIMARY KEY, customer_id int NOT NULL REFERENCES customers(id),
           amount_cents int NOT NULL, placed_at date NOT NULL)
```

Each submit runs your SQL against a fresh Postgres database seeded with a few customers and orders.
