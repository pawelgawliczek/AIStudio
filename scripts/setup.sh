#!/bin/bash

# AI Studio Setup Script
# This script sets up the development environment for AI Studio

set -e

echo "🚀 Setting up AI Studio..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed."; exit 1; }

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment files if they don't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration"
fi

if [ ! -f backend/.env ]; then
    echo "📝 Creating backend/.env file..."
    cp backend/.env.example backend/.env
fi

# Start Docker services
echo "🐳 Starting Docker services..."
docker compose up -d postgres redis

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
done
echo "✅ PostgreSQL is ready"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
cd backend && npx prisma generate && cd ..

# Run migrations
echo "🗄️  Running database migrations..."
npm run db:migrate:dev

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "  1. Edit .env files with your configuration (if needed)"
echo "  2. Run 'npm run dev' to start the development server"
echo "  3. Visit http://localhost:5173 for the frontend"
echo "  4. Visit http://localhost:3000/api/docs for API documentation"
echo ""
echo "🎉 Happy coding!"
