# UC-ADMIN-003: Manage Project Layers and Components

## Overview
Layers and components form the organizational structure for BA and Architect work. They help categorize stories, use cases, and test cases, enabling efficient search and impact analysis.

**Key Requirement**: BA and Architect agents operate on layer/component level. Keeping a valid, up-to-date list of layers and components is critical for story organization and use case management.

## Actor
Admin, Architect, PM

## Preconditions
- Project exists
- User has admin or architect permissions

## Main Flow

### Initial Setup

1. User navigates to Project Settings → "Layers & Components"
2. System displays Layer/Component Management interface:

**A. Layers (Technical Stack Layers)**
```
Layers define the vertical technical stack:

✓ Frontend           React, TypeScript     [Edit] [Delete]
✓ Backend/API        Node.js, Express      [Edit] [Delete]
✓ Database           PostgreSQL            [Edit] [Delete]
✓ Infrastructure     Docker, AWS           [Edit] [Delete]
✓ Integration        External APIs         [Edit] [Delete]
✓ Tests              Jest, Cypress         [Edit] [Delete]

[+ Add Layer]
```

**B. Components (Functional Domains)**
```
Components define functional areas/business capabilities:

Component Name        Layers Involved           Owner        Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Authentication       Backend, Frontend         Alice        Active   [Edit]
User Management      Backend, Frontend, DB     Bob          Active   [Edit]
Billing              Backend, Frontend, Integ  Charlie      Active   [Edit]
Reporting            Backend, Frontend, DB     Alice        Active   [Edit]
Search               Backend, Frontend         David        Active   [Edit]
Notifications        Backend, Integration      Eve          Active   [Edit]
Email Service        Integration               Eve          Active   [Edit]
Payment Gateway      Integration               Charlie      Active   [Edit]

[+ Add Component]
```

3. User adds new component:
   - Clicks "[+ Add Component]"
   - Form appears:
     ```
     Component Name: [Chat System                    ]
     Description:    [Real-time messaging between users]

     Applicable Layers (multi-select):
     ☑ Frontend
     ☑ Backend/API
     ☐ Database
     ☐ Infrastructure
     ☐ Integration
     ☐ Tests

     Owner: [Select user...        ▼]

     File Path Patterns (for auto-detection):
     • src/chat/**/*
     • src/components/messaging/**/*

     [Add Pattern]

     [Cancel]  [Save Component]
     ```

4. System validates and creates component
5. Component now available for:
   - Story categorization (BA/Architect select components)
   - Use case organization (use cases tagged by component)
   - Test case mapping
   - Search filtering
   - Code quality tracking per component

### Story Integration

6. When PM/BA/Architect works on story, they see Component selector:
   ```
   Story ST-42: Implement password reset flow

   Organization:
   Epic: [EP-3 User Authentication        ▼]

   Layers (select all that apply):
   ☑ Backend/API
   ☑ Frontend
   ☐ Database
   ☑ Integration (Email Service)

   Components (select all that apply):
   ☑ Authentication
   ☑ Email Service
   ☐ User Management
   ☐ Billing

   [Auto-suggest from description]
   ```

7. System auto-suggests components based on:
   - Story title/description keywords
   - Epic's typical components
   - Similar past stories

8. BA and Architect use components to:
   - **BA**: Filter use cases by component
     - "Show all use cases for Authentication component"
   - **Architect**: View code quality for component
     - "Authentication component: complexity 8.5, coverage 78%"
   - **Search**: Find related stories
     - "All stories affecting Authentication"

### Use Case Organization

9. When creating use case, BA tags with component:
   ```
   Use Case: UC-AUTH-003 Password Reset Flow

   Component: [Authentication           ▼]
   Layer:     [Backend, Frontend        ▼]

   This enables:
   • Finding this use case when working on Authentication stories
   • Grouping use cases by functional area
   • Impact analysis per component
   ```

10. When BA analyzes new story affecting Authentication:
    - Clicks "Show relevant use cases"
    - System filters: `component = "Authentication"`
    - BA sees all 15 use cases for Authentication
    - BA selects relevant ones to link

## Postconditions
- Project has defined layers and components
- Stories are categorized by layer/component
- Use cases are organized by component
- BA can efficiently find relevant use cases
- Architect can track quality per component
- Search and filtering enabled

