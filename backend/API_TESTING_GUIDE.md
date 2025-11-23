# ST-64 API Testing Guide

This guide provides example API requests for testing all versioning and analytics endpoints.

## Prerequisites

1. Backend server running: `npm run start:dev`
2. Database populated with test data
3. API available at: `http://localhost:3000`

## Base URL

```
http://localhost:3000
```

## 1. Versioning Endpoints

### 1.1 Component Versioning

#### Get Component Version History
```bash
curl -X GET "http://localhost:3000/versioning/components/{componentId}/versions"
```

#### Get Specific Component Version
```bash
curl -X GET "http://localhost:3000/versioning/components/versions/{versionId}"
```

#### Create Component Version (Minor)
```bash
curl -X POST "http://localhost:3000/versioning/components/{componentId}/versions" \
  -H "Content-Type: application/json" \
  -d '{
    "changeDescription": "Fixed bug in operation instructions"
  }'
```

#### Create Component Version (Major)
```bash
curl -X POST "http://localhost:3000/versioning/components/{componentId}/versions" \
  -H "Content-Type: application/json" \
  -d '{
    "majorVersion": 2,
    "changeDescription": "Breaking change: New model configuration"
  }'
```

#### Activate Component Version
```bash
curl -X POST "http://localhost:3000/versioning/components/versions/{versionId}/activate"
```

#### Deactivate Component Version
```bash
curl -X POST "http://localhost:3000/versioning/components/versions/{versionId}/deactivate"
```

#### Compare Component Versions
```bash
curl -X GET "http://localhost:3000/versioning/components/versions/compare?versionId1={v1}&versionId2={v2}"
```

#### Verify Component Checksum
```bash
curl -X POST "http://localhost:3000/versioning/components/versions/{versionId}/verify-checksum"
```

### 1.2 Coordinator Versioning

Same pattern as components, replace `/components/` with `/coordinators/`:

```bash
# Get version history
curl -X GET "http://localhost:3000/versioning/coordinators/{coordinatorId}/versions"

# Get specific version
curl -X GET "http://localhost:3000/versioning/coordinators/versions/{versionId}"

# Create version
curl -X POST "http://localhost:3000/versioning/coordinators/{coordinatorId}/versions" \
  -H "Content-Type: application/json" \
  -d '{"changeDescription": "Updated coordinator logic"}'

# Activate version
curl -X POST "http://localhost:3000/versioning/coordinators/versions/{versionId}/activate"

# Deactivate version
curl -X POST "http://localhost:3000/versioning/coordinators/versions/{versionId}/deactivate"

# Compare versions
curl -X GET "http://localhost:3000/versioning/coordinators/versions/compare?versionId1={v1}&versionId2={v2}"

# Verify checksum
curl -X POST "http://localhost:3000/versioning/coordinators/versions/{versionId}/verify-checksum"
```

### 1.3 Workflow Versioning

Same pattern as components, replace `/components/` with `/workflows/`:

```bash
# Get version history
curl -X GET "http://localhost:3000/versioning/workflows/{workflowId}/versions"

# Get specific version
curl -X GET "http://localhost:3000/versioning/workflows/versions/{versionId}"

# Create version
curl -X POST "http://localhost:3000/versioning/workflows/{workflowId}/versions" \
  -H "Content-Type: application/json" \
  -d '{"changeDescription": "Updated trigger configuration"}'

# Activate version
curl -X POST "http://localhost:3000/versioning/workflows/versions/{versionId}/activate"

# Deactivate version
curl -X POST "http://localhost:3000/versioning/workflows/versions/{versionId}/deactivate"

# Compare versions
curl -X GET "http://localhost:3000/versioning/workflows/versions/compare?versionId1={v1}&versionId2={v2}"

# Verify checksum
curl -X POST "http://localhost:3000/versioning/workflows/versions/{versionId}/verify-checksum"
```

## 2. Analytics Endpoints

### 2.1 Component Analytics

#### Get Component Analytics
```bash
# Basic analytics (last 30 days)
curl -X GET "http://localhost:3000/analytics/components/{componentId}"

# Analytics with time range
curl -X GET "http://localhost:3000/analytics/components/{componentId}?timeRange=7d"

# Analytics for specific version
curl -X GET "http://localhost:3000/analytics/components/{componentId}?versionId={versionId}&timeRange=90d"
```

#### Get Component Execution History
```bash
# Default (last 100 executions)
curl -X GET "http://localhost:3000/analytics/components/{componentId}/executions"

# With pagination and filters
curl -X GET "http://localhost:3000/analytics/components/{componentId}/executions?timeRange=30d&limit=50&offset=0"

# Specific version
curl -X GET "http://localhost:3000/analytics/components/{componentId}/executions?versionId={versionId}"
```

#### Get Workflows Using Component
```bash
# All workflows using this component
curl -X GET "http://localhost:3000/analytics/components/{componentId}/workflows"

# For specific version
curl -X GET "http://localhost:3000/analytics/components/{componentId}/workflows?versionId={versionId}"
```

#### Export Component Analytics
```bash
# Export as CSV (default)
curl -X GET "http://localhost:3000/analytics/components/{componentId}/export?format=csv&timeRange=30d" \
  -o component-analytics.csv

# Export as JSON
curl -X GET "http://localhost:3000/analytics/components/{componentId}/export?format=json&timeRange=30d" \
  -o component-analytics.json
```

### 2.2 Coordinator Analytics

