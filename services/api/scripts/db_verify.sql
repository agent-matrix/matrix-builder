-- Production-readiness check for the Matrix Builder schema (run as avnadmin).
--   PSQL_URL="${MIGRATION_DATABASE_URL/+psycopg/}"   # strip SQLAlchemy driver for libpq
--   psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f services/api/scripts/db_verify.sql
--
-- Expect: the workflow + workflow tables present, an alembic_version row, every business
-- table FORCE-RLS, and a matrix_app role that is NOT superuser and does NOT bypass RLS.

\echo '== public tables =='
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;

\echo '== alembic migration head =='
SELECT version_num FROM alembic_version;

\echo '== row-level-security enabled tables =='
SELECT relname FROM pg_class
 WHERE relrowsecurity AND relnamespace = 'public'::regnamespace
 ORDER BY 1;

\echo '== application role (matrix_app must be canlogin, NOT super, NOT bypassrls) =='
SELECT rolname, rolcanlogin, rolsuper, rolbypassrls
  FROM pg_roles WHERE rolname = 'matrix_app';
