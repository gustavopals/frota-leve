-- Initialization script for PostgreSQL
-- This script runs automatically when the container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE frota_leve TO postgres;