## Business Rules
- **Layers** are technical (Frontend, Backend, Database, etc.)
- **Components** are functional business capabilities (Authentication, Billing, Search)
- Each component can span multiple layers
- Each story must have at least one component and one layer
- Components are required for story to move past "planning" status
- Layer/component names must be unique within project
- Cannot delete component if used in active stories (can deprecate)

## Data Model

**Updated stories table** (add component/layer fields):
```sql
ALTER TABLE stories ADD COLUMN ba_complexity INTEGER; -- 1-5, filled by BA
ALTER TABLE stories ADD COLUMN architect_complexity INTEGER; -- 1-5, filled by Architect
ALTER TABLE stories ADD COLUMN estimated_tokens INTEGER; -- filled by PM
ALTER TABLE stories ADD COLUMN ba_analysis TEXT; -- BA's analysis
ALTER TABLE stories ADD COLUMN architect_analysis TEXT; -- Architect's analysis
ALTER TABLE stories ADD COLUMN design_docs JSONB; -- links to design files/diagrams
```

**layers table**:
```sql
CREATE TABLE layers (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  name TEXT NOT NULL,
  description TEXT,
  tech_stack TEXT[],
  order_index INTEGER,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ,
  UNIQUE(project_id, name)
);
```

**components table**:
```sql
CREATE TABLE components (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users,
  status TEXT DEFAULT 'active',
  file_patterns TEXT[], -- glob patterns for auto-detection
  created_at TIMESTAMPTZ,
  UNIQUE(project_id, name)
);
```

**component_layers** (many-to-many):
```sql
CREATE TABLE component_layers (
  component_id UUID REFERENCES components,
  layer_id UUID REFERENCES layers,
  PRIMARY KEY (component_id, layer_id)
);
```

**story_layers** and **story_components**:
```sql
CREATE TABLE story_layers (
  story_id UUID REFERENCES stories,
  layer_id UUID REFERENCES layers,
  PRIMARY KEY (story_id, layer_id)
);

CREATE TABLE story_components (
  story_id UUID REFERENCES stories,
  component_id UUID REFERENCES components,
  PRIMARY KEY (story_id, component_id)
);
```

**use_cases** (update to include component):
```sql
ALTER TABLE use_cases
  ADD COLUMN component_id UUID REFERENCES components,
  ADD COLUMN layer_id UUID REFERENCES layers;

CREATE INDEX idx_use_cases_component ON use_cases(component_id);
CREATE INDEX idx_use_cases_layer ON use_cases(layer_id);
```

## MCP Tools

**Tool: `list_components`**
```typescript
{
  name: "list_components",
  parameters: {
    project_id: string,
    layer_id?: string // optionally filter by layer
  },
  returns: Component[]
}
```

**Tool: `get_component_use_cases`** (critical for BA workflow)
```typescript
{
  name: "get_component_use_cases",
  parameters: {
    component_id: string,
    status?: "active" | "deprecated"
  },
  returns: {
    component: Component,
    use_cases: UseCase[],
    story_count: number,
    test_coverage: number
  }
}
```

**Example BA agent usage**:
```typescript
// BA analyzing story ST-42 affecting Authentication component
const story = await mcp.get_story({ story_id: "ST-42" });
const components = story.components; // ["Authentication", "Email Service"]

// Get all relevant use cases for these components
const authUseCases = await mcp.get_component_use_cases({
  component_id: "authentication-comp-id"
});

// BA now sees all 15 use cases for Authentication
// BA can review and link relevant ones to story
```

## Related Use Cases
- **UC-PM-003**: Create Story (select layers/components)
- **UC-BA-001**: Analyze Story Requirements (use components to find use cases)
- **UC-BA-004**: Search Use Case Library (filter by component)
- **UC-ARCH-001**: Assess Technical Complexity (use layers/components)
- **UC-QA-003**: Manage Test Cases (link tests to use cases by component)

## Acceptance Criteria
- ✓ Layers and components can be created and managed
- ✓ Stories must be tagged with at least one component/layer
- ✓ Use cases are organized by component
- ✓ BA can filter use cases by component when analyzing story
- ✓ Architect can view code quality grouped by component
- ✓ Auto-suggestion helps select relevant components
- ✓ File path patterns enable automatic component detection
- ✓ Cannot delete component in active use
- ✓ Search works by layer/component
- ✓ Component ownership tracking works
