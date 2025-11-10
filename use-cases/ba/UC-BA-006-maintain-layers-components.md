# UC-BA-006: BA and Architect Agents Maintain Layers and Components

## Overview
BA and Architect agents proactively maintain the layer/component structure by suggesting new components, updating component mappings, and ensuring the organizational structure stays current with codebase evolution.

**Key Requirement**: Layers and components should be maintained by Business Analyst and Architect agents, not just admins.

## Actor
BA Agent, Architect Agent, with Admin oversight

## Preconditions
- Project exists with initial layer/component structure
- Agents have permissions to suggest/create components
- Admin approval workflow configured (optional)

## Main Flow

### Scenario 1: BA Agent Discovers New Functional Area

1. BA Agent is analyzing story ST-55: "Implement real-time chat system"
2. BA searches for component: "Chat" or "Messaging"
3. System finds no matching component
4. BA Agent recognizes this is a new functional area

5. BA Agent calls MCP tool: `suggest_component({ name, description, layers })`
   ```typescript
   suggest_component({
     name: "Chat System",
     description: "Real-time messaging between users",
     layers: ["Backend/API", "Frontend", "Integration"],
     reason: "New functional area discovered in ST-55",
     story_id: "ST-55",
     auto_create: false // requires approval
   })
   ```

6. System creates component suggestion:
   ```
   ┌──────────────────────────────────────────────────────────────┐
   │ NEW COMPONENT SUGGESTION                                     │
   ├──────────────────────────────────────────────────────────────┤
   │                                                              │
   │ Suggested By: BA Agent                                       │
   │ Context: Story ST-55 (Implement real-time chat)             │
   │ Date: Nov 10, 2025                                          │
   │                                                              │
   │ Component Name: Chat System                                  │
   │ Description: Real-time messaging between users               │
   │                                                              │
   │ Applicable Layers:                                          │
   │ • Backend/API    - WebSocket server, message storage        │
   │ • Frontend       - Chat UI components                        │
   │ • Integration    - Notification service integration          │
   │                                                              │
   │ Reason:                                                     │
   │ New functional area discovered during requirements          │
   │ analysis. No existing component covers real-time            │
   │ messaging functionality.                                    │
   │                                                              │
   │ Impact:                                                     │
   │ • Stories affected: ST-55, potentially future chat stories  │
   │ • Use cases to be created: UC-CHAT-001, UC-CHAT-002         │
   │                                                              │
   │ ────────────────────────────────────────────────────────    │
   │ Status: Pending Admin Approval                              │
   │                                                              │
   │ [Approve] [Request Changes] [Reject]                        │
   └──────────────────────────────────────────────────────────────┘
   ```

7. Admin/Architect reviews suggestion
8. If approved:
   - System creates "Chat System" component
   - BA Agent automatically tags ST-55 with new component
   - BA Agent proceeds with use case creation

### Scenario 2: Architect Agent Updates Component File Mappings

9. Architect Agent is reviewing code quality for "Authentication" component
10. Architect notices new auth-related files not mapped to component:
    - `src/auth/biometric-auth.ts` (new biometric authentication)
    - `src/middleware/auth-rate-limit.ts` (new rate limiting)

11. Architect Agent calls MCP: `update_component_mappings({ component_id, add_patterns })`
    ```typescript
    update_component_mappings({
      component_id: "auth-component-id",
      add_patterns: [
        "src/auth/biometric-auth.ts",
        "src/middleware/auth-rate-limit.ts"
      ],
      reason: "New authentication features added",
      auto_apply: false // requires approval
    })
    ```

12. System creates mapping update suggestion:
    ```
    ┌──────────────────────────────────────────────────────────────┐
    │ COMPONENT MAPPING UPDATE                                     │
    ├──────────────────────────────────────────────────────────────┤
    │                                                              │
    │ Suggested By: Architect Agent                                │
    │ Component: Authentication                                    │
    │ Date: Nov 10, 2025                                          │
    │                                                              │
    │ Current File Patterns (8):                                  │
    │ • src/auth/**/*.ts                                          │
    │ • src/middleware/auth.ts                                    │
    │ • src/components/login/**/*.tsx                             │
    │ • ...                                                       │
    │                                                              │
    │ Proposed Additions (2):                                     │
    │ + src/auth/biometric-auth.ts                                │
    │ + src/middleware/auth-rate-limit.ts                         │
    │                                                              │
    │ Reason:                                                     │
    │ New authentication features (biometric auth and rate        │
    │ limiting) added but not yet mapped to Authentication        │
    │ component. Detected during code quality analysis.           │
    │                                                              │
    │ Impact:                                                     │
    │ • Component health metrics will include these files         │
    │ • Stories touching these files will auto-tag with           │
    │   Authentication component                                  │
    │                                                              │
    │ ────────────────────────────────────────────────────────    │
    │ Status: Pending Approval                                    │
    │                                                              │
    │ [Approve] [Edit Patterns] [Reject]                          │
    └──────────────────────────────────────────────────────────────┘
    ```

