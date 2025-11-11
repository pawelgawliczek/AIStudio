# DNS Update Guide for Vibe Studio

**Date:** 2025-11-11
**Domain:** example.com
**Registrar:** Hostinger
**Server IP:** 72.61.176.212

## Quick Manual Update (2 minutes)

### Step 1: Access Hostinger DNS Management
1. Go to: https://hpanel.hostinger.com
2. Login with your credentials
3. Navigate to: **Domains** → **example.com** → **DNS / Name Servers**

### Step 2: Add New DNS Record
Click "Add Record" and enter:
- **Type**: A
- **Name**: vibestudio
- **Points to**: 72.61.176.212
- **TTL**: 300 (5 minutes for fast propagation)

### Step 3: Save and Wait
- Click "Save" or "Add Record"
- DNS propagation: 5-15 minutes (with TTL 300)

## Verification

After adding the record, verify DNS propagation:

```bash
# Check if DNS is resolving
dig vibestudio.example.com +short

# Should return: 72.61.176.212
```

You can also use online tools:
- https://www.whatsmydns.net/#A/vibestudio.example.com
- https://dnschecker.org/#A/vibestudio.example.com

## After DNS Propagates

Once DNS resolves correctly:

1. **Caddy will auto-provision SSL certificate** (automatic, no action needed)
2. **Test the new domain**:
   ```bash
   curl -I https://vibestudio.example.com
   ```

3. **Access your application**:
   - Frontend: https://vibestudio.example.com
   - API: https://vibestudio.example.com/api
   - Health: https://vibestudio.example.com/api/health

## Optional: Remove Old Domain

After verifying the new domain works, you can:

1. Keep both domains pointing to the same IP (no harm)
2. Or remove the old `aistudio.example.com` A record

## Alternative: Using Hostinger API

If you have a Hostinger API token, DNS can be updated programmatically:

### Get API Token:
1. Log into Hostinger
2. Go to: Account → API
3. Create API token with DNS permissions

### Update DNS via API:
```bash
# Set your API token
export HOSTINGER_API_TOKEN="your-token-here"

# Add DNS record (example)
curl -X POST "https://api.hostinger.com/dns/v1/domains/example.com/records" \
  -H "Authorization: Bearer $HOSTINGER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "A",
    "name": "vibestudio",
    "content": "72.61.176.212",
    "ttl": 300
  }'
```

## Current DNS Configuration

Current working subdomains on example.com:
- ✅ aistudio → 72.61.176.212
- ⏳ vibestudio → (needs to be added)

Server IP: **72.61.176.212**

## Troubleshooting

### DNS not resolving after 15 minutes?
- Clear your local DNS cache:
  ```bash
  # Linux
  sudo systemd-resolve --flush-caches

  # macOS
  sudo dscacheutil -flushcache
  ```

### SSL certificate not provisioning?
- Check Caddy logs:
  ```bash
  docker logs caddy-caddy-1 --tail 50 | grep vibestudio
  ```

- Verify ports 80 and 443 are open:
  ```bash
  sudo ufw status
  ```

### Still not working?
- Verify DNS: `dig vibestudio.example.com`
- Check Caddy config: `docker exec caddy-caddy-1 caddy validate --config /etc/caddy/Caddyfile`
- Test locally: `curl -H "Host: vibestudio.example.com" http://localhost`
