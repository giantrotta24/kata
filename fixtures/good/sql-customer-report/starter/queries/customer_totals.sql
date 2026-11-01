SELECT c.name, COALESCE(SUM(o.amount_cents), 0)::int AS total_cents
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name
ORDER BY total_cents DESC, c.name;
