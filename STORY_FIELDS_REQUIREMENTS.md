# Story Fields Requirements

Based on analysis of UC-PM-003 (Create Story) and the current database schema, this document outlines the required fields for Story/Item creation.

## Current Implementation Status

### ✅ Currently Implemented in Database (schema.prisma)

The `Story` model currently has:

```prisma
model Story {
  id                   String       @id @default(uuid_generate_v4())
  projectId            String       // Required
  epicId               String?      // Optional - stories can exist without epics
  key                  String       // Auto-generated, e.g., ST-1
  type                 StoryType    // feature, bug, tech_debt, spike
  title                String       // Required
  description          String?      // Optional
  status               StoryStatus  // Default: planning
  businessImpact       Int?         // 1-5, set by PM
  businessComplexity   Int?         // 1-5, filled by BA agent
  technicalComplexity  Int?         // 1-5, filled by Architect agent
  estimatedTokenCost   Int?         // Filled by PM agent
  assignedFrameworkId  String?      // Which agentic framework
  createdById          String       // Required
  createdAt            DateTime
  updatedAt            DateTime
}
```

### ❌ Missing from Current Implementation

According to UC-PM-003, these fields are **REQUIRED** but missing:

1. **Layers** (multi-select, at least one required for non-draft stories)
   - Frontend, Backend, Database, Infrastructure, etc.
   - Currently only exists at `Subtask` level, not `Story` level
   - **ACTION REQUIRED**: Add `StoryLayer` junction table

2. **Components** (multi-select, at least one required for non-draft stories)
   - Authentication, Billing, Reporting, etc.
   - Currently only exists at `Subtask` level, not `Story` level
   - **ACTION REQUIRED**: Add `StoryComponent` junction table

3. **BA Analysis** (rich text, filled by BA agent during analysis phase)
   - Detailed business analysis from BA agent
   - **ACTION REQUIRED**: Add `baAnalysis` text field to Story model

4. **Architect Analysis** (rich text, filled by Architect agent during architecture phase)
   - Technical architecture analysis from Architect agent
   - **ACTION REQUIRED**: Add `architectAnalysis` text field to Story model

5. **Design Documents** (file uploads)
   - Wireframes, diagrams, etc.
   - **ACTION REQUIRED**: Add `StoryDocument` table

6. **Owner/Assignee** (human or agent)
   - Currently there's `assignedFrameworkId` but no direct assignee
   - **ACTION REQUIRED**: Clarify if this is needed separately from framework

## Story Creation Form Structure

Per UC-PM-003, the form should have **4 tabs**:

### Tab 1: Basic Info ✅ (Mostly Implemented)
- [x] Story key (auto-generated)
- [x] Type (feature, bug, tech_debt, spike)
- [x] Title (required)
- [x] Description (rich text with markdown)
- [x] Epic (optional)
- [x] Status (defaults to "planning")

### Tab 2: Organization ❌ (NOT Implemented)
- [ ] **Layers** (multi-select, required for non-draft)
  - Options: Frontend, Backend, Database, Infrastructure, Testing, Other
  - At least one must be selected
- [ ] **Components** (multi-select, required for non-draft)
  - Dynamic list based on project
  - Auto-suggestion based on title/description keywords
  - At least one must be selected

### Tab 3: Complexity ✅ (Implemented)
- [x] Business Impact (1-5, set by PM)
- [x] Business Complexity (1-5, filled by BA agent) - `businessComplexity`
- [x] Technical Complexity (1-5, filled by Architect agent) - `technicalComplexity`
- [x] Estimated Token Cost (filled by PM agent) - `estimatedTokenCost`

### Tab 4: Analysis & Design ❌ (NOT Implemented)
- [ ] **BA Analysis** (rich text, filled by BA agent)
- [ ] **Architect Analysis** (rich text, filled by Architect agent)
- [ ] **Design Documents** (file upload area)

### Tab 5: Assignment ⚠️ (Partially Implemented)
- [x] Framework assignment (`assignedFrameworkId`)
- [ ] Owner (human or agent) - needs clarification

## Frontend Implementation Status

### Current CreateStoryModal Fields:
```typescript
{
  title: string;           // ✅
  description: string;     // ✅
  type: StoryType;         // ✅
  epicId?: string;         // ✅
  technicalComplexity?: number;  // ✅
  businessImpact?: number;        // ✅
}
```

