# AIStudio Observability Stack

Distributed tracing and log aggregation infrastructure for AIStudio.

## Components

- **Grafana Tempo** - Distributed tracing backend (OTLP receiver)
- **Grafana Loki** - Log aggregation system
- **Promtail** - Log collection agent
- **Grafana** - Visualization and dashboards

## Quick Start

### 1. Deploy to Hostinger

```bash
# SSH to production server
ssh hostinger

# Navigate to AIStudio directory
cd /opt/stack/AIStudio

# Start observability stack
docker compose -f observability/docker-compose.yml up -d

# Check status
docker compose -f observability/docker-compose.yml ps
```

### 2. Configure Backend

Add to `/opt/stack/AIStudio/.env`:

```env
# Observability Configuration (ST-257)
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318/v1/traces
OTEL_SERVICE_NAME=aistudio-backend
```

### 3. Restart Backend

```bash
# Restart backend to enable telemetry
docker compose restart backend
```

### 4. Access Grafana

Forward Grafana port via SSH tunnel:

```bash
# From laptop
ssh -L 3030:localhost:3030 hostinger
```

Then open: http://localhost:3030

Default credentials:
- Username: `admin`
- Password: `admin` (or set via `GRAFANA_ADMIN_PASSWORD` env var)

## Architecture

### Data Flow

```
Backend (OpenTelemetry SDK)
  |
  | OTLP/HTTP (port 4318)
  v
Tempo (trace storage)
  ^
  | TraceQL queries
  |
Grafana (UI)
  ^
  | LogQL queries
  |
Loki (log storage)
  ^
  | JSON logs
  |
Promtail (log collector)
  ^
  | Docker container logs
  |
Docker Engine
```

### Ports (Localhost Only)

| Service | Port | Purpose |
|---------|------|---------|
| Tempo | 3200 | Query frontend |
| Tempo | 4317 | OTLP gRPC receiver |
| Tempo | 4318 | OTLP HTTP receiver |
| Loki | 3100 | HTTP API |
| Promtail | 9080 | HTTP API |
| Grafana | 3030 | Web UI |

**Security**: All ports bound to `127.0.0.1` (localhost only)

## Retention

- **Traces**: 7 days (168 hours)
- **Logs**: 7 days (168 hours)

## Usage

### Query Traces in Grafana

1. Open Grafana: http://localhost:3030
2. Navigate to Explore
3. Select "Tempo" data source
4. Use TraceQL queries:

```traceql
// Find all HTTP requests to a specific endpoint
{ name="HTTP GET /api/stories" }

// Find traces with errors
{ status=error }

// Find traces for a specific story
{ story.id="851565f4-48c9-4501-b0ea-f6129458ab48" }

// Find traces for a workflow run
{ workflow.run.id="run-uuid" }

// Find slow requests (>1 second)
{ duration > 1s }
```

### Query Logs in Grafana

1. Open Grafana: http://localhost:3030
2. Navigate to Explore
3. Select "Loki" data source
4. Use LogQL queries:

```logql
// All logs from backend container
{container="vibe-studio-backend"}

// Logs with specific trace ID
{container="vibe-studio-backend"} |= "trace_id=abc123"

// Error logs
{container="vibe-studio-backend"} | json | level="error"

// Logs for specific story
{container="vibe-studio-backend"} | json | story_id="851565f4-48c9-4501-b0ea-f6129458ab48"
```

### Correlate Traces and Logs

Grafana automatically correlates traces and logs via `trace_id`:

1. Open a trace in Tempo
2. Click "Logs for this span" button
3. Grafana will query Loki for matching logs

## Backend Instrumentation

### Automatic Instrumentation

The following are automatically traced:
- HTTP requests (via TracingInterceptor)
- Express middleware
- NestJS controllers

### Manual Instrumentation

Use `@Traced` decorator for method-level tracing:

