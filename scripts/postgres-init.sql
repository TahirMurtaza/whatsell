-- Create langfuse database if it doesn't exist
-- This script runs only on first postgres container creation (empty data volume).
-- For existing volumes run manually:
--   docker compose exec postgres psql -U whatsell -c "CREATE DATABASE langfuse_db;"
SELECT 'CREATE DATABASE langfuse_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'langfuse_db')\gexec
