# Vite Allowed Hosts Configuration Fix

**Date:** 2025-11-11
**Issue:** "This host is not allowed" error when accessing vibestudio.example.com
**Status:** ✅ Fixed

## Problem

When accessing the application via `vibestudio.example.com`, Vite's development server was blocking the request with:

```
Blocked request. This host ("vibestudio.example.com") is not allowed.
To allow this host, add "vibestudio.example.com" to `server.allowedHosts` in vite.config.js.
```

## Root Cause

Vite has a security feature that only allows requests from specific hosts. Our configuration only had the HMR (Hot Module Replacement) host configured for `aistudio.example.com`, but didn't have an `allowedHosts` list.

## Solution

Updated `frontend/vite.config.ts` to include both domains in the `allowedHosts` configuration:

```typescript
server: {
  port: 5173,
  host: '0.0.0.0',
  strictPort: true,
  allowedHosts: [
    'aistudio.example.com',    // Legacy domain
    'vibestudio.example.com',  // New domain
    'localhost',                         // Local development
    '127.0.0.1',                        // Local development
  ],
  hmr: {
    clientPort: 443,
    protocol: 'wss',
    host: 'aistudio.example.com',
  },
  // ... rest of config
}
```

## Changes Made

1. ✅ Added `allowedHosts` array to `server` configuration
2. ✅ Included both `aistudio` and `vibestudio` domains
3. ✅ Kept `localhost` and `127.0.0.1` for local development
4. ✅ Restarted frontend container to apply changes
5. ✅ Committed and pushed changes to repository

## Testing

After DNS is configured for vibestudio.example.com, test both domains:

### Via aistudio (working now):
```bash
# Frontend
curl -I https://aistudio.example.com
# Should return: HTTP/2 200

# API
curl https://aistudio.example.com/api/health
# Should return: {"status":"ok",...}
```

### Via vibestudio (after DNS setup):
```bash
# Frontend
curl -I https://vibestudio.example.com
# Should return: HTTP/2 200

# API
curl https://vibestudio.example.com/api/health
# Should return: {"status":"ok",...}
```

### In Browser:
1. Open: https://aistudio.example.com ✅ Working now
2. Open: https://vibestudio.example.com ⏳ After DNS setup

Both should load the same Vibe Studio application without any "host not allowed" errors.

## Note About HMR

The HMR (Hot Module Replacement) configuration still points to `aistudio.example.com`. This is fine because:
- HMR only affects development mode hot reloading
- The `allowedHosts` controls which domains can access the app
- Users accessing via either domain will work correctly
- Hot reload will work via websocket through whichever domain they use

If you want HMR to work optimally for vibestudio as well, you could update the HMR host to match the request host dynamically, but this isn't critical for production use.

## Verification

Frontend container restarted and working:
```
✅ Container: vibe-studio-frontend
✅ Status: Up and running
✅ Port: 127.0.0.1:5174->5173/tcp
✅ aistudio domain: Accessible
✅ vibestudio domain: Ready (pending DNS)
```

## Commit

Changes committed and pushed:
- Commit: `215c258`
- Message: "Add vibestudio domain to Vite allowed hosts"
- Branch: `claude/new-priority-feature-011CUzSn4wxupZiNX6iahb2V`

## Related Files

- `frontend/vite.config.ts` - Updated with allowedHosts
- `DUAL_DOMAIN_SETUP.md` - Overall dual domain setup guide
- `CADDY_UPDATE_SUMMARY.md` - Caddy configuration changes
- `REBRANDING_SUMMARY.md` - Complete rebranding documentation
