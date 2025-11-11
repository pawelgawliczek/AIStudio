# Use Cases: Layer and Component Management

This document describes the use cases for managing layers and components in Vibe Studio. Layers represent the technical architecture (Frontend, Backend API, Database, Infrastructure), while Components represent business domains (Authentication, Billing, Project Management, etc.).

## Table of Contents

- [Layer Management](#layer-management)
  - [UC-LAY-001: Create Layer](#uc-lay-001-create-layer)
  - [UC-LAY-002: List Layers](#uc-lay-002-list-layers)
  - [UC-LAY-003: Get Layer Details](#uc-lay-003-get-layer-details)
  - [UC-LAY-004: Update Layer](#uc-lay-004-update-layer)
  - [UC-LAY-005: Delete Layer](#uc-lay-005-delete-layer)
  - [UC-LAY-006: Deprecate Layer](#uc-lay-006-deprecate-layer)
- [Component Management](#component-management)
  - [UC-COMP-001: Create Component](#uc-comp-001-create-component)
  - [UC-COMP-002: List Components](#uc-comp-002-list-components)
  - [UC-COMP-003: Get Component Details](#uc-comp-003-get-component-details)
  - [UC-COMP-004: Update Component](#uc-comp-004-update-component)
  - [UC-COMP-005: Delete Component](#uc-comp-005-delete-component)
  - [UC-COMP-006: Deprecate Component](#uc-comp-006-deprecate-component)
  - [UC-COMP-007: Assign Component to Layers](#uc-comp-007-assign-component-to-layers)
  - [UC-COMP-008: View Component Use Cases](#uc-comp-008-view-component-use-cases)
  - [UC-COMP-009: View Component Stories](#uc-comp-009-view-component-stories)

---

## Layer Management

### UC-LAY-001: Create Layer

**Actor:** Project Manager, Architect

**Preconditions:**
- User is authenticated
- Project exists
- Layer name is unique within the project

**Main Flow:**
1. User navigates to Layers & Components page
2. User clicks "Add Layer" button
3. System displays layer creation form
4. User enters:
   - Name (required): e.g., "Frontend", "Backend API"
   - Description (optional): Purpose and scope of the layer
   - Tech Stack (optional): Technologies used (React, TypeScript, etc.)
   - Order Index (required): Display order in UI
   - Color (optional): Hex color for visualization
   - Icon (optional): Emoji or icon identifier
   - Status: Active (default) or Deprecated
5. User submits form
6. System validates inputs:
   - Project exists
   - Layer name is unique within project
   - Order index is a valid number
7. System creates layer in database
8. System broadcasts `layer:created` WebSocket event
9. System displays success message
10. System refreshes layer list

**Alternative Flows:**

**A1: Project Not Found**
- At step 6, if project doesn't exist
- System displays error: "Project not found"
- Use case ends

**A2: Duplicate Layer Name**
- At step 6, if layer name already exists in project
- System displays error: "Layer with name '[name]' already exists in this project"
- Use case returns to step 4

**Postconditions:**
- Layer is created and visible in project
- Layer can be assigned to components
- WebSocket event notifies all connected clients

**Implementation:**
- **API:** `POST /layers`
- **MCP Tool:** `create_layer`
- **Service:** `LayersService.create()`
- **WebSocket:** `layer:created` event

---

### UC-LAY-002: List Layers

**Actor:** Project Manager, Architect, Developer, BA

**Preconditions:**
- User is authenticated

**Main Flow:**
1. User navigates to Layers & Components page
2. System retrieves layers with filters (if any):
   - Project ID (optional)
   - Status (optional): active or deprecated
3. System orders layers by:
   - Primary: Order Index (ascending)
   - Secondary: Created Date (ascending)
4. For each layer, system includes:
   - Basic layer information
   - Usage counts:
     - Number of stories using this layer
     - Number of components in this layer
     - Number of use cases linked to this layer
     - Number of test cases linked to this layer
   - Associated project info
5. System displays layers in Architecture Overview

**Alternative Flows:**

**A1: Filter by Project**
- At step 2, user selects specific project
- System shows only layers for that project

**A2: Filter by Status**
- At step 2, user filters by status (active/deprecated)
- System shows only layers matching status

**A3: No Layers Found**
- At step 4, if no layers exist
- System displays empty state with "Create your first layer" prompt

**Postconditions:**
- User can view all layers with usage information
- User can drill down into layer details

**Implementation:**
- **API:** `GET /layers?projectId={id}&status={status}`
- **MCP Tool:** `list_layers`
- **Service:** `LayersService.findAll()`

---

### UC-LAY-003: Get Layer Details

**Actor:** Project Manager, Architect, Developer

**Preconditions:**
- User is authenticated
- Layer exists

**Main Flow:**
1. User clicks on layer in list or Architecture Overview
2. System retrieves layer with:
   - All basic information
   - Project details
   - All components in this layer with:
     - Component ID, name, icon, color
   - Usage counts:
     - Stories, components, use cases, test cases
3. System displays layer details panel
4. System shows list of components in this layer

**Alternative Flows:**

**A1: Layer Not Found**
- At step 2, if layer doesn't exist
- System displays error: "Layer not found"
- Use case ends

**Postconditions:**
- User can view complete layer information
- User can see which components belong to this layer
- User can navigate to component details

**Implementation:**
- **API:** `GET /layers/:id`
- **MCP Tool:** `get_layer`
- **Service:** `LayersService.findOne()`

---

### UC-LAY-004: Update Layer

**Actor:** Project Manager, Architect

**Preconditions:**
- User is authenticated
- Layer exists
- User has permission to modify layers

**Main Flow:**
1. User clicks "Edit" button on layer
2. System displays layer edit form with current values
3. User modifies fields:
   - Name
   - Description
   - Tech Stack
   - Order Index
   - Color
   - Icon
   - Status
4. User submits form
5. System validates inputs:
   - Layer exists
   - If name changed, new name is unique within project
6. System updates layer in database
7. System broadcasts `layer:updated` WebSocket event
8. System displays success message
9. System refreshes layer display

**Alternative Flows:**

**A1: Layer Not Found**
- At step 5, if layer doesn't exist
- System displays error: "Layer not found"
- Use case ends

**A2: Duplicate Layer Name**
- At step 5, if new layer name already exists in project
- System displays error: "Layer with name '[name]' already exists"
- Use case returns to step 3

**A3: Update Tech Stack**
- At step 3, user adds/removes technologies
- System updates tech stack array

**A4: Change Order Index**
- At step 3, user changes order index
- System updates display order
- Layer moves to new position in Architecture Overview

**Postconditions:**
- Layer is updated with new information
- All references to layer reflect changes
- WebSocket event notifies all connected clients
- Components using this layer see updated information

**Implementation:**
- **API:** `PATCH /layers/:id`
- **MCP Tool:** `update_layer`
- **Service:** `LayersService.update()`
- **WebSocket:** `layer:updated` event

---

### UC-LAY-005: Delete Layer

**Actor:** Project Manager, Architect

**Preconditions:**
- User is authenticated
- Layer exists
- Layer is not in use by any:
  - Stories (StoryLayer references)
  - Components (ComponentLayer references)
  - Use Cases
  - Test Cases

**Main Flow:**
1. User clicks "Delete" button on layer
2. System displays confirmation dialog:
   - "Are you sure you want to delete '[layer name]'?"
   - "This action cannot be undone."
3. User confirms deletion
4. System checks layer usage:
   - Count stories using this layer
   - Count components in this layer
   - Count use cases linked to this layer
   - Count test cases linked to this layer
5. System verifies total usage is 0
6. System deletes layer from database
7. System displays success message
8. System refreshes layer list

**Alternative Flows:**

**A1: Layer Not Found**
- At step 4, if layer doesn't exist
- System displays error: "Layer not found"
- Use case ends

**A2: Layer In Use**
- At step 5, if layer has any usage (stories, components, use cases, or test cases)
- System displays error message with details:
  - "Cannot delete layer '[name]' - it is used by:"
  - "X stories, Y components, Z use cases, W test cases"
  - "Consider deprecating instead."
- Use case returns to step 1
- **Suggested Next Action:** Use UC-LAY-006: Deprecate Layer

**A3: User Cancels**
- At step 3, user clicks "Cancel"
- System closes confirmation dialog
- Use case ends without changes

**Postconditions:**
- Layer is permanently deleted
- Layer no longer appears in any lists
- Layer cannot be assigned to new components

**Implementation:**
- **API:** `DELETE /layers/:id`
- **MCP Tool:** `delete_layer`
- **Service:** `LayersService.remove()`

**Business Rules:**
- Deletion is prevented if layer is used anywhere
- Users must deprecate or reassign all usages before deletion
- This prevents orphaned references and data integrity issues

---

### UC-LAY-006: Deprecate Layer

**Actor:** Project Manager, Architect

**Preconditions:**
- User is authenticated
- Layer exists
- Layer may be in use by stories, components, use cases, or test cases

**Main Flow:**
1. User clicks "Edit" button on layer
2. System displays layer edit form
3. User changes Status to "Deprecated"
4. User optionally adds deprecation note to Description
5. User submits form
6. System updates layer status to "deprecated"
7. System broadcasts `layer:updated` WebSocket event
8. System displays layer with deprecated status indicator
9. System shows deprecation warning when assigning to new components

**Postconditions:**
- Layer status is "deprecated"
- Existing usages remain functional
- Layer appears with deprecated indicator in UI
- Layer can still be viewed but discouraged for new usage
- Layer can be filtered out in lists (status filter)

**Rationale:**
- Preserves historical data and existing references
- Allows gradual migration to new layers
- Prevents new usage while maintaining existing functionality
- Better alternative to deletion when layer is in use

**Implementation:**
- **API:** `PATCH /layers/:id` with `status: "deprecated"`
- **MCP Tool:** `update_layer` with `status: "deprecated"`
- **Service:** `LayersService.update()`
- **WebSocket:** `layer:updated` event

---

## Component Management

### UC-COMP-001: Create Component

**Actor:** Project Manager, Architect, BA

**Preconditions:**
- User is authenticated
- Project exists
- Component name is unique within project
- If owner specified, owner user exists
- If layers specified, all layer IDs are valid

**Main Flow:**
1. User navigates to Layers & Components page
2. User clicks "Add Component" button
3. System displays component creation form
4. User enters:
   - Name (required): e.g., "Authentication", "Billing"
   - Description (optional): Purpose and scope
   - Owner (optional): User responsible for this component
   - File Patterns (optional): Patterns to match files to this component
     - `**/auth/**/*`
     - `**/*auth*.ts`
   - Layers (optional): Which layers this component spans
   - Color (optional): Hex color for visualization
   - Icon (optional): Emoji or icon identifier
   - Status: Active (default), Planning, or Deprecated
5. User submits form
6. System validates inputs:
   - Project exists
   - Component name is unique within project
   - If owner specified, owner user exists
   - If layers specified, all layer IDs are valid
7. System creates component in database
8. System creates ComponentLayer relationships
9. System broadcasts `component:created` WebSocket event
10. System displays success message
11. System refreshes component list

**Alternative Flows:**

**A1: Project Not Found**
- At step 6, if project doesn't exist
- System displays error: "Project not found"
- Use case ends

**A2: Duplicate Component Name**
- At step 6, if component name already exists in project
- System displays error: "Component with name '[name]' already exists"
- Use case returns to step 4

**A3: Invalid Owner**
- At step 6, if owner ID doesn't exist
- System displays error: "User not found"
- Use case returns to step 4

**A4: Invalid Layer IDs**
- At step 6, if any layer ID is invalid
- System displays error: "One or more layer IDs are invalid"
- Use case returns to step 4

**A5: Create Without Owner**
- At step 4, user doesn't specify owner
- System creates component without owner
- Component can be assigned owner later

**A6: Create Without Layers**
- At step 4, user doesn't select any layers
- System creates component without layer associations
- Component can be assigned to layers later

**Postconditions:**
- Component is created and visible in project
- Component can be assigned to stories and use cases
- If layers specified, component appears in those layers' component lists
- WebSocket event notifies all connected clients

**Implementation:**
- **API:** `POST /components`
- **MCP Tool:** `create_component`
- **Service:** `ComponentsService.create()`
- **WebSocket:** `component:created` event

---

### UC-COMP-002: List Components

**Actor:** Project Manager, Architect, Developer, BA

**Preconditions:**
- User is authenticated

**Main Flow:**
1. User navigates to Layers & Components page
2. System retrieves components with filters (if any):
   - Project ID (optional)
   - Status (optional): active, planning, or deprecated
   - Layer ID (optional): Components in specific layer
3. System orders components alphabetically by name
4. For each component, system includes:
   - Basic component information
   - Owner information (if assigned)
   - Layer associations with layer details
   - Usage counts:
     - Number of stories using this component
     - Number of use cases in this component
     - Number of test cases for this component
   - Project information
5. System displays components in grid or list view

**Alternative Flows:**

**A1: Filter by Project**
- At step 2, user selects specific project
- System shows only components for that project

**A2: Filter by Status**
- At step 2, user filters by status
- System shows only components matching status

**A3: Filter by Layer**
- At step 2, user views specific layer
- System shows only components in that layer

**A4: No Components Found**
- At step 4, if no components exist
- System displays empty state with "Create your first component" prompt

**Postconditions:**
- User can view all components with usage information
- User can filter and search components
- User can drill down into component details

**Implementation:**
- **API:** `GET /components?projectId={id}&status={status}&layerId={layerId}`
- **MCP Tool:** `list_components`
- **Service:** `ComponentsService.findAll()`

---

### UC-COMP-003: Get Component Details

**Actor:** Project Manager, Architect, Developer, BA

**Preconditions:**
- User is authenticated
- Component exists

**Main Flow:**
1. User clicks on component in list or Architecture Overview
2. System retrieves component with:
   - All basic information
   - Project details
   - Owner information (if assigned)
   - Layer associations with full layer details
   - Usage counts:
     - Stories, use cases, test cases
3. System displays component details panel
4. System shows:
   - Component metadata
   - File patterns for automatic matching
   - Associated layers
   - Usage statistics

**Alternative Flows:**

**A1: Component Not Found**
- At step 2, if component doesn't exist
- System displays error: "Component not found"
- Use case ends

**Postconditions:**
- User can view complete component information
- User can see which layers contain this component
- User can navigate to related stories or use cases

**Implementation:**
- **API:** `GET /components/:id`
- **MCP Tool:** `get_component`
- **Service:** `ComponentsService.findOne()`

---

### UC-COMP-004: Update Component

**Actor:** Project Manager, Architect

**Preconditions:**
- User is authenticated
- Component exists
- User has permission to modify components

**Main Flow:**
1. User clicks "Edit" button on component
2. System displays component edit form with current values
3. User modifies fields:
   - Name
   - Description
   - Owner
   - File Patterns
   - Layers (replaces all layer associations)
   - Color
   - Icon
   - Status
4. User submits form
5. System validates inputs:
   - Component exists
   - If name changed, new name is unique within project
   - If owner changed, new owner exists
   - If layers changed, all layer IDs are valid
6. If layers changed:
   - System deletes all existing ComponentLayer relationships
   - System creates new ComponentLayer relationships
7. System updates component in database
8. System broadcasts `component:updated` WebSocket event
9. System displays success message
10. System refreshes component display

**Alternative Flows:**

**A1: Component Not Found**
- At step 5, if component doesn't exist
- System displays error: "Component not found"
- Use case ends

**A2: Duplicate Component Name**
- At step 5, if new component name already exists
- System displays error: "Component with name '[name]' already exists"
- Use case returns to step 3

**A3: Invalid Owner**
- At step 5, if new owner doesn't exist
- System displays error: "User not found"
- Use case returns to step 3

**A4: Invalid Layer IDs**
- At step 5, if any layer ID is invalid
- System displays error: "One or more layer IDs are invalid"
- Use case returns to step 3

**A5: Update Without Changing Layers**
- At step 3, user doesn't modify layers field
- System updates other fields
- Existing layer associations remain unchanged

**A6: Add/Remove Layer Associations**
- At step 3, user selects/deselects layers
- At step 6, system updates ComponentLayer relationships
- Component appears in new layers' component lists
- Component removed from unchecked layers' lists

**Postconditions:**
- Component is updated with new information
- Layer associations reflect changes
- All references to component show updated information
- WebSocket event notifies all connected clients
- Stories and use cases using this component see updated information

**Implementation:**
- **API:** `PATCH /components/:id`
- **MCP Tool:** `update_component`
- **Service:** `ComponentsService.update()`
- **WebSocket:** `component:updated` event

**Important Note on Layer Updates:**
- When updating layers, system uses "delete all + create new" approach
- This ensures clean layer associations without orphaned records
- All previous ComponentLayer records are removed
- New ComponentLayer records are created for selected layers

---

### UC-COMP-005: Delete Component

**Actor:** Project Manager, Architect

**Preconditions:**
- User is authenticated
- Component exists
- Component is not in use by any:
  - Stories (StoryComponent references)
  - Use Cases
  - Test Cases

**Main Flow:**
1. User clicks "Delete" button on component
2. System displays confirmation dialog:
   - "Are you sure you want to delete '[component name]'?"
   - "This action cannot be undone."
3. User confirms deletion
4. System checks component usage:
   - Count stories using this component
   - Count use cases in this component
   - Count test cases for this component
5. System verifies total usage is 0
6. System deletes component from database
7. System cascades delete to ComponentLayer relationships
8. System displays success message
9. System refreshes component list

**Alternative Flows:**

**A1: Component Not Found**
- At step 4, if component doesn't exist
- System displays error: "Component not found"
- Use case ends

**A2: Component In Use**
- At step 5, if component has any usage
- System displays error message with details:
  - "Cannot delete component '[name]' - it is used by:"
  - "X stories, Y use cases, Z test cases"
  - "Consider deprecating instead."
- Use case returns to step 1
- **Suggested Next Action:** Use UC-COMP-006: Deprecate Component

**A3: User Cancels**
- At step 3, user clicks "Cancel"
- System closes confirmation dialog
- Use case ends without changes

**Postconditions:**
- Component is permanently deleted
- All ComponentLayer relationships are deleted (cascade)
- Component no longer appears in any lists
- Component cannot be assigned to new stories or use cases

**Implementation:**
- **API:** `DELETE /components/:id`
- **MCP Tool:** `delete_component`
- **Service:** `ComponentsService.remove()`

**Business Rules:**
- Deletion is prevented if component is used anywhere
- Users must deprecate or reassign all usages before deletion
- ComponentLayer relationships cascade delete automatically (database level)

---

### UC-COMP-006: Deprecate Component

**Actor:** Project Manager, Architect

**Preconditions:**
- User is authenticated
- Component exists
- Component may be in use by stories, use cases, or test cases

**Main Flow:**
1. User clicks "Edit" button on component
2. System displays component edit form
3. User changes Status to "Deprecated"
4. User optionally adds deprecation note to Description
5. User submits form
6. System updates component status to "deprecated"
7. System broadcasts `component:updated` WebSocket event
8. System displays component with deprecated status indicator
9. System shows deprecation warning when assigning to new stories

**Postconditions:**
- Component status is "deprecated"
- Existing usages remain functional
- Component appears with deprecated indicator in UI
- Component can still be viewed but discouraged for new usage
- Component can be filtered out in lists (status filter)

**Rationale:**
- Preserves historical data and existing references
- Allows gradual migration to new components
- Prevents new usage while maintaining existing functionality
- Better alternative to deletion when component is in use

**Implementation:**
- **API:** `PATCH /components/:id` with `status: "deprecated"`
- **MCP Tool:** `update_component` with `status: "deprecated"`
- **Service:** `ComponentsService.update()`
- **WebSocket:** `component:updated` event

---

### UC-COMP-007: Assign Component to Layers

**Actor:** Project Manager, Architect

**Preconditions:**
- User is authenticated
- Component exists
- All target layers exist in same project

**Main Flow:**
1. User clicks "Edit" button on component
2. System displays component edit form
3. System shows list of available layers for project
4. User selects/deselects layers (checkboxes)
5. User submits form
6. System validates all selected layer IDs exist
7. System deletes all existing ComponentLayer relationships for this component
8. System creates new ComponentLayer relationships for selected layers
9. System updates component in database
10. System broadcasts `component:updated` WebSocket event
11. System displays success message
12. System refreshes component display in Architecture Overview

**Alternative Flows:**

**A1: Invalid Layer IDs**
- At step 6, if any layer ID is invalid
- System displays error: "One or more layer IDs are invalid"
- Use case returns to step 4

**A2: Remove All Layer Associations**
- At step 4, user deselects all layers
- At step 7-8, system deletes all ComponentLayer relationships
- Component becomes unassigned to any layer

**A3: Component Spans Multiple Layers**
- At step 4, user selects multiple layers (e.g., Frontend + Backend API)
- System creates multiple ComponentLayer relationships
- Component appears in both layers' component lists
- This represents cross-cutting concerns (e.g., Authentication touches both frontend and backend)

**Postconditions:**
- Component's layer associations are updated
- Component appears in Architecture Overview under selected layers
- Component removed from unselected layers' lists
- All changes visible to other users via WebSocket

**Implementation:**
- **API:** `PATCH /components/:id` with `layerIds: [...]`
- **MCP Tool:** `update_component` with `layerIds` parameter
- **Service:** `ComponentsService.update()`
- **WebSocket:** `component:updated` event

**Database Behavior:**
- Old ComponentLayer records: Deleted
- New ComponentLayer records: Created
- Many-to-many relationship allows component in multiple layers

---

### UC-COMP-008: View Component Use Cases

**Actor:** BA, QA, Developer

**Preconditions:**
- User is authenticated
- Component exists

**Main Flow:**
1. User clicks on component name or "View Use Cases" button
2. System retrieves component with:
   - Basic component information
   - Owner information
   - Layer associations
   - All use cases for this component:
     - Use case ID, key, title, area
     - Number of test cases for each use case
     - Created and updated timestamps
3. System displays component overview with use case list
4. System shows:
   - Component metadata in header
   - Table of use cases sorted by key
   - Total count of use cases
   - Test case coverage per use case

**Alternative Flows:**

**A1: Component Not Found**
- At step 2, if component doesn't exist
- System displays error: "Component not found"
- Use case ends

**A2: No Use Cases**
- At step 3, if component has no use cases
- System displays empty state
- System suggests creating first use case for this component

**A3: Navigate to Use Case Details**
- At step 4, user clicks on use case
- System navigates to use case detail view
- Use case detail view shows full use case content

**Postconditions:**
- User can view all use cases for component
- User can assess test coverage per use case
- User can navigate to individual use cases
- Useful for BA analysis workflow

**Implementation:**
- **API:** `GET /components/:id/use-cases`
- **MCP Tool:** `get_component_use_cases`
- **Service:** `ComponentsService.findWithUseCases()`

**Use Case:**
- Supports BA workflow: "What use cases does this component need?"
- Supports QA workflow: "Which use cases need more test coverage?"
- Supports planning: "How much work is in this component?"

---

### UC-COMP-009: View Component Stories

**Actor:** Project Manager, Developer

**Preconditions:**
- User is authenticated
- Component exists

**Main Flow:**
1. User clicks on component or "View Stories" button
2. System retrieves component with:
   - Basic component information
   - Owner information
   - Layer associations
   - All stories linked to this component:
     - Story ID, key, title, type, status
     - Epic key and title (if story is in epic)
     - Assigned framework/agent name
     - Created and updated timestamps
3. System displays component overview with story list
4. System shows:
   - Component metadata in header
   - Table of stories sorted by status or created date
   - Total count of stories
   - Status distribution (backlog, in progress, done, etc.)

**Alternative Flows:**

**A1: Component Not Found**
- At step 2, if component doesn't exist
- System displays error: "Component not found"
- Use case ends

**A2: No Stories**
- At step 3, if component has no stories
- System displays empty state
- System suggests creating first story for this component

**A3: Navigate to Story Details**
- At step 4, user clicks on story
- System navigates to story detail view
- Story detail view shows full story information

**A4: Filter Stories by Status**
- At step 4, user applies status filter
- System shows only stories matching status
- Useful for seeing what's in progress vs. done

**Postconditions:**
- User can view all stories for component
- User can assess component development progress
- User can see which epics touch this component
- User can navigate to individual stories
- Useful for understanding component impact

**Implementation:**
- **API:** `GET /components/:id/stories`
- **MCP Tool:** `get_component_stories`
- **Service:** `ComponentsService.findWithStories()`

**Use Case:**
- Supports PM workflow: "What work is happening in this component?"
- Supports planning: "How much development is left in this area?"
- Supports impact analysis: "Which epics touch this component?"
- Supports agent assignment: "Which agents are working on this component?"

---

## Data Relationships and Cascading Behavior

### Database Schema Relationships

```
Project
  ├── Layer (cascade delete from Project)
  │   ├── ComponentLayer (cascade delete from Layer)
  │   ├── StoryLayer (cascade delete from Layer)
  │   ├── UseCase (set null on layer deletion)
  │   └── TestCase (set null on layer deletion)
  │
  └── Component (cascade delete from Project)
      ├── ComponentLayer (cascade delete from Component)
      ├── StoryComponent (cascade delete from Component)
      ├── UseCase (set null on component deletion)
      └── TestCase (set null on component deletion)
```

### Cascade Delete Behavior

**When Layer is Deleted:**
- ✅ ComponentLayer relationships: **Cascade Delete**
- ✅ StoryLayer relationships: **Cascade Delete**
- ❌ UseCases: **Set layerId to null** (use case survives)
- ❌ TestCases: **Set layerId to null** (test case survives)

**When Component is Deleted:**
- ✅ ComponentLayer relationships: **Cascade Delete**
- ✅ StoryComponent relationships: **Cascade Delete**
- ❌ UseCases: **Set componentId to null** (use case survives)
- ❌ TestCases: **Set componentId to null** (test case survives)

**Business Logic Protection:**
- Before deleting Layer: Check usage count, prevent if > 0
- Before deleting Component: Check usage count, prevent if > 0
- Safer approach: Deprecate instead of delete

### Update Behavior

**Layer Update:**
- Name change: Validated for uniqueness
- Other fields: Updated directly
- No cascade updates needed

**Component Update - Layer Assignment:**
- Current approach: **Delete all + Create new**
- Process:
  1. Delete all ComponentLayer records for this component
  2. Create new ComponentLayer records for selected layers
- Result: Clean layer associations, no orphaned records

---

## MCP Tools Reference

### Layer Tools

| Tool | Method | Description |
|------|--------|-------------|
| `create_layer` | `createLayer()` | Create new layer with validation |
| `list_layers` | `listLayers()` | List layers with optional filters |
| `get_layer` | `getLayer()` | Get single layer with components |
| `update_layer` | `updateLayer()` | Update layer with validation |
| `delete_layer` | `deleteLayer()` | Delete unused layer |

### Component Tools

| Tool | Method | Description |
|------|--------|-------------|
| `create_component` | `createComponent()` | Create component with layers |
| `list_components` | `listComponents()` | List components with filters |
| `get_component` | `getComponent()` | Get component details |
| `update_component` | `updateComponent()` | Update component and layers |
| `delete_component` | `deleteComponent()` | Delete unused component |
| `get_component_use_cases` | `getComponentUseCases()` | Get component with use cases |
| `get_component_stories` | `getComponentStories()` | Get component with stories |

---

## Best Practices

### Layer Management

1. **Naming Convention:**
   - Use descriptive names: "Presentation Layer", "Application Layer"
   - Avoid generic names like "frontend" when more specific name available

2. **Order Index:**
   - Assign logical order: 1=Frontend, 2=Backend, 3=Database, 4=Infrastructure
   - Leave gaps (10, 20, 30) for future insertion

3. **Tech Stack:**
   - Keep updated with actual technologies in use
   - Helps developers understand layer composition

4. **Deprecation:**
   - Always prefer deprecation over deletion
   - Add deprecation reason to description
   - Plan migration path before deprecating

### Component Management

1. **Naming Convention:**
   - Use business domain names: "Authentication", "User Management"
   - Avoid technical names: prefer "Payment Processing" over "Stripe Integration"

2. **File Patterns:**
   - Use glob patterns for automatic file matching
   - Examples: `**/auth/**/*`, `**/*auth*.ts`, `src/billing/**`
   - Helps code quality tools map metrics to components

3. **Layer Assignment:**
   - Assign components to all layers they touch
   - Example: "Authentication" spans both "Frontend" and "Backend API"
   - Reflects cross-cutting concerns

4. **Ownership:**
   - Assign clear ownership for accountability
   - Owner should be expert in that business domain
   - Can be changed as team composition changes

5. **Status Management:**
   - `active`: Currently maintained and recommended for use
   - `planning`: Design phase, not yet implemented
   - `deprecated`: Legacy, discouraged but still functional

### Code Quality Integration

**File Pattern Matching:**
- Components use `filePatterns` to match code files
- Code metrics service maps file paths to components
- Example patterns:
  ```
  **/auth/**/*          # All files in auth directories
  **/*auth*.ts          # All TypeScript files with 'auth' in name
  src/billing/**        # All files under src/billing
  ```

**Pattern Matching Logic (code-metrics.service.ts):**
1. Try exact component name match in file path
2. Try component name with variations (hyphens, no spaces)
3. Fall back to layer inference from path patterns
4. Default to "Unknown" if no match

---

## WebSocket Events

All create and update operations broadcast WebSocket events to notify connected clients in real-time:

### Layer Events

```typescript
// Layer created
{
  event: 'layer:created',
  data: {
    projectId: string,
    layer: LayerResponse
  }
}

// Layer updated
{
  event: 'layer:updated',
  data: {
    layerId: string,
    projectId: string,
    layer: LayerResponse
  }
}
```

### Component Events

```typescript
// Component created
{
  event: 'component:created',
  data: {
    projectId: string,
    component: ComponentResponse
  }
}

// Component updated
{
  event: 'component:updated',
  data: {
    componentId: string,
    projectId: string,
    component: ComponentResponse
  }
}
```

These events enable:
- Real-time UI updates across all connected clients
- Collaborative editing awareness
- Live dashboards and metrics
- Immediate reflection of changes in Architecture Overview

---

## Summary

This document describes all use cases for layer and component management in Vibe Studio. Layers provide technical architecture organization, while components provide business domain organization. Together, they create a comprehensive structure for project organization, code quality analysis, and development planning.

Key takeaways:
- **Layers**: Technical architecture (Frontend, Backend, Database, Infrastructure)
- **Components**: Business domains (Authentication, Billing, Project Management)
- **Many-to-Many**: Components can span multiple layers
- **Soft Delete**: Prefer deprecation over deletion
- **Cascade Protection**: Deletion prevented when entities are in use
- **Real-time Updates**: WebSocket events for live collaboration