```bash
# Get analytics
curl -X GET "http://localhost:3000/analytics/coordinators/{coordinatorId}?timeRange=30d"

# Get execution history
curl -X GET "http://localhost:3000/analytics/coordinators/{coordinatorId}/executions?limit=100"

# Get workflows using coordinator
curl -X GET "http://localhost:3000/analytics/coordinators/{coordinatorId}/workflows"

# Get component usage by coordinator
curl -X GET "http://localhost:3000/analytics/coordinators/{coordinatorId}/components?versionId={versionId}"

# Export analytics
curl -X GET "http://localhost:3000/analytics/coordinators/{coordinatorId}/export?format=csv" \
  -o coordinator-analytics.csv
```

### 2.3 Workflow Analytics

```bash
# Get analytics
curl -X GET "http://localhost:3000/analytics/workflows/{workflowId}?timeRange=30d"

# Get execution history
curl -X GET "http://localhost:3000/analytics/workflows/{workflowId}/executions?limit=100"

# Get component breakdown
curl -X GET "http://localhost:3000/analytics/workflows/{workflowId}/component-breakdown"

# Export analytics
curl -X GET "http://localhost:3000/analytics/workflows/{workflowId}/export?format=csv" \
  -o workflow-analytics.csv
```

## 3. Query Parameters

### Time Ranges
- `7d` - Last 7 days
- `30d` - Last 30 days (default)
- `90d` - Last 90 days
- `all` - All time

### Pagination
- `limit` - Max results (default: 100, max: 1000)
- `offset` - Skip N results (default: 0)

### Export Formats
- `csv` - Comma-separated values (default)
- `json` - JSON format

## 4. Response Examples

### Component Version Response
```json
{
  "id": "component-version-uuid",
  "componentId": "parent-component-uuid",
  "versionMajor": 1,
  "versionMinor": 2,
  "version": "1.2",
  "inputInstructions": "...",
  "operationInstructions": "...",
  "outputInstructions": "...",
  "config": {
    "modelId": "claude-3-5-sonnet-20241022",
    "temperature": 0.7,
    "maxInputTokens": 100000,
    "maxOutputTokens": 8192
  },
  "tools": ["tool1", "tool2"],
  "active": true,
  "checksum": "abc123def456",
  "checksumAlgorithm": "MD5",
  "changeDescription": "Fixed bug in operation logic",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Version Comparison Response
```json
{
  "entityType": "component",
  "version1": { /* version response */ },
  "version2": { /* version response */ },
  "diff": {
    "summary": {
      "fieldsAdded": 0,
      "fieldsRemoved": 0,
      "fieldsModified": 2
    },
    "changes": [
      {
        "field": "operationInstructions",
        "changeType": "modified",
        "oldValue": "old instructions",
        "newValue": "new instructions",
        "description": "Operation instructions changed"
      }
    ],
    "impactAnalysis": {
      "breakingChanges": false,
      "recommendation": "Changes are backward compatible"
    }
  }
}
```

### Component Analytics Response
```json
{
  "versionId": "component-uuid",
  "version": "1.0",
  "metrics": {
    "totalExecutions": 150,
    "successfulExecutions": 142,
    "failedExecutions": 8,
    "successRate": 94.67,
    "avgDuration": 245.5,
    "totalCost": 12.45,
    "avgCost": 0.083
  },
  "workflowsUsing": [
    {
      "workflowId": "workflow-uuid",
      "workflowName": "Story Analysis Workflow",
      "version": "1.0",
      "lastUsed": "2024-01-15T10:00:00Z",
      "executionCount": 75
    }
  ],
  "executionHistory": [
    {
      "id": "run-uuid",
      "workflowRunId": "workflow-run-uuid",
      "workflowName": "Story Analysis Workflow",
      "status": "completed",
      "startTime": "2024-01-15T10:00:00Z",
      "endTime": "2024-01-15T10:05:00Z",
      "duration": 300,
      "cost": 0.05,
      "triggeredBy": "user-uuid"
    }
  ],
  "executionTrend": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "value": 10,
      "label": "2024-01-01"
    }
  ],
  "costTrend": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "value": 0.85,
      "label": "2024-01-01"
    }
  ]
}
```

## 5. Testing with Postman

Import this collection:

```json
{
  "info": {
    "name": "ST-64 Version Management API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "componentId",
      "value": "your-component-uuid"
    },
    {
      "key": "versionId",
      "value": "your-version-uuid"
    }
  ],
  "item": [
    {
      "name": "Versioning",
      "item": [
        {
          "name": "Get Component Versions",
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/versioning/components/{{componentId}}/versions"
          }
        }
      ]
    },
    {
      "name": "Analytics",
      "item": [
        {
          "name": "Get Component Analytics",
          "request": {
            "method": "GET",
            "url": "{{baseUrl}}/analytics/components/{{componentId}}?timeRange=30d"
          }
        }
      ]
    }
  ]
}
```

## 6. Error Responses

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Component {id} not found",
  "error": "Not Found"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["versionId must be a string"],
  "error": "Bad Request"
}
```

## 7. Integration Testing Script

```bash
#!/bin/bash
# test-api.sh - Quick API integration test

BASE_URL="http://localhost:3000"
COMPONENT_ID="your-component-uuid-here"

echo "Testing ST-64 API Endpoints..."

# Test versioning
echo "1. Getting component versions..."
curl -s "$BASE_URL/versioning/components/$COMPONENT_ID/versions" | jq .

# Test analytics
echo "2. Getting component analytics..."
curl -s "$BASE_URL/analytics/components/$COMPONENT_ID?timeRange=30d" | jq .

# Test export
echo "3. Exporting analytics..."
curl -s "$BASE_URL/analytics/components/$COMPONENT_ID/export?format=csv" > test-export.csv
echo "Exported to test-export.csv"

echo "Tests complete!"
```

---

**Note**: Replace placeholder UUIDs (`{componentId}`, `{versionId}`, etc.) with actual UUIDs from your database.
