-- Aiven role bootstrap (ADR 0002) — run as avnadmin AFTER `alembic upgrade head`.
--
-- Creates the least-privilege application role the API connects as. RLS only isolates rows for a
-- NON-superuser, NON-BYPASSRLS connection, so the app must NOT use avnadmin at request time.
--
--   psql "$MIGRATION_DATABASE_URL" -f aiven_setup.sql
--   psql "$MIGRATION_DATABASE_URL" -c "ALTER ROLE matrix_app PASSWORD '<STRONG_PASSWORD>'"
--
-- Re-run the GRANT block after future migrations so new tables are covered (or rely on the
-- ALTER DEFAULT PRIVILEGES below for tables created by avnadmin going forward).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matrix_app') THEN
    CREATE ROLE matrix_app LOGIN;
  END IF;
END
$$;

ALTER ROLE matrix_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
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
