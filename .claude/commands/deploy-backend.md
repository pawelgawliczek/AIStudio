# Deploy Backend to Production

SSH to Hostinger and deploy the latest backend changes.

## Usage
/deploy-backend

## Instructions

Execute the following commands via SSH to Hostinger:

1. Connect to Hostinger:
```bash
ssh hostinger
```

2. Navigate to project and pull changes:
```bash
cd /opt/stack/AIStudio && git pull origin main
```

3. Build and restart backend service:
```bash
docker compose build --no-cache backend && docker compose up -d backend
```

4. Verify health:
```bash
curl -s http://localhost:3000/api/health
```

Report the deployment status to the user.
