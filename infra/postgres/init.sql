CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS matrix_builder_bootstrap (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO matrix_builder_bootstrap (name)
VALUES ('batch-1-foundation')
ON CONFLICT DO NOTHING;
