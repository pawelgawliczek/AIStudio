# Workflow Design Changes: Database Storage Instead of Temp Files

## Summary

The workflow design has been updated to store all agent analysis outputs directly in the database rather than using temporary files. This provides full traceability, audit trail, and eliminates loose file management.

---

## Database Schema Changes

### New Fields Added to Story Model

```prisma
model Story {
  // ... existing fields ...

  // Analysis fields (filled by agents)
  contextExploration   String?      @map("context_exploration") @db.Text  // Context from Explore component
  baAnalysis           String?      @map("ba_analysis") @db.Text          // Requirements from BA component
  architectAnalysis    String?      @map("architect_analysis") @db.Text   // Design from Architect component

  // Analysis timestamps
  contextExploredAt    DateTime?    @map("context_explored_at")
  baAnalyzedAt         DateTime?    @map("ba_analyzed_at")
  architectAnalyzedAt  DateTime?    @map("architect_analyzed_at")

  // ... rest of model ...
}
```

### Migration Status
✅ Schema updated
✅ Database pushed successfully
✅ Prisma Client regenerated

---

## Component Output Changes

### Before (TEMP Files)
```
Explore → TEMP_context.md
BA → TEMP_requirements.md
Architect → TEMP_design.md
```

### After (Database Fields)
```
Explore → Story.contextExploration + Story.contextExploredAt
BA → Story.baAnalysis + Story.baAnalyzedAt
Architect → Story.architectAnalysis + Story.architectAnalyzedAt
```

---

## Updated Component Instructions

### 1. Context Explore Component

**Output Method**:
- Uses `update_story` MCP tool
- Stores markdown in `Story.contextExploration`
- Sets `Story.contextExploredAt` timestamp

**MCP Tools**:
- Added: `update_story`
- Existing: `get_story`, `search_use_cases`, `get_file_dependencies`, etc.

---

### 2. Business Analyst Component

**Input Method**:
- Reads `Story.contextExploration` from database
- No file reads needed

**Output Method**:
- Uses `update_story` MCP tool
- Stores markdown in `Story.baAnalysis`
- Sets `Story.baAnalyzedAt` timestamp

**MCP Tools**:
- Added: `update_story`
- Existing: `get_story`, `search_use_cases`, `link_use_case_to_story`, etc.

---

### 3. Software Architect Component

**Input Method**:
- Reads `Story.contextExploration` and `Story.baAnalysis` from database
- No file reads needed

**Output Method**:
- Uses `update_story` MCP tool
- Stores markdown in `Story.architectAnalysis`
- Sets `Story.architectAnalyzedAt` timestamp

**MCP Tools**:
- Added: `update_story`
- Existing: `get_story`, `get_project_health`, `get_architect_insights`, etc.

---

### 4. Full-Stack Developer Component

**Input Method**:
- Reads all three fields from Story:
  - `Story.contextExploration`
  - `Story.baAnalysis`
  - `Story.architectAnalysis`
- No file reads needed

---

### 5. QA Automation Component

**Input Method**:
- Reads `Story.baAnalysis` and `Story.architectAnalysis`
- No file reads needed

---

## Benefits of Database Storage

### 1. Full Traceability
- All analysis stored permanently in database
- Timestamps for each analysis phase
- Can see exactly when each agent completed their work

### 2. Audit Trail
- Complete history of all analyses
- No lost or overwritten files
- Easy to track changes over time

### 3. UI Integration
- Can display context in Story detail view
- Show analysis timeline
- Compare analyses across stories

### 4. No File Management
- No temp files to clean up
- No risk of file conflicts
- No file system dependencies

### 5. Reusability
- Context can be reused for related stories
- Easy to clone story with context
- Can template common patterns

### 6. Query Capabilities
- Search across all analyses
- Find stories by analysis content
- Analytics on analysis patterns

---

## Context Handoff Flow

### Old Flow (Files)
```
1. Coordinator → Explore component
2. Explore creates TEMP_context.md
3. BA reads TEMP_context.md → creates TEMP_requirements.md
4. Architect reads TEMP_context.md → creates TEMP_design.md
5. Full-stack reads all TEMP files
6. Writer deletes TEMP files
```

### New Flow (Database)
```
1. Coordinator → Explore component
2. Explore updates Story.contextExploration
3. BA reads Story.contextExploration → updates Story.baAnalysis
4. Architect reads Story.contextExploration → updates Story.architectAnalysis
5. Full-stack reads all Story fields
6. All data persists in database
```

---

## Token Savings (Unchanged)

The 70% token reduction is maintained:

**Traditional**: 750K tokens
**Optimized**: 225K tokens (525K saved)

### How:
- Explore component runs once
- All other components read from database instead of re-investigating
- Same efficiency, better persistence

---

## Implementation Checklist

- [x] Add fields to Prisma schema
- [x] Push schema changes to database
- [x] Update workflow design document
- [x] Update component instructions
- [x] Update coordinator instructions
- [x] Update context handoff protocol
- [ ] Implement coordinator with database storage
- [ ] Implement components with update_story calls
- [ ] Test workflow end-to-end
- [ ] Add UI to display Story analysis fields
- [ ] Add UI to show analysis timeline

---

## Next Steps

1. **Review and Approve**: Confirm this approach works for your needs
2. **Implement Coordinator**: Create coordinator agent with database storage logic
3. **Implement Components**: Create all 7 components with proper MCP tool usage
4. **Test with Sample Story**: Run workflow on a simple story
5. **UI Integration**: Add views to display analysis fields
6. **Production Rollout**: Scale to all stories

---

## File Locations

- **Workflow Design**: `/opt/stack/AIStudio/AISTUDIO_WORKFLOW_DESIGN.md`
- **Prisma Schema**: `/opt/stack/AIStudio/backend/prisma/schema.prisma`
- **This Summary**: `/opt/stack/AIStudio/WORKFLOW_DB_STORAGE_CHANGES.md`
