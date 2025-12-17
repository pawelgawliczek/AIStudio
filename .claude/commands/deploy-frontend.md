# Deploy Frontend to Production

SSH to Hostinger and deploy the latest frontend changes.

## Usage
/deploy-frontend

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

3. Build and restart frontend service:
```bash
docker compose build --no-cache frontend && docker compose up -d frontend
```

4. Verify health:
```bash
curl -s http://localhost:5173
```

Report the deployment status to the user.
