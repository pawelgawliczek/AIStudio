# Layers & Components: System-Wide Analysis and Design

## Executive Summary

**Layers** and **Components** are the organizational backbone of the AI Studio system. They enable:
- Story categorization and search
- Use case organization
- Test case mapping
- Code quality tracking per functional area
- Architecture insights by technical layer
- Agent workflow efficiency (BA finding relevant use cases, Architect assessing complexity)

## Current Implementation Status

### ✅ Partially Implemented

**In Prisma Schema:**
- `LayerType` enum exists (frontend, backend, infra, test, other)
- `Subtask` model has `layer: LayerType?` and `component: String?` fields
- Stories do NOT have layer/component fields (stored only at subtask level)

**Missing:**
- `Layer` table (project-specific layers with descriptions, tech stack, order)
- `Component` table (project-specific components with owners, file patterns)
- `StoryLayer` junction table
- `StoryComponent` junction table
- `ComponentLayer` junction table (which layers each component spans)
- Layer/Component fields on `UseCase` model
- Layer/Component fields on `TestCase` model
- Management UI for creating/editing layers and components

## Where Layers and Components Should Be Used

### 1. **Stories** (PRIMARY USE) - ❌ NOT IMPLEMENTED

**Purpose:** Categorize what technical layers and functional areas a story affects

**Schema Required:**
```prisma
model Story {
  // ... existing fields ...
  layers       StoryLayer[]      // Many-to-many: which technical layers
  components   StoryComponent[]  // Many-to-many: which functional components
}

model StoryLayer {
  storyId  String  @db.Uuid
  layerId  String  @db.Uuid
  story    Story   @relation(fields: [storyId], references: [id], onDelete: Cascade)
  layer    Layer   @relation(fields: [layerId], references: [id], onDelete: Cascade)
  @@id([storyId, layerId])
  @@map("story_layers")
}

model StoryComponent {
  storyId     String    @db.Uuid
  componentId String    @db.Uuid
  story       Story     @relation(fields: [storyId], references: [id], onDelete: Cascade)
  component   Component @relation(fields: [componentId], references: [id], onDelete: Cascade)
  @@id([storyId, componentId])
  @@map("story_components")
}
```

**UI Integration:**
- CreateStoryModal: Add "Organization" tab with layer/component multi-select
- StoryListPage: Filter by layer/component
- StoryDetailPage: Display story's layers and components
- Auto-suggest components based on title/description keywords

**Use Cases:**
- PM creating story selects affected components (UC-PM-003)
- BA finds relevant use cases by component (UC-BA-001)
- Architect views stories affecting specific layers (UC-ARCH-003)
- Search/filter: "Show all stories for Authentication component"

---

### 2. **Use Cases** (CRITICAL FOR BA WORKFLOW) - ❌ NOT IMPLEMENTED

**Purpose:** Organize use cases by functional component so BA can quickly find relevant ones

**Schema Required:**
```prisma
model UseCase {
  // ... existing fields ...
  componentId String?   @map("component_id") @db.Uuid
  layerId     String?   @map("layer_id") @db.Uuid

  component   Component? @relation(fields: [componentId], references: [id], onDelete: SetNull)
  layer       Layer?     @relation(fields: [layerId], references: [id], onDelete: SetNull)

  @@index([componentId])
  @@index([layerId])
}
```

**UI Integration:**
- Use case creation form: Select component and layer
- Use case library: Filter by component
- When BA analyzes story, system shows use cases matching story's components

**Agent Workflow:**
```
Story ST-42: "Implement password reset"
→ Components: [Authentication, Email Service]
→ BA agent queries: list_use_cases(component_id = "auth-id")
→ Returns: 15 use cases for Authentication
→ BA reviews and links relevant ones to story
```

**Use Cases:**
- UC-BA-001: Analyze Story Requirements
- UC-BA-004: Search Use Case Library (filter by component)

---

### 3. **Test Cases** (IMPORTANT FOR QA) - ❌ NOT IMPLEMENTED

**Purpose:** Map test cases to components for coverage tracking

**Schema Required:**
```prisma
model TestCase {
  // ... existing fields ...
  componentId String?   @map("component_id") @db.Uuid
  layerId     String?   @map("layer_id") @db.Uuid

  component   Component? @relation(fields: [componentId], references: [id], onDelete: SetNull)
  layer       Layer?     @relation(fields: [layerId], references: [id], onDelete: SetNull)

  @@index([componentId])
  @@index([layerId])
}
```

