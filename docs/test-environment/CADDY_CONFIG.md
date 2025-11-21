# Caddy Configuration for Test Environment (ST-74)

Add the following block to `/opt/caddy/Caddyfile`:

```caddyfile
# Test Environment - https://test.vibestudio.pawelgawliczek.cloud
test.vibestudio.pawelgawliczek.cloud {
    # API endpoints - route to test backend
    handle /api/* {
        reverse_proxy vibe-studio-test-backend:3000 {
            header_up Host {host}
            header_up X-Real-IP {remote}
            header_up X-Forwarded-For {remote}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # WebSocket support for real-time updates
    handle /socket.io/* {
        reverse_proxy vibe-studio-test-backend:3000 {
            header_up Upgrade {http.request.header.Upgrade}
            header_up Connection {http.request.header.Connection}
            header_up Host {host}
        }
    }

    # Frontend - serve React app (default fallback)
    reverse_proxy vibe-studio-test-frontend:80 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
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

## After Adding the Configuration

1. Reload Caddy:
   ```bash
   docker exec caddy caddy reload --config /etc/caddy/Caddyfile
   ```

2. Verify SSL certificate provisioning (may take a few seconds for Let's Encrypt)

3. Test the endpoints:
   - Frontend: https://test.vibestudio.pawelgawliczek.cloud/
   - API Health: https://test.vibestudio.pawelgawliczek.cloud/api/health

## Prerequisites

- DNS A record for `test.vibestudio.pawelgawliczek.cloud` must point to the server
- Test containers must be on `stack_appnet` network (already configured in docker-compose.test.yml)
