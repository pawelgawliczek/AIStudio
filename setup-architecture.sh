#!/bin/bash

# Architecture Setup Script for AIStudio
# Project ID: 345a29ee-d6ab-477d-8079-c5dda0844d77

API_URL="http://localhost:3000/api"
PROJECT_ID="345a29ee-d6ab-477d-8079-c5dda0844d77"

# Get auth token (replace with your actual token or login credentials)
# For demo, using system user credentials
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"system@aistudio.local","password":"your_password"}' | jq -r '.access_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to authenticate. Please update credentials in the script."
  exit 1
fi

echo "✅ Authenticated successfully"
echo ""
echo "🏗️  Creating Architectural Layers..."
echo ""

# Create Presentation Layer
LAYER1=$(curl -s -X POST "$API_URL/layers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Presentation Layer",
    "description": "User interfaces and client-side logic",
    "techStack": ["React","TypeScript","Vite","TailwindCSS","Socket.io-client","React Query","dnd-kit"],
    "orderIndex": 1,
    "color": "#3B82F6",
    "icon": "🌐",
    "status": "active"
  }')
PRESENTATION_ID=$(echo $LAYER1 | jq -r '.id')
echo "✓ Created Presentation Layer: $PRESENTATION_ID"

# Create Application Layer
LAYER2=$(curl -s -X POST "$API_URL/layers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Application Layer",
    "description": "Backend services, REST API, and WebSocket gateway",
    "techStack": ["NestJS","TypeScript","Node.js","Socket.IO","Passport.js","class-validator"],
    "orderIndex": 2,
    "color": "#10B981",
    "icon": "⚙️",
    "status": "active"
  }')
APPLICATION_ID=$(echo $LAYER2 | jq -r '.id')
echo "✓ Created Application Layer: $APPLICATION_ID"

# Create Domain Layer
LAYER3=$(curl -s -X POST "$API_URL/layers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Domain Layer",
    "description": "Core business logic and domain models",
    "techStack": ["TypeScript","Domain Models","Business Rules"],
    "orderIndex": 3,
    "color": "#8B5CF6",
    "icon": "🧠",
    "status": "active"
  }')
DOMAIN_ID=$(echo $LAYER3 | jq -r '.id')
echo "✓ Created Domain Layer: $DOMAIN_ID"

# Create Infrastructure Layer
LAYER4=$(curl -s -X POST "$API_URL/layers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Infrastructure Layer",
    "description": "Database, cache, external APIs, and deployment",
    "techStack": ["PostgreSQL","pgvector","Prisma","Redis","Docker","Caddy","OpenAI API"],
    "orderIndex": 4,
    "color": "#F59E0B",
    "icon": "🔧",
    "status": "active"
  }')
INFRASTRUCTURE_ID=$(echo $LAYER4 | jq -r '.id')
echo "✓ Created Infrastructure Layer: $INFRASTRUCTURE_ID"

echo ""
echo "🎨 Creating Components..."
echo ""

# 1. Authentication
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Authentication",
    "description": "JWT authentication, login, logout, token management",
    "layerIds": ["'$PRESENTATION_ID'","'$APPLICATION_ID'","'$INFRASTRUCTURE_ID'"],
    "filePatterns": ["**/auth/**","**/login/**","**/*auth*"],
    "color": "#3B82F6",
    "icon": "🔐",
    "status": "active"
  }' > /dev/null
echo "✓ Created Authentication component"

# 2. Project Management
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Project Management",
    "description": "Projects, Epics, Stories, Subtasks CRUD operations",
    "layerIds": ["'$PRESENTATION_ID'","'$APPLICATION_ID'","'$DOMAIN_ID'","'$INFRASTRUCTURE_ID'"],
    "filePatterns": ["**/projects/**","**/epics/**","**/stories/**","**/subtasks/**"],
    "color": "#10B981",
    "icon": "📊",
    "status": "active"
  }' > /dev/null
echo "✓ Created Project Management component"

# 3. Planning Board
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Planning Board",
    "description": "Kanban board with drag-and-drop, story filters, bulk actions",
    "layerIds": ["'$PRESENTATION_ID'","'$APPLICATION_ID'"],
    "filePatterns": ["**/planning/**","**/kanban/**","**/PlanningView*"],
    "color": "#8B5CF6",
    "icon": "🎯",
    "status": "active"
  }' > /dev/null
echo "✓ Created Planning Board component"

