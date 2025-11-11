# Caddy Configuration Update Summary

**Date:** 2025-11-11
**Status:** ✅ Complete

## Changes Made

### Updated Caddy Configuration (`/opt/caddy/Caddyfile`)

1. **Domain Updated**:
   - Old: `aistudio.example.com`
   - New: `vibestudio.example.com`

2. **Container References Updated**:
   - Old: `aistudio-frontend:5173`
   - New: `vibe-studio-frontend:5173`
   - Old: `aistudio-backend:3000`
   - New: `vibe-studio-backend:3000`

3. **Configuration Reloaded**: ✅ Successfully reloaded without errors

## Updated Caddy Block

```caddyfile
vibestudio.example.com {
      # Frontend - serve React app
      reverse_proxy vibe-studio-frontend:5173 {
          header_up Host {host}
          header_up X-Real-IP {remote}
          header_up X-Forwarded-For {remote}
          header_up X-Forwarded-Proto {scheme}
      }

      # API endpoints
      handle /api/* {
           reverse_proxy vibe-studio-backend:3000 {
              header_up Host {host}
              header_up X-Real-IP {remote}
              header_up X-Forwarded-For {remote}
              header_up X-Forwarded-Proto {scheme}
          }
      }

      # WebSocket support for real-time updates
      handle /socket.io/* {
          reverse_proxy vibe-studio-backend:3000 {
              header_up Upgrade {http.request.header.Upgrade}
              header_up Connection {http.request.header.Connection}
              header_up Host {host}
          }
      }

      # Enable compression
      encode gzip zstd

      # Security headers
      header {
          X-Content-Type-Options "nosniff"
          X-Frame-Options "SAMEORIGIN"
          X-XSS-Protection "1; mode=block"
          Referrer-Policy "strict-origin-when-cross-origin"
      }
  }
```

## DNS Configuration Required

To make the new domain accessible, you need to update your DNS records:

### Option 1: Update Existing Record
Update the DNS A record for your domain:
- **Change**: `aistudio.example.com` → `vibestudio.example.com`
- **Type**: A
- **Value**: Your server IP (same as current aistudio subdomain)
- **TTL**: 300 (or your preference)

### Option 2: Keep Both Domains (Temporary)
Add a new DNS A record alongside the existing one:
- **Add**: `vibestudio.example.com`
- **Type**: A
- **Value**: Your server IP
- **TTL**: 300

Then remove the old `aistudio.example.com` record after verifying the new domain works.

## SSL Certificate

Caddy will automatically provision a Let's Encrypt SSL certificate for `vibestudio.example.com` once:
1. The DNS record is set up and propagated
2. The domain resolves to your server
3. Port 80 and 443 are accessible

The certificate provisioning happens automatically - no manual intervention needed.

## Verification Steps

After DNS propagation (typically 5-15 minutes):

```bash
# 1. Check DNS resolution
dig vibestudio.example.com

# 2. Test HTTPS access
curl -I https://vibestudio.example.com

# 3. Check Caddy logs for certificate provisioning
docker logs caddy-caddy-1 --tail 50 | grep vibestudio

# 4. Verify frontend loads
curl https://vibestudio.example.com

# 5. Test API endpoint
curl https://vibestudio.example.com/api/health
```

## Current Status

- ✅ Caddy configuration updated
- ✅ Configuration validated (no errors)
- ✅ Caddy reloaded successfully
- ✅ Container names updated to `vibe-studio-*`
- ⏳ DNS update required (manual step)
- ⏳ SSL certificate (auto-provisions after DNS)

## Rollback Instructions

If you need to revert to the old configuration:

```bash
# 1. Restore old configuration
sudo sed -i 's/vibestudio\.pawelgawliczek\.cloud/aistudio.example.com/g' /opt/caddy/Caddyfile
sudo sed -i 's/vibe-studio-frontend/aistudio-frontend/g' /opt/caddy/Caddyfile
sudo sed -i 's/vibe-studio-backend/aistudio-backend/g' /opt/caddy/Caddyfile

# 2. Reload Caddy
docker exec caddy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## Notes

- The container names in Caddy now match the renamed Docker containers
- All routing (frontend, API, WebSocket) has been updated
- The old `aistudio.example.com` domain will stop working once DNS is updated
- Consider keeping both domains temporarily for a smooth transition
