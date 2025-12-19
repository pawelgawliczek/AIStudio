# AIStudio Observability Stack

Distributed tracing and log aggregation infrastructure for AIStudio.

**Version:** 2.0 (Upgraded 2025-12-18 - ST-288)

## Components

- **Grafana** (v12.3.0) - Visualization and dashboards
- **Grafana Tempo** (v2.9.0) - Distributed tracing backend with improved search
- **Grafana Loki** (v3.3.0) - Log aggregation with TSDB schema
- **Alloy** (v1.5.0) - Unified telemetry collector (replaces Promtail v2.9.3)

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
Tempo v2.9.0 (trace storage + search)
  ^
  | TraceQL queries
  |
Grafana v12.3.0 (UI)
  ^
  | LogQL queries
  |
Loki v3.3.0 (log storage + TSDB schema)
  ^
  | JSON logs
  |
Alloy v1.5.0 (unified telemetry collector)
  ^  ^  ^
  |  |  | - Logs
  |  |  - Metrics (Prometheus-compatible)
  |  - Traces (OTLP)
  |
Docker Engine (container logs + metrics)
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

## Alloy Migration (v1.5.0)

**Alloy replaces Promtail as the unified telemetry collector** (ST-288, Upgraded 2025-12-18)

### Why Alloy?

- **Unified telemetry**: Single agent collects logs, metrics, and traces (replaces separate agents)
- **Flexible pipelines**: Powerful component-based configuration
- **Better integration**: Native support for all Grafana products
- **Resource efficient**: Reduced overhead compared to multiple collectors

### Configuration

Alloy configuration is located at `observability/alloy/alloy.yaml`

Key pipeline components:
- **Docker logs receiver**: Collects container logs via Docker Engine API
- **Loki exporter**: Sends logs to Loki with labels and trace IDs
- **OTLP receiver**: Ingests traces from application (port 4317/gRPC, 4318/HTTP)
- **Tempo exporter**: Forwards traces to Tempo

### Monitoring Alloy Health

```bash
# Check Alloy is running
docker compose -f observability/docker-compose.yml ps alloy

# View Alloy logs
docker compose -f observability/docker-compose.yml logs alloy

# Query Alloy metrics endpoint (for advanced monitoring)
curl http://localhost:9090/metrics
```

### Migration from Promtail

**Promtail v2.9.3 is no longer used.** If upgrading from older deployments:

1. Remove Promtail container: `docker compose down promtail`
2. Verify Alloy is configured in docker-compose.yml
3. Verify logs appear in Loki after Alloy starts
4. Update any external references (scripts, monitoring) to use Alloy instead

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

1. Check Alloy is running:
   ```bash
   docker compose -f observability/docker-compose.yml ps alloy
   ```

2. Check Alloy logs:
   ```bash
   docker compose -f observability/docker-compose.yml logs alloy
   ```

3. Verify Docker socket is mounted:
   ```bash
   docker compose -f observability/docker-compose.yml exec alloy ls -l /var/run/docker.sock
   ```

4. Verify Alloy can reach Loki:
   ```bash
   docker compose -f observability/docker-compose.yml exec alloy curl http://loki:3100/ready
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

## Implementation Status

✅ **Phase 1: Shared Observability Infrastructure (ST-257)**
- Docker Compose configuration
- Tempo configuration (7-day retention, v2.9.0)
- Loki configuration (7-day retention, v3.3.0 with TSDB schema)
- Alloy configuration (Docker log collection, v1.5.0 - replaces Promtail v2.9.3)
- Grafana provisioning (auto-configured data sources, v12.3.0)

✅ **Phase 2: Backend Telemetry Module (ST-257)**
- TelemetryModule (Global NestJS module)
- TelemetryService (OpenTelemetry SDK wrapper)
  - `startSpan()`, `getCurrentTraceId()`, `withSpan()`, `withStoryContext()`
  - `sanitizeParams()` for sensitive data redaction
- TracingInterceptor (HTTP request tracing)
- @Traced decorator (method-level tracing)
- @TracedMCP decorator (MCP tool tracing)
- OpenTelemetry initialization in main.ts

✅ **Phase 3: Logger & MCP Instrumentation (ST-258)**
- TraceId/SpanId injection in WinstonLoggerService
- Log correlation with traces via `trace_id` field

✅ **Phase 4: WebSocket & Agent Tracing (ST-258)**
- RemoteAgentGateway instrumentation:
  - `remote_agent.connect` - Agent connection events
  - `remote_agent.disconnect` - Agent disconnection with affected jobs/workflows
  - `remote_agent.heartbeat` - Agent heartbeat monitoring
- WebSocket broadcast instrumentation:
  - `websocket.broadcast.workflow_started` - Workflow initiation
  - `websocket.broadcast.workflow_status` - Workflow status changes
  - `websocket.broadcast.component_started` - Component execution start
  - `websocket.broadcast.component_completed` - Component execution end

✅ **Phase 5: Grafana Dashboards (ST-258)**
- **HTTP & API Overview** - Request duration, status codes, error rates
- **WebSocket & Agent Monitoring** - Agent connections, heartbeats, broadcast events
- **Workflow Execution Tracing** - End-to-end workflow spans with story/run filtering

## Dashboards

Access Grafana at http://localhost:3030 (after SSH tunnel: `ssh -L 3030:localhost:3030 hostinger`)

### 1. HTTP & API Overview (`01-http-api-overview.json`)
- HTTP request duration timeseries
- Total request count
- Recent requests table (method, route, status, duration)
- Status code distribution (pie chart)
- Error count

### 2. WebSocket & Agent Monitoring (`02-websocket-agent-monitoring.json`)
- Remote agent connections counter
- Agent heartbeats counter
- Agent disconnections counter
- Agent activity timeline
- Recent WebSocket broadcasts table
- Event type distribution (pie chart)

### 3. Workflow Execution Tracing (`03-workflow-execution-tracing.json`)
- Workflow execution spans table (filter by `workflow.run.id`)
- Workflow broadcast duration timeseries
- Component broadcast duration timeseries
- Story-level tracing table (filter by `story.id`)
- Workflow errors counter
- Total workflow runs counter
- Total component executions counter

**Variables:**
- `$workflow_run_id` - Filter by specific workflow run
- `$story_id` - Filter by specific story

### 4. MCP Tool Performance (`04-mcp-tool-performance.json`)
- MCP tool execution duration timeseries
- Tool success/error rates
- Tool usage distribution
- Performance by tool category

### 5. Error Investigation (`05-error-investigation.json`)
- Error rate trends
- Error logs by category
- Stack traces and error details
- Error correlation with traces

### 6. Database Connections (`06-database-connections.json`)
- Active database connection count
- Connection pool utilization
- Query performance metrics
- Long-running queries

### 7. Remote Execution Monitoring (`07-remote-execution-monitoring.json`)
- Remote agent job execution status
- Job queue depth and throughput
- Agent resource utilization
- Execution success/failure rates

### 8. Upload Pipeline Monitoring (`08-upload-pipeline-monitoring.json`)
- Queue status: pending, sent (awaiting ACK), and ACKed item counts
- Upload success rate (5-minute window)
- Stuck items (not ACKed in 30s)
- Agent connection status
- Queue depth trends over time
- Upload distribution by type (artifact vs transcript)
- Error rate and ACK latency heatmap
- Transcript line flow and recent errors