13. Admin/Architect reviews and approves
14. System updates component file mappings
15. Future code quality queries include new files

### Scenario 3: Architect Agent Detects Component Split Needed

16. Architect Agent is analyzing "User Management" component
17. Component has grown large (45 files, complexity score dropped to 65/100)
18. Architect recognizes logical sub-domains:
    - User profiles (CRUD operations)
    - User preferences/settings
    - User roles & permissions

19. Architect Agent suggests component split:
    ```typescript
    suggest_component_split({
      original_component_id: "user-mgmt-id",
      proposed_components: [
        {
          name: "User Profiles",
          description: "User profile CRUD and data management",
          file_patterns: ["src/users/profile/**/*", "src/api/users/**/*"]
        },
        {
          name: "User Preferences",
          description: "User settings and preferences management",
          file_patterns: ["src/users/preferences/**/*", "src/users/settings/**/*"]
        },
        {
          name: "User Roles & Permissions",
          description: "Access control and permission management",
          file_patterns: ["src/users/roles/**/*", "src/users/permissions/**/*"]
        }
      ],
      reason: "Component too large and complex (45 files). Splitting improves maintainability.",
      deprecate_original: false // keep as parent for backward compat
    })
    ```

20. Admin reviews suggestion with impact analysis
21. If approved:
    - System creates 3 new components
    - Updates file mappings
    - Existing stories keep "User Management" tag (parent)
    - New stories use specific sub-components

### Scenario 4: BA Agent Auto-Creates Component (Fast Mode)

22. If project configured with `auto_create_components: true`:
23. BA Agent analyzing story finds no matching component
24. BA Agent directly creates component:
    ```typescript
    create_component({
      name: "Payment Processing",
      description: "Payment gateway integration and transaction handling",
      layers: ["Backend/API", "Integration"],
      created_by: "ba-agent",
      auto_created: true,
      story_id: "ST-67"
    })
    ```

25. Component created immediately
26. Admin receives notification for review
27. Admin can adjust or approve after the fact

### Scenario 5: Architect Agent Updates Component Health Thresholds

28. Architect Agent notices "Authentication" component has stricter requirements
29. Architect suggests component-specific thresholds:
    ```typescript
    update_component_thresholds({
      component_id: "auth-component-id",
      thresholds: {
        min_coverage: 90, // higher than default 80%
        max_complexity: 8, // lower than default 10
        max_churn_rate: 20 // lower than default 30%
      },
      reason: "Critical security component requires higher quality standards"
    })
    ```

30. System applies thresholds
31. Code quality warnings trigger earlier for this component

## Postconditions
- Components stay current with codebase evolution
- New functional areas have corresponding components
- File mappings are accurate
- BA and Architect agents maintain structure proactively
- Admin has oversight and approval workflow

## Alternative Flows

### 6a. Auto-approval for trusted agents
- At step 6, if agent has `trusted_maintainer` role
- System auto-approves suggestion
- Admin receives notification but no action needed

### 7a. Suggestion rejected
- Admin rejects suggestion with reason
- BA Agent receives feedback
- BA Agent adjusts approach (e.g., use existing component)

### 20a. Split rejected - merge instead
- Admin suggests merging components instead of splitting
- System provides merge wizard
- Combines components and consolidates mappings

## Business Rules
- BA Agents can suggest new components (requires approval unless auto-create enabled)
- Architect Agents can update file mappings (requires approval unless trusted)
- Admin can configure auto-approval for specific agents
- Component suggestions include rationale and impacted stories
- File pattern updates require validation (no overlaps)
- Component splits must cover all files of original component
- Audit log records all component changes with agent/human attribution

## Data Model