### Missing from CreateStoryModal:
- ❌ Layers (multi-select)
- ❌ Components (multi-select)
- ❌ businessComplexity field (though it's in DB, for BA agent)
- ❌ estimatedTokenCost field (though it's in DB, for PM agent)
- ❌ assignedFrameworkId
- ❌ BA Analysis field
- ❌ Architect Analysis field
- ❌ Design Documents upload

## Database Migration Required

```prisma
// Add to schema.prisma

model StoryLayer {
  storyId  String    @map("story_id") @db.Uuid
  layer    LayerType
  createdAt DateTime @default(now()) @map("created_at")

  story Story @relation(fields: [storyId], references: [id], onDelete: Cascade)

  @@id([storyId, layer])
  @@map("story_layers")
}

model StoryComponent {
  storyId     String   @map("story_id") @db.Uuid
  componentId String   @map("component_id") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at")

  story     Story     @relation(fields: [storyId], references: [id], onDelete: Cascade)
  component Component @relation(fields: [componentId], references: [id], onDelete: Cascade)

  @@id([storyId, componentId])
  @@map("story_components")
}

model Component {
  id          String            @id @default(uuid_generate_v4()) @db.Uuid
  projectId   String            @map("project_id") @db.Uuid
  name        String
  description String?
  createdAt   DateTime          @default(now()) @map("created_at")

  project       Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  storyComponents StoryComponent[]

  @@unique([projectId, name])
  @@map("components")
}

model StoryDocument {
  id          String   @id @default(uuid_generate_v4()) @db.Uuid
  storyId     String   @map("story_id") @db.Uuid
  fileName    String   @map("file_name")
  filePath    String   @map("file_path")
  fileType    String   @map("file_type")  // e.g., "wireframe", "diagram", "spec"
  uploadedBy  String   @map("uploaded_by") @db.Uuid
  uploadedAt  DateTime @default(now()) @map("uploaded_at")

  story      Story @relation(fields: [storyId], references: [id], onDelete: Cascade)
  uploader   User  @relation(fields: [uploadedBy], references: [id])

  @@map("story_documents")
}

// Add to Story model
model Story {
  // ... existing fields ...
  baAnalysis         String?  @map("ba_analysis")  // Rich text from BA agent
  architectAnalysis  String?  @map("architect_analysis")  // Rich text from Architect agent

  // Add relations
  layers       StoryLayer[]
  components   StoryComponent[]
  documents    StoryDocument[]
}
```

## Validation Rules

### For Draft Stories:
- Only `title` and `projectId` are required
- All other fields optional

### For Non-Draft Stories (status != "draft"):
- `title` (required)
- `description` (required)
- `layers` (at least one required)
- `components` (at least one required)
- `businessImpact` (required, set by PM)

### Status-Specific Requirements:
- **"planning"**: requires layers + components
- **"analysis"**: requires `businessComplexity` (filled by BA)
- **"architecture"**: requires `technicalComplexity` (filled by Architect)
- **"implementation"**: requires all complexity fields + framework assignment

## Auto-Suggestion Logic

When PM enters title/description:
- Scan for keywords related to components (e.g., "password" → Authentication, "payment" → Billing)
- Suggest relevant components automatically
- PM can accept, modify, or ignore suggestions

## Recommended Implementation Approach

### Phase 1: Essential Organization Fields (HIGH PRIORITY)
1. Add `StoryLayer` and `StoryComponent` tables to database
2. Add `Component` management to admin area
3. Update CreateStoryModal to include:
   - Layers multi-select (required)
   - Components multi-select (required)
   - Auto-suggestion for components

### Phase 2: Agent Analysis Fields (MEDIUM PRIORITY)
1. Add `baAnalysis` and `architectAnalysis` text fields to Story model
2. Create "Analysis" tab in story detail view (read-only for PM, writable by agents)
3. Update BA and Architect agents to populate these fields

### Phase 3: Design Documents (LOWER PRIORITY)
1. Add `StoryDocument` table
2. Implement file upload functionality
3. Add document viewer/manager to story detail view

### Phase 4: Enhanced Complexity UI (POLISH)
1. Split complexity fields into separate tab
2. Clearly indicate which agent fills which field
3. Add read-only indicators for agent-populated fields

## Summary

**Immediate Actions Required:**
1. ❌ Add Layers and Components to Story model (junction tables)
2. ❌ Update CreateStoryModal to collect Layers and Components
3. ❌ Add validation for required fields based on story status
4. ❌ Add BA Analysis and Architect Analysis fields
5. ⚠️ Consider implementing tabbed form structure as per UC-PM-003

**Current Status:**
- Basic fields (title, description, type, epic): ✅ Implemented
- Complexity fields: ✅ Partially implemented (missing BA/Architect input UI)
- Organization fields (layers, components): ❌ Not implemented at Story level
- Analysis fields (BA/Architect): ❌ Not implemented
- Design documents: ❌ Not implemented
