-- Initialize database with required extensions

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE aistudio TO postgres;