```typescript
import { Injectable } from '@nestjs/common';
import { TelemetryService, Traced } from '../telemetry';

@Injectable()
export class MyService {
  constructor(private telemetry: TelemetryService) {}

  @Traced('my_service.process_data')
  async processData(data: any) {
    // Method is automatically traced
    return result;
  }
}
```

Use `TelemetryService` for custom spans:

```typescript
async myMethod() {
  await this.telemetry.withSpan('custom.operation', async (span) => {
    span.setAttribute('custom.attribute', 'value');
    // Your code here
  });
}
```

### MCP Tool Tracing

Use `@TracedMCP` decorator for MCP tools:

```typescript
@TracedMCP('get_story', 'stories')
async handleGetStory(params: GetStoryParams) {
  // Automatically traced with tool.name and tool.category attributes
}
```

### Story Context

Add story/workflow context to all spans:

```typescript
await this.telemetry.withStoryContext(storyId, runId, async () => {
  // All spans in this context will have story.id and workflow.run.id attributes
});
```

## Data Sanitization

The telemetry service automatically redacts sensitive fields:
- `password`
- `token`
- `secret`
- `apiKey`
- `authorization`
- `auth`
- `bearer`
- `jwt`
- `privateKey`
- `credentials`
- `cookie`
- `session`

Values are replaced with `[REDACTED]`.

## Troubleshooting

### No traces in Tempo

1. Check backend logs:
   ```bash
   docker compose logs backend | grep Telemetry
   ```

2. Verify OTEL_ENABLED=true in .env

3. Check Tempo is receiving traces:
   ```bash
   docker compose -f observability/docker-compose.yml logs tempo
   ```

4. Test OTLP endpoint:
   ```bash
   curl http://localhost:4318/v1/traces
   ```

### No logs in Loki

1. Check Promtail is running:
   ```bash
   docker compose -f observability/docker-compose.yml ps promtail
   ```

2. Check Promtail logs:
   ```bash
   docker compose -f observability/docker-compose.yml logs promtail
   ```

3. Verify Docker socket is mounted:
   ```bash
   docker compose -f observability/docker-compose.yml exec promtail ls -l /var/run/docker.sock
   ```

### Grafana can't reach Tempo/Loki

1. Check all services are in same network:
   ```bash
   docker network inspect observability_observability
   ```

2. Verify DNS resolution:
   ```bash
   docker compose -f observability/docker-compose.yml exec grafana ping tempo
   docker compose -f observability/docker-compose.yml exec grafana ping loki
   ```

## Maintenance

### Clear Old Data

```bash
# Stop services
docker compose -f observability/docker-compose.yml down

# Remove volumes (WARNING: deletes all traces and logs)
docker volume rm observability_tempo_data observability_loki_data observability_grafana_data

# Restart services
docker compose -f observability/docker-compose.yml up -d
```

### View Disk Usage

```bash
docker system df -v | grep observability
```

### Backup Grafana Dashboards

```bash
# Export dashboards from Grafana UI
# Settings > Dashboards > Export > Save as JSON
```

## Phase 1 & 2 Implementation Status

✅ **Phase 1: Shared Observability Infrastructure**
- Docker Compose configuration
- Tempo configuration (7-day retention)
- Loki configuration (7-day retention)
- Promtail configuration (Docker log collection)
- Grafana provisioning (auto-configured data sources)

✅ **Phase 2: Backend Telemetry Module**
- TelemetryModule (Global NestJS module)
- TelemetryService (OpenTelemetry SDK wrapper)
  - `startSpan()`, `getCurrentTraceId()`, `withSpan()`, `withStoryContext()`
  - `sanitizeParams()` for sensitive data redaction
- TracingInterceptor (HTTP request tracing)
- @Traced decorator (method-level tracing)
- @TracedMCP decorator (MCP tool tracing)
- OpenTelemetry initialization in main.ts

**Next Steps (Future Stories):**
- Phase 3: MCP tool instrumentation
- Phase 4: WebSocket message tracing
- Phase 5: Grafana dashboards
