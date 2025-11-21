#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Test environment variables
export DATABASE_URL="postgresql://postgres:test@127.0.0.1:5434/vibestudio_test?schema=public"
export REDIS_URL="redis://127.0.0.1:6381"
export NODE_ENV="test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cleanup() {
    echo -e "${YELLOW}Cleaning up test containers...${NC}"
    docker compose -f docker-compose.test.yml down -v 2>/dev/null || true
}

# Set up trap for cleanup on exit
trap cleanup EXIT

echo -e "${GREEN}Starting test containers...${NC}"
docker compose -f docker-compose.test.yml up -d --wait

echo -e "${GREEN}Waiting for PostgreSQL to be ready...${NC}"
until docker exec vibe-studio-test-postgres pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
done

echo -e "${GREEN}Syncing Prisma schema to test database...${NC}"
cd backend
npx prisma db push --skip-generate --accept-data-loss
cd ..

echo -e "${GREEN}Running tests...${NC}"
TEST_TYPE="${1:-all}"

case "$TEST_TYPE" in
    unit)
        echo -e "${GREEN}Running unit tests...${NC}"
        npm run test --workspaces -- --testPathIgnorePatterns="integration|e2e"
        ;;
    integration)
        echo -e "${GREEN}Running integration tests...${NC}"
        npm run test --workspaces -- --testPathPattern="integration"
        ;;
    e2e)
        echo -e "${GREEN}Running E2E tests...${NC}"
        npx playwright test
        ;;
    all)
        echo -e "${GREEN}Running all tests...${NC}"
        npm run test --workspaces
        npx playwright test
        ;;
    *)
        echo -e "${RED}Unknown test type: $TEST_TYPE${NC}"
        echo "Usage: $0 [unit|integration|e2e|all]"
        exit 1
        ;;
esac

echo -e "${GREEN}Tests completed successfully!${NC}"
