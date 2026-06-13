-- Aiven role bootstrap (ADR 0002) — run as avnadmin AFTER `alembic upgrade head`.
--
-- Creates the least-privilege application role the API connects as. RLS only isolates rows for a
-- NON-superuser, NON-BYPASSRLS connection, so the app must NOT use avnadmin at request time.
--
-- NOTE: on Aiven, avnadmin is NOT a real superuser, so it cannot set the SUPERUSER / BYPASSRLS
-- attributes (ALTER ROLE ... NOSUPERUSER fails with "permission denied to alter role"). A freshly
-- CREATEd role is already NOSUPERUSER + NOBYPASSRLS + NOCREATEDB + NOCREATEROLE by default, which
-- is exactly what we want — so we rely on those defaults instead of an ALTER.
--
--   psql "$MIGRATION_DATABASE_URL" -f aiven_setup.sql
--   psql "$MIGRATION_DATABASE_URL" -c "ALTER ROLE matrix_app PASSWORD '<STRONG_PASSWORD>'"

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matrix_app') THEN
    -- Defaults: NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION.
    CREATE ROLE matrix_app LOGIN;
  END IF;
END
$$;

-- Safety check: refuse to proceed if the role somehow has RLS-bypass (would defeat isolation).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matrix_app' AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'matrix_app must not be SUPERUSER or BYPASSRLS (RLS would not isolate rows)';
  END IF;
END
$$;
-- Set/rotate the login password separately (kept out of this committed file):
--   ALTER ROLE matrix_app PASSWORD '<STRONG_PASSWORD>';

GRANT USAGE ON SCHEMA public TO matrix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO matrix_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO matrix_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO matrix_app;

-- Future tables/functions created by avnadmin are granted automatically.
ALTER DEFAULT PRIVILEGES FOR ROLE avnadmin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO matrix_app;
ALTER DEFAULT PRIVILEGES FOR ROLE avnadmin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO matrix_app;
ALTER DEFAULT PRIVILEGES FOR ROLE avnadmin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO matrix_app;