# 4. Timeline View
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Timeline View",
    "description": "Gantt-style timeline visualization for project planning",
    "layerIds": ["'$PRESENTATION_ID'"],
    "filePatterns": ["**/timeline/**","**/TimelineView*"],
    "color": "#EC4899",
    "icon": "📅",
    "status": "active"
  }' > /dev/null
echo "✓ Created Timeline View component"

# 5. Use Case Library
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Use Case Library",
    "description": "Use case management with semantic search and versioning",
    "layerIds": ["'$PRESENTATION_ID'","'$APPLICATION_ID'","'$DOMAIN_ID'","'$INFRASTRUCTURE_ID'"],
    "filePatterns": ["**/use-cases/**","**/UseCaseLibrary*"],
    "color": "#14B8A6",
    "icon": "📚",
    "status": "active"
  }' > /dev/null
echo "✓ Created Use Case Library component"

# 6. Test Management
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Test Management",
    "description": "Test cases, test executions, coverage tracking",
    "layerIds": ["'$PRESENTATION_ID'","'$APPLICATION_ID'","'$DOMAIN_ID'","'$INFRASTRUCTURE_ID'"],
    "filePatterns": ["**/test-cases/**","**/test-executions/**","**/TestCase*"],
    "color": "#F59E0B",
    "icon": "🧪",
    "status": "active"
  }' > /dev/null
echo "✓ Created Test Management component"

# 7. Agent Telemetry
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Agent Telemetry",
    "description": "Agent runs tracking, frameworks, token costs, performance metrics",
    "layerIds": ["'$APPLICATION_ID'","'$DOMAIN_ID'","'$INFRASTRUCTURE_ID'"],
    "filePatterns": ["**/runs/**","**/agent-frameworks/**","**/agent-metrics/**"],
    "color": "#EF4444",
    "icon": "📈",
    "status": "active"
  }' > /dev/null
echo "✓ Created Agent Telemetry component"

# 8. Code Quality
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Code Quality",
    "description": "Git commits tracking, code metrics, complexity analysis",
    "layerIds": ["'$PRESENTATION_ID'","'$APPLICATION_ID'","'$DOMAIN_ID'","'$INFRASTRUCTURE_ID'"],
    "filePatterns": ["**/commits/**","**/code-metrics/**","**/CodeQuality*"],
    "color": "#6366F1",
    "icon": "💎",
    "status": "active"
  }' > /dev/null
echo "✓ Created Code Quality component"

# 9. Real-time Updates
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Real-time Updates",
    "description": "WebSocket gateway for live synchronization",
    "layerIds": ["'$PRESENTATION_ID'","'$APPLICATION_ID'"],
    "filePatterns": ["**/websocket/**","**/*socket*","**/*gateway*"],
    "color": "#EC4899",
    "icon": "⚡",
    "status": "active"
  }' > /dev/null
echo "✓ Created Real-time Updates component"

# 10. MCP Server
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "MCP Server",
    "description": "Model Context Protocol server with progressive disclosure",
    "layerIds": ["'$APPLICATION_ID'"],
    "filePatterns": ["**/mcp/**","mcp-server/**"],
    "color": "#A855F7",
    "icon": "🤖",
    "status": "active"
  }' > /dev/null
echo "✓ Created MCP Server component"

# 11. User Management
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "User Management",
    "description": "User profiles, roles, permissions",
    "layerIds": ["'$PRESENTATION_ID'","'$APPLICATION_ID'","'$INFRASTRUCTURE_ID'"],
    "filePatterns": ["**/users/**","**/profile/**"],
    "color": "#06B6D4",
    "icon": "👤",
    "status": "active"
  }' > /dev/null
echo "✓ Created User Management component"

# 12. Architecture Management
curl -s -X POST "$API_URL/components" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "name": "Architecture Management",
    "description": "Layers and Components configuration interface",
    "layerIds": ["'$PRESENTATION_ID'","'$APPLICATION_ID'","'$DOMAIN_ID'","'$INFRASTRUCTURE_ID'"],
    "filePatterns": ["**/layers/**","**/components/**","**/LayersComponents*"],
    "color": "#84CC16",
    "icon": "🏗️",
    "status": "active"
  }' > /dev/null
echo "✓ Created Architecture Management component"

echo ""
echo "🎉 Architecture setup complete!"
echo ""
echo "📊 Summary:"
echo "   ✓ 4 Architectural Layers"
echo "   ✓ 12 Components"
echo ""
echo "🔗 View in UI: http://localhost:5173/layers-components?projectId=$PROJECT_ID"