**component_suggestions table**:
```sql
CREATE TABLE component_suggestions (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  suggested_by UUID REFERENCES users, -- can be agent
  suggestion_type TEXT, -- 'create', 'update_mappings', 'split', 'merge'

  component_name TEXT,
  description TEXT,
  layers TEXT[],
  file_patterns TEXT[],

  reason TEXT,
  context_story_id UUID REFERENCES stories,

  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by UUID REFERENCES users,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

**component_changes_log table** (audit):
```sql
CREATE TABLE component_changes_log (
  id UUID PRIMARY KEY,
  component_id UUID REFERENCES components,
  changed_by UUID REFERENCES users, -- agent or human
  change_type TEXT, -- 'created', 'updated_mappings', 'updated_thresholds', 'deprecated'
  changes JSONB, -- detailed changes
  reason TEXT,
  created_at TIMESTAMPTZ
);
```

## MCP Tools

**Tool: `suggest_component`** (used by BA/Architect agents):
```typescript
{
  name: "suggest_component",
  parameters: {
    name: string,
    description: string,
    layers: string[],
    reason: string,
    story_id?: string,
    auto_create?: boolean, // if true and allowed, creates immediately
    file_patterns?: string[]
  },
  returns: {
    suggestion_id?: string, // if needs approval
    component_id?: string, // if auto-created
    status: "created" | "pending_approval"
  }
}
```

**Tool: `update_component_mappings`**:
```typescript
{
  name: "update_component_mappings",
  parameters: {
    component_id: string,
    add_patterns?: string[],
    remove_patterns?: string[],
    reason: string,
    auto_apply?: boolean
  },
  returns: {
    suggestion_id?: string,
    status: "applied" | "pending_approval"
  }
}
```

**Tool: `suggest_component_split`**:
```typescript
{
  name: "suggest_component_split",
  parameters: {
    original_component_id: string,
    proposed_components: Array<{
      name: string,
      description: string,
      file_patterns: string[]
    }>,
    reason: string,
    deprecate_original?: boolean
  },
  returns: {
    suggestion_id: string,
    status: "pending_approval"
  }
}
```

**Tool: `list_component_suggestions`** (for Admin):
```typescript
{
  name: "list_component_suggestions",
  parameters: {
    project_id: string,
    status?: "pending" | "approved" | "rejected"
  },
  returns: {
    suggestions: ComponentSuggestion[]
  }
}
```

**Tool: `approve_component_suggestion`** (Admin):
```typescript
{
  name: "approve_component_suggestion",
  parameters: {
    suggestion_id: string,
    notes?: string
  }
}
```

## Integration with Agent Workflows

### BA Agent Workflow:
```typescript
// In BA analysis phase
const story = await mcp.get_story({ story_id });

// Check if components exist for story domain
const components = await mcp.list_components({ project_id });
const matchingComponents = findRelevantComponents(story.title, story.description, components);

if (matchingComponents.length === 0) {
  // No matching component found - suggest new one
  const suggestion = await mcp.suggest_component({
    name: extractComponentName(story),
    description: extractComponentDescription(story),
    layers: inferLayers(story),
    reason: `New functional area discovered in ${story.key}`,
    story_id: story.id,
    auto_create: config.auto_create_components
  });

  if (suggestion.status === "created") {
    // Use new component immediately
    await mcp.update_story({
      story_id: story.id,
      component_ids: [suggestion.component_id]
    });
  }
}
```

### Architect Agent Workflow:
```typescript
// During technical assessment
const story = await mcp.get_story({ story_id });
const components = story.components;

for (const component of components) {
  const health = await mcp.get_component_health({ component_id: component.id });

  // Check if file mappings are current
  const affectedFiles = identifyAffectedFiles(story);
  const unmappedFiles = affectedFiles.filter(f => !isFileMappedToComponent(f, component));

  if (unmappedFiles.length > 0) {
    // Suggest adding files to component mapping
    await mcp.update_component_mappings({
      component_id: component.id,
      add_patterns: unmappedFiles,
      reason: `Files affected by ${story.key} not yet mapped`,
      auto_apply: false
    });
  }
}
```

## Related Use Cases
- UC-ADMIN-003: Manage Layers and Components (admin control panel)
- UC-BA-001: Analyze Story Requirements (BA uses components)
- UC-BA-005: Advanced Use Case Search (search by component)
- UC-ARCH-001: Assess Technical Complexity (Architect uses components)
- UC-ARCH-004: Query Code Health by Component (uses component mappings)

## Acceptance Criteria
- ✓ BA Agent can suggest new components
- ✓ Architect Agent can update component file mappings
- ✓ Architect Agent can suggest component splits
- ✓ Admin approval workflow works correctly
- ✓ Auto-create mode available for trusted agents
- ✓ All suggestions include rationale and context
- ✓ Component changes are audited
- ✓ Suggestions display impact analysis
- ✓ File pattern validation prevents overlaps
- ✓ Agents receive feedback on rejected suggestions
- ✓ Component structure stays current with code evolution
- ✓ No admin bottleneck - agents maintain structure proactively
