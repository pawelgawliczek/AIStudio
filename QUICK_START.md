# AI Studio - Quick Start Deployment

**⚡ Fast deployment for experienced users**

---

## Prerequisites

- Linux host with Docker, Docker Compose, Node.js 18+
- SSH access to remote host
- OpenAI API key

---

## Steps

### 1. On Remote Host

```bash
# Clone repository
cd ~/projects
git clone https://github.com/pawelgawliczek/AIStudio.git
cd AIStudio
git checkout claude/new-priority-feature-011CUzSn4wxupZiNX6iahb2V
```

### 2. Configure Environment

```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy output

# Create and edit .env
cp .env.example .env
nano .env

# Set these values:
# - DATABASE_URL (use postgres:5432, not localhost)
# - JWT_SECRET (paste generated secret)
# - JWT_REFRESH_SECRET (generate and paste another)
# - OPENAI_API_KEY (your key)
# - VITE_API_URL (http://your-domain.com/api or http://your-ip/api)

# Create backend/.env
cp backend/.env.example backend/.env
nano backend/.env
# Same values as above
```

### 3. Deploy

```bash
# Run deployment script
./scripts/deploy.sh

# Or manually:
npm install
npm run build:backend
docker-compose -f docker-compose.prod.yml up -d --build
```

### 4. Verify

```bash
# Check services
docker-compose -f docker-compose.prod.yml ps

# Test API
curl http://localhost:3000/health

# Test frontend (from your machine)
curl http://YOUR_HOST_IP/
```

### 5. Configure Claude Code MCP

```bash
# Find Claude Code config
find ~ -name "config.json" -path "*claude*"

# Edit config
nano ~/.config/claude-code/config.json

# Add:
{
  "mcpServers": {
    "aistudio": {
      "command": "node",
      "args": ["backend/dist/mcp/server.js"],
      "cwd": "/home/YOUR_USER/projects/AIStudio",
      "env": {
        "DATABASE_URL": "postgresql://postgres:YOUR_PASSWORD@localhost:5432/aistudio?schema=public",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 6. Test MCP

```bash
# Start Claude Code and test
# "Use the list_projects tool"
```

---

## Troubleshooting

### Services won't start
```bash
docker-compose -f docker-compose.prod.yml logs
```

### Database connection errors
```bash
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d aistudio -c "SELECT version();"
```

### MCP not connecting
```bash
# Rebuild backend
npm run build:backend

# Test MCP manually
node backend/dist/mcp/server.js
```

### Frontend not loading
```bash
docker-compose -f docker-compose.prod.yml logs frontend
docker-compose -f docker-compose.prod.yml logs caddy
```

---

## Useful Commands

```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop services
docker-compose -f docker-compose.prod.yml down

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Database backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres aistudio > backup_$(date +%Y%m%d).sql

# Access database
docker-compose -f docker-compose.prod.yml exec postgres psql -U postgres -d aistudio
```

---

## Next Steps

- ✅ Test all MCP tools
- ✅ Create your first project
- ✅ Start development using Claude Code
- ⏭️ Continue with Sprint 10 (Advanced Features)

---

For detailed instructions, see: **DEPLOYMENT_GUIDE.md**
