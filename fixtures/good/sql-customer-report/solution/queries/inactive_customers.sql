SELECT c.name, c.created_at::text AS signed_up
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);
