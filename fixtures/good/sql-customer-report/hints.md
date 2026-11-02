## Hint 1

This is an "anti-join": rows in one table with no matching row in another. `customer_totals.sql` already joins the two tables in a way that keeps customers without orders.

## Hint 2

After a `LEFT JOIN orders`, a customer with no orders has `NULL` in every `orders` column. Filter on that. `NOT EXISTS` works too.

## Hint 3

`SELECT c.name, c.created_at::text AS signed_up FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;`
