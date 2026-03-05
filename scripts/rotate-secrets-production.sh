#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# rotate-secrets-production.sh
#
# Rotates secrets on the production server via SSH.
# Updates .env.docker on the server with new generated secrets, then
# restarts services so the new secrets take effect.
#
# IMPORTANT: Run this BEFORE open-sourcing the repo to invalidate
# all secrets that were previously committed to git history.
#
# Usage: bash scripts/rotate-secrets-production.sh
# ============================================================================

echo "=== Generating new secrets ==="

NEW_POSTGRES_PW=$(openssl rand -hex 64)
NEW_JWT_SECRET=$(openssl rand -hex 64)
NEW_JWT_REFRESH=$(openssl rand -hex 32)
NEW_INTERNAL_SECRET=$(openssl rand -hex 32)

echo "New POSTGRES_PASSWORD: ${NEW_POSTGRES_PW:0:16}..."
echo "New JWT_SECRET:        ${NEW_JWT_SECRET:0:16}..."
echo "New JWT_REFRESH:       ${NEW_JWT_REFRESH:0:16}..."
echo "New INTERNAL_SECRET:   ${NEW_INTERNAL_SECRET:0:16}..."
echo ""

echo "=== WARNING ==="
echo "This will:"
echo "  1. SSH to the production server (hostinger)"
echo "  2. Update .env.docker with new secrets"
echo "  3. Update the PostgreSQL password in the running database"
echo "  4. Restart backend + postgres containers"
echo ""
echo "All existing JWT tokens will be invalidated (users must re-login)."
echo ""
read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "=== Updating production secrets via SSH ==="

ssh hostinger << ENDSSH
set -euo pipefail
cd /opt/stack/AIStudio

echo "--- Backing up current .env.docker ---"
cp .env.docker .env.docker.bak.\$(date +%Y%m%d%H%M%S)

echo "--- Updating .env.docker ---"

# Replace POSTGRES_PASSWORD
sed -i 's|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD="${NEW_POSTGRES_PW}"|' .env.docker

# Replace DATABASE_URL with new password
sed -i 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://postgres:${NEW_POSTGRES_PW}@postgres:5432/vibestudio"|' .env.docker

# Replace JWT secrets
sed -i 's|^JWT_SECRET=.*|JWT_SECRET="${NEW_JWT_SECRET}"|' .env.docker
sed -i 's|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET="${NEW_JWT_REFRESH}"|' .env.docker

# Replace INTERNAL_API_SECRET
sed -i 's|^INTERNAL_API_SECRET=.*|INTERNAL_API_SECRET="${NEW_INTERNAL_SECRET}"|' .env.docker

echo "--- Updating PostgreSQL password ---"
# Change the postgres user password in the running database
docker compose exec -T postgres psql -U postgres -c "ALTER USER postgres PASSWORD '${NEW_POSTGRES_PW}';"

echo "--- Restarting services ---"
docker compose restart backend

echo "--- Verifying backend health ---"
sleep 5
if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Backend is healthy!"
else
    echo "WARNING: Backend health check failed. Check logs with: docker compose logs backend --tail 50"
fi

echo "--- Done on server ---"
ENDSSH

echo ""
echo "=== Production secrets rotated successfully ==="
echo ""
echo "New secrets are ONLY on the server (not in this repo)."
echo "Old secrets from git history are now invalid."
echo ""
echo "Save these locally if needed (e.g., in a password manager):"
echo "  POSTGRES_PASSWORD=${NEW_POSTGRES_PW}"
echo "  JWT_SECRET=${NEW_JWT_SECRET}"
echo "  JWT_REFRESH_SECRET=${NEW_JWT_REFRESH}"
echo "  INTERNAL_API_SECRET=${NEW_INTERNAL_SECRET}"