**UI Integration:**
- Test case creation: Select component and layer
- Test coverage view: Show coverage breakdown by component
- Example: "Authentication component: 78% test coverage (35/45 test cases)"

**Use Cases:**
- UC-QA-003: Manage Test Case Coverage
- Test coverage dashboard by component

---

### 4. **Code Metrics** (ARCHITECTURE INSIGHTS) - ⚠️ PARTIALLY IMPLEMENTED

**Purpose:** Track code quality per component and layer

**Current Status:**
- Code metrics API has placeholder for component-level metrics
- Component health tracking mentioned in UC-ARCH-004

**Schema Required:**
```prisma
// CodeMetrics could be enhanced to track by component
model CodeHealth {
  id          String    @id @default(uuid_generate_v4()) @db.Uuid
  projectId   String    @map("project_id") @db.Uuid
  componentId String?   @map("component_id") @db.Uuid  // NEW
  layerId     String?   @map("layer_id") @db.Uuid      // NEW

  complexity       Float
  coverage         Float
  technicalDebt    Float
  measuredAt       DateTime

  project   Project    @relation(fields: [projectId], references: [id])
  component Component? @relation(fields: [componentId], references: [id])
  layer     Layer?     @relation(fields: [layerId], references: [id])
}
```

**UI Integration:**
- Code Quality Dashboard: Group metrics by component
- Example:
  ```
  Authentication: Health 85%, Complexity 8.5, Coverage 78%
  Billing: Health 72%, Complexity 12.3, Coverage 65%
  ```

**Use Cases:**
- UC-ARCH-002: View Code Quality Dashboard
- UC-ARCH-004: Query Code Health by Component

---

### 5. **Subtasks** - ✅ ALREADY IMPLEMENTED

**Current Status:**
- Subtask model has `layer: LayerType?` and `component: String?`
- **Note:** Uses enum LayerType and string for component (not foreign keys)

**Recommendation:** Keep as-is for flexibility, but consider:
- Validating component string against project's Component table
- Auto-suggesting from project components

---

### 6. **Agent Frameworks** (OPTIONAL)

**Purpose:** Framework specialization by layer/component

**Schema:**
```prisma
model AgentFrameworkCapability {
  frameworkId String    @map("framework_id") @db.Uuid
  layerId     String?   @map("layer_id") @db.Uuid
  componentId String?   @map("component_id") @db.Uuid

  framework AgentFramework @relation(fields: [frameworkId], references: [id])
  layer     Layer?         @relation(fields: [layerId], references: [id])
  component Component?     @relation(fields: [componentId], references: [id])

  @@id([frameworkId, layerId, componentId])
}
```

**Example:** "Full BA+Arch+Dev+QA framework specializes in Authentication component"

**Priority:** LOW - Can be added later

---

## Core Data Models

### Layer Model

```prisma
model Layer {
  id          String   @id @default(uuid_generate_v4()) @db.Uuid
  projectId   String   @map("project_id") @db.Uuid
  name        String   // "Frontend", "Backend API", "Database", etc.
  description String?
  techStack   String[] // ["React", "TypeScript", "Vite"]
  orderIndex  Int      @map("order_index")  // Display order in UI
  color       String?  // Hex color for UI visualization
  icon        String?  // Icon name or emoji
  status      LayerStatus @default(active)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  project          Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  storyLayers      StoryLayer[]
  componentLayers  ComponentLayer[]
  useCases         UseCase[]
  testCases        TestCase[]
  subtasks         Subtask[]        // If we migrate from enum to FK
  codeHealth       CodeHealth[]

  @@unique([projectId, name])
  @@index([projectId, status])
  @@map("layers")
}

enum LayerStatus {
  active
  deprecated
}
```

### Component Model

```prisma
model Component {
  id            String   @id @default(uuid_generate_v4()) @db.Uuid
  projectId     String   @map("project_id") @db.Uuid
  name          String   // "Authentication", "Billing", "Reporting"
  description   String?
  ownerId       String?  @map("owner_id") @db.Uuid  // Team member responsible
  status        ComponentStatus @default(active)
  color         String?  // Hex color for UI
  icon          String?  // Icon or emoji

  // Auto-detection patterns
  filePatterns  String[] @map("file_patterns")  // ["src/auth/**/*", "**/*auth*.ts"]

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  project           Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  owner             User?             @relation(fields: [ownerId], references: [id], onDelete: SetNull)
  layers            ComponentLayer[]  // Which layers this component spans
  storyComponents   StoryComponent[]
  useCases          UseCase[]
  testCases         TestCase[]
  subtasks          Subtask[]         // If we migrate
  codeHealth        CodeHealth[]

  @@unique([projectId, name])
  @@index([projectId, status])
  @@map("components")
}

enum ComponentStatus {
  active
  deprecated
  planning  // For components being added
}
```

