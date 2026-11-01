CREATE TABLE customers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  created_at date NOT NULL
);

CREATE TABLE orders (
  id serial PRIMARY KEY,
  customer_id int NOT NULL REFERENCES customers(id),
  amount_cents int NOT NULL,
  placed_at date NOT NULL
);

INSERT INTO customers (name, created_at) VALUES
  ('Ada', '2026-01-03'),
  ('Brook', '2026-01-17'),
  ('Cy', '2026-02-10'),
  ('Dee', '2026-03-01'),
  ('Eli', '2026-03-22');

INSERT INTO orders (customer_id, amount_cents, placed_at) VALUES
  (1, 2500, '2026-01-05'),
  (1, 1200, '2026-02-14'),
  (2, 9900, '2026-01-20'),
  (4, 3700, '2026-03-02');
