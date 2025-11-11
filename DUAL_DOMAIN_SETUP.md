# Dual Domain Setup - AI Studio & Vibe Studio

**Date:** 2025-11-11
**Status:** ✅ Complete and Working

## Overview

Both `aistudio.example.com` and `vibestudio.example.com` now point to the same Vibe Studio application (using the new `vibe-studio-*` containers).

## Working Domains

### 1. AI Studio (Legacy Domain)
- **URL**: https://aistudio.example.com
- **Frontend**: ✅ Working
- **API**: ✅ Working (https://aistudio.example.com/api/health)
- **WebSocket**: ✅ Configured
- **SSL**: ✅ Active (Let's Encrypt)

### 2. Vibe Studio (New Domain)
- **URL**: https://vibestudio.example.com
- **Frontend**: ⏳ Needs DNS configuration (points to same containers as aistudio)
- **API**: ⏳ Ready (will work after DNS)
- **WebSocket**: ✅ Configured
- **SSL**: ⏳ Will auto-provision after DNS setup

## Technical Details

### Both Domains Point To:
- **Frontend Container**: `vibe-studio-frontend:5173`
- **Backend Container**: `vibe-studio-backend:3000`
- **Database**: `vibestudio` (renamed from `aistudio`)
- **Networks**: `aistudio-network` + `stack_appnet`

### Caddy Configuration

Both domains have identical routing rules:

```caddyfile
# Legacy domain
aistudio.example.com {
      reverse_proxy vibe-studio-frontend:5173 { ... }
      handle /api/* { reverse_proxy vibe-studio-backend:3000 { ... } }
      handle /socket.io/* { reverse_proxy vibe-studio-backend:3000 { ... } }
}

# New domain
vibestudio.example.com {
      reverse_proxy vibe-studio-frontend:5173 { ... }
      handle /api/* { reverse_proxy vibe-studio-backend:3000 { ... } }
      handle /socket.io/* { reverse_proxy vibe-studio-backend:3000 { ... } }
}
```

## Current Status

### Working Now:
✅ `aistudio.example.com` - Fully operational
✅ Both domains configured in Caddy
✅ All containers running with new names
✅ Database migrated to `vibestudio`
✅ No impact on other projects/domains

### Requires DNS Update:
⏳ `vibestudio.example.com` - Needs A record pointing to `72.61.176.212`

## DNS Configuration Required

To activate `vibestudio.example.com`:

1. **Go to**: https://hpanel.hostinger.com
2. **Navigate**: Domains → example.com → DNS
3. **Add Record**:
   - Type: A
   - Name: vibestudio
   - Points to: 72.61.176.212
   - TTL: 300

After DNS propagates (5-15 min), Caddy will automatically provision SSL.

## Benefits of Dual Domain Setup

### ✅ Zero Downtime
- Old domain keeps working during transition
- Users can access via either URL
- No service interruption

### ✅ Gradual Migration
- Update links/bookmarks gradually
- Test new domain before full cutover
- Roll back if needed

### ✅ SEO Friendly
- Can set up 301 redirects later
- No loss of search rankings
- Smooth transition for users

## Future Options

### Option 1: Keep Both Domains (Recommended for Now)
- Users can use either URL
- No breaking changes
- Maximum flexibility

### Option 2: Redirect aistudio → vibestudio
Add to Caddyfile:
```caddyfile
aistudio.example.com {
    redir https://vibestudio.example.com{uri} permanent
}
```

### Option 3: Remove Old Domain
After users migrate:
1. Remove aistudio block from Caddyfile
2. Remove aistudio DNS A record
3. Keep only vibestudio domain

## Verification

Test both domains:

```bash
# Test aistudio domain (working now)
curl https://aistudio.example.com/api/health

# Test vibestudio domain (after DNS setup)
curl https://vibestudio.example.com/api/health

# Both should return:
# {"status":"ok","timestamp":"...","service":"aistudio-backend"}
```

## Impact on Other Projects

✅ **NO IMPACT** - All other projects continue working:
- n8n.example.com
- mcp.example.com
- llm.example.com
- openwebui.example.com
- livetranslator.example.com
- analytics.example.com
- portainer.example.com
- etc.

Each subdomain has its own independent configuration.

## Troubleshooting

### If aistudio domain returns 502:
```bash
# Restart Caddy to clear DNS cache
docker restart caddy-caddy-1

# Wait 5 seconds
sleep 5

# Test again
curl -I https://aistudio.example.com
```

### If vibestudio domain not working:
1. Check DNS: `dig vibestudio.example.com +short` (should return 72.61.176.212)
2. Wait for DNS propagation (5-15 minutes)
3. Check Caddy logs: `docker logs caddy-caddy-1 --tail 50 | grep vibestudio`

## Next Steps

1. ✅ aistudio domain is working now - users can continue using it
2. ⏳ Add DNS record for vibestudio.example.com
3. ⏳ Wait for DNS propagation + SSL provisioning
4. ✅ Notify users both domains are available
5. ⏳ Eventually migrate users to vibestudio (when ready)

---

**Current State**: Both domains configured, `aistudio` working, `vibestudio` waiting for DNS.