### ComponentLayer Junction

```prisma
model ComponentLayer {
  componentId String    @map("component_id") @db.Uuid
  layerId     String    @map("layer_id") @db.Uuid

  component Component @relation(fields: [componentId], references: [id], onDelete: Cascade)
  layer     Layer     @relation(fields: [layerId], references: [id], onDelete: Cascade)

  @@id([componentId, layerId])
  @@map("component_layers")
}
```

**Purpose:** Define which layers each component spans
**Example:** Authentication component spans [Frontend, Backend, Database]

---

## Management UI Design

### Location: `/projects/:projectId/settings/layers-components`

### UI Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Project Settings > Layers & Components                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [Layers Tab] [Components Tab]                                  │
│                                                                 │
│ ╔═══════════════════════════════════════════════════════════╗ │
│ ║ LAYERS                                      [+ Add Layer] ║ │
│ ╠═══════════════════════════════════════════════════════════╣ │
│ ║                                                           ║ │
│ ║ ┌─────────────────────────────────────────────────────┐  ║ │
│ ║ │ 🌐 Frontend                              [Edit] [×] │  ║ │
│ ║ │ React, TypeScript, Vite                            │  ║ │
│ ║ │ Used in: 42 stories, 8 components                  │  ║ │
│ ║ └─────────────────────────────────────────────────────┘  ║ │
│ ║                                                           ║ │
│ ║ ┌─────────────────────────────────────────────────────┐  ║ │
│ ║ │ ⚙️ Backend API                           [Edit] [×] │  ║ │
│ ║ │ Node.js, NestJS, PostgreSQL                        │  ║ │
│ ║ │ Used in: 38 stories, 12 components                 │  ║ │
│ ║ └─────────────────────────────────────────────────────┘  ║ │
│ ║                                                           ║ │
│ ║ ┌─────────────────────────────────────────────────────┐  ║ │
│ ║ │ 🗄️ Database                             [Edit] [×] │  ║ │
│ ║ │ PostgreSQL, Prisma                                 │  ║ │
│ ║ │ Used in: 28 stories, 6 components                  │  ║ │
│ ║ └─────────────────────────────────────────────────────┘  ║ │
│ ║                                                           ║ │
│ ╚═══════════════════════════════════════════════════════════╝ │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Add New Layer                                             │ │
│ │                                                           │ │
│ │ Name: [Frontend Testing              ]                   │ │
│ │ Description: [E2E and component tests]                   │ │
│ │                                                           │ │
│ │ Tech Stack (comma separated):                            │ │
│ │ [Cypress, Jest, React Testing Library]                   │ │
│ │                                                           │ │
│ │ Icon: [🧪]  Color: [#FFA500]  Order: [4]                │ │
│ │                                                           │ │
│ │ [Cancel]  [Save Layer]                                   │ │
│ └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│ [Layers Tab] [Components Tab]                                   │
│                                                                 │
│ ╔═══════════════════════════════════════════════════════════╗ │
│ ║ COMPONENTS                                [+ Add Component]║ │
│ ╠═══════════════════════════════════════════════════════════╣ │
│ ║                                                           ║ │
│ ║ ┌─────────────────────────────────────────────────────┐  ║ │
│ ║ │ 🔐 Authentication              Owner: Alice [Edit] │  ║ │
│ ║ │ User login, registration, password reset           │  ║ │
│ ║ │ Layers: Frontend, Backend API, Database            │  ║ │
│ ║ │ Used in: 18 stories, 12 use cases, 35 tests        │  ║ │
│ ║ │ Health: 85% | Coverage: 78% | Complexity: 8.5      │  ║ │
│ ║ └─────────────────────────────────────────────────────┘  ║ │
│ ║                                                           ║ │
│ ║ ┌─────────────────────────────────────────────────────┐  ║ │
│ ║ │ 💳 Billing                     Owner: Charlie [Edit]│  ║ │
│ ║ │ Payment processing, invoicing, subscriptions       │  ║ │
│ ║ │ Layers: Frontend, Backend API, Database, Integration │ │
│ ║ │ Used in: 24 stories, 8 use cases, 42 tests         │  ║ │
│ ║ │ Health: 72% | Coverage: 65% | Complexity: 12.3     │  ║ │
│ ║ └─────────────────────────────────────────────────────┘  ║ │
│ ║                                                           ║ │
│ ╚═══════════════════════════════════════════════════════════╝ │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Add New Component                                         │ │
│ │                                                           │ │
│ │ Name: [Real-time Chat                ]                   │ │
│ │ Description: [Messaging between users and support]       │ │
│ │                                                           │ │
│ │ Owner: [Select team member...          ▼]                │ │
│ │                                                           │ │
│ │ Applicable Layers (select all that apply):               │ │
│ │ ☑ Frontend                                               │ │
│ │ ☑ Backend API                                            │ │
│ │ ☐ Database                                               │ │
│ │ ☑ Integration (WebSocket)                                │ │
│ │                                                           │ │
│ │ Auto-detection File Patterns:                            │ │
│ │ • src/chat/**/*                           [Remove]       │ │
│ │ • src/components/messaging/**/*           [Remove]       │ │
│ │ [+ Add Pattern]                                          │ │
│ │                                                           │ │
│ │ Icon: [💬]  Color: [#4A90E2]                            │ │
│ │                                                           │ │
│ │ [Cancel]  [Save Component]                               │ │
│ └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Database Schema (HIGH PRIORITY)

**Files to Create/Modify:**
1. `backend/prisma/schema.prisma`:
   - Add `Layer` model
   - Add `Component` model
   - Add `ComponentLayer` junction
   - Add `StoryLayer` junction
   - Add `StoryComponent` junction
   - Add `componentId`, `layerId` to `UseCase`
   - Add `componentId`, `layerId` to `TestCase`
   - Add enums: `LayerStatus`, `ComponentStatus`

2. Migration:
   ```bash
   npx prisma migrate dev --name add_layers_components_system
   ```

3. Seed data:
   - Create default layers for demo project
   - Create sample components (Authentication, Billing, etc.)

---

### Phase 2: Backend API (HIGH PRIORITY)

**Controllers to Create:**
1. `layers.controller.ts`:
   - `GET /api/projects/:projectId/layers` - List layers
   - `POST /api/projects/:projectId/layers` - Create layer
   - `PATCH /api/layers/:id` - Update layer
   - `DELETE /api/layers/:id` - Delete (with validation)

2. `components.controller.ts`:
   - `GET /api/projects/:projectId/components` - List components
   - `POST /api/projects/:projectId/components` - Create component
   - `PATCH /api/components/:id` - Update component
   - `DELETE /api/components/:id` - Delete (with validation)
   - `GET /api/components/:id/usage` - Get usage stats

**Services to Create:**
1. `layers.service.ts`:
   - Validation: prevent delete if in use
   - Auto-ordering logic

2. `components.service.ts`:
   - Validation: prevent delete if in use
   - File pattern matching logic
   - Auto-suggestion based on keywords

---

### Phase 3: Frontend Management UI (HIGH PRIORITY)

**Pages to Create:**
1. `LayersComponentsSettingsPage.tsx`:
   - Tabbed interface (Layers / Components)
   - List view with usage stats
   - Add/Edit/Delete functionality
   - Drag-and-drop reordering for layers

**Components to Create:**
1. `LayerCard.tsx` - Display layer with usage stats
2. `ComponentCard.tsx` - Display component with metrics
3. `LayerForm.tsx` - Create/edit layer form
4. `ComponentForm.tsx` - Create/edit component form
5. `LayerPicker.tsx` - Multi-select for layers (reusable)
6. `ComponentPicker.tsx` - Multi-select for components (reusable)

**Route to Add:**
```typescript
<Route path="projects/:projectId/settings/layers-components" element={<LayersComponentsSettingsPage />} />
```

---

### Phase 4: Integrate with Story Creation (HIGH PRIORITY)

**Files to Modify:**
1. `CreateStoryModal.tsx`:
   - Add "Organization" section/tab
   - Add `LayerPicker` multi-select
   - Add `ComponentPicker` multi-select with auto-suggest
   - Validation: require at least one layer and component

2. `StoryListPage.tsx`:
   - Add layer/component filters to `StoryFilters`

3. `StoryDetailPage.tsx`:
   - Display story's layers as badges
   - Display story's components as badges

---

### Phase 5: Integrate with Use Cases (MEDIUM PRIORITY)

**Files to Modify:**
1. Use case creation form:
   - Add component selector
   - Add layer selector

2. Use case library/search:
   - Filter by component
   - Filter by layer

3. BA agent workflow:
   - When analyzing story, fetch use cases matching story's components
   - Display: "Found 15 use cases for Authentication component"

---

### Phase 6: Integrate with Test Cases (MEDIUM PRIORITY)

**Files to Modify:**
1. Test case creation form:
   - Add component selector
   - Add layer selector

2. Test coverage dashboard:
   - Group by component
   - Show coverage per component
   - Example: "Authentication: 78% covered (35/45 tests)"

---

### Phase 7: Code Quality Integration (LOWER PRIORITY)

**Files to Modify:**
1. `CodeQualityDashboard.tsx`:
   - Group metrics by component
   - Show health score per component

2. Component health tracking:
   - Store code metrics per component
   - Trend over time

---

## Auto-Suggestion Logic

### Component Auto-Suggestion for Stories

When PM enters story title/description, scan for keywords:

```typescript
const COMPONENT_KEYWORDS = {
  "Authentication": ["login", "signup", "password", "auth", "session", "jwt", "oauth"],
  "Billing": ["payment", "invoice", "subscription", "stripe", "pricing", "checkout"],
  "Reporting": ["report", "analytics", "dashboard", "export", "chart", "visualization"],
  "Search": ["search", "query", "filter", "find", "lookup", "elasticsearch"],
  "Notifications": ["notification", "alert", "email", "push", "sms", "reminder"],
  // etc.
};

function suggestComponents(title: string, description: string): string[] {
  const text = (title + " " + description).toLowerCase();
  const suggestions: string[] = [];

  for (const [component, keywords] of Object.entries(COMPONENT_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      suggestions.push(component);
    }
  }

  return suggestions;
}
```

---

## Validation Rules

### Layer Validation:
- ✅ Name must be unique within project
- ✅ Cannot delete layer if used in active stories
- ✅ Can deprecate instead of delete
- ✅ Order index must be unique

### Component Validation:
- ✅ Name must be unique within project
- ✅ Must have at least one layer selected
- ✅ Cannot delete component if used in active stories/use cases/tests
- ✅ Can deprecate instead of delete
- ✅ File patterns must be valid glob patterns

### Story Validation:
- ✅ Draft stories: layers/components optional
- ✅ Non-draft stories: at least 1 layer and 1 component required
- ✅ Cannot save story with status >= "planning" without layers/components

---

## MCP Tool Extensions

### New MCP Tools:

1. **`list_components`**
   ```typescript
   mcp.list_components({ project_id, layer_id? })
   → Returns: Component[]
   ```

2. **`get_component_use_cases`** (Critical for BA)
   ```typescript
   mcp.get_component_use_cases({ component_id })
   → Returns: { component, use_cases[], story_count, test_coverage }
   ```

3. **`suggest_components`**
   ```typescript
   mcp.suggest_components({ title, description })
   → Returns: string[]  // Suggested component names
   ```

4. **`get_component_health`**
   ```typescript
   mcp.get_component_health({ component_id })
   → Returns: { health_score, complexity, coverage, defect_count }
   ```

---

## Summary

### Immediate Next Steps:

1. ✅ **Create Database Schema** (Layers, Components, junctions)
2. ✅ **Create Backend API** (CRUD for layers and components)
3. ✅ **Create Management UI** (`LayersComponentsSettingsPage`)
4. ✅ **Integrate with Story Creation** (Add layer/component pickers)
5. ⚠️ **Add Use Case Integration** (Component field on use cases)
6. ⚠️ **Add Test Case Integration** (Component field on test cases)
7. ⚠️ **Add Code Quality Integration** (Metrics by component)

### Benefits After Implementation:

- **PM:** Easily categorize stories by functional area
- **BA:** Instantly find relevant use cases when analyzing story
- **Architect:** Track code quality per component and layer
- **QA:** View test coverage grouped by component
- **Search:** Filter stories/use cases/tests by layer or component
- **Reports:** Analyze velocity and quality per component
