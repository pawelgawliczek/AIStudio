# PM Estimation Workflow Addition

## Summary

Added initial estimation step where the Coordinator (acting as PM) estimates complexity before executing any components. BA and Architect then refine these estimates after their analysis.

---

## Changes Made

### 1. Workflow Flow Update

**Before**:
```
Story assigned → Classify → Execute components
```

**After**:
```
Story assigned → PM Estimates → Classify → Execute components → Agents Refine Estimates
```

---

### 2. PM Initial Estimation (ALWAYS FIRST)

Coordinator performs three estimates before any component execution:

#### A. Business Complexity (1-10)
Saved to: `Story.businessComplexity`

**Scale**:
- **1-3**: Simple CRUD, basic UI
  - Single entity operations
  - No validation rules
  - Straightforward user flow

- **4-6**: Multiple workflows, validation rules
  - Multi-step processes
  - Business rules validation
  - State transitions

- **7-10**: Complex business logic, multiple systems
  - Multiple entities coordination
  - Complex business rules
  - External system integration

#### B. Technical Complexity (1-10)
Saved to: `Story.technicalComplexity`

**Scale**:
- **1-3**: Single file, no DB changes
  - One component/service modification
  - No schema changes
  - No new APIs

- **4-6**: Multiple files, minor DB changes
  - 2-5 files modified
  - Add columns to existing tables
  - 1-2 new API endpoints

- **7-10**: Architecture changes, major DB schema
  - New microservices/modules
  - New database tables
  - Major API redesign
  - Performance optimization needed

#### C. Estimated Token Cost
Saved to: `Story.estimatedTokenCost`

**Scale**:
- **50K-100K**: Trivial changes
- **100K-200K**: Simple changes
- **200K-400K**: Medium features
- **400K-700K**: Complex features
- **700K-1M+**: Critical system changes

---

### 3. Workflow Classification Algorithm

Based on PM estimates, Coordinator decides workflow:

```typescript
if (businessComplexity <= 3 && technicalComplexity <= 3) {
  // Trivial: Full-stack only
  workflow = ['Full-Stack'];
  estimatedDuration = '5-10 minutes';

} else if (businessComplexity <= 5 && technicalComplexity <= 5) {
  // Simple: Full-stack + Architect spot-check
  workflow = ['Full-Stack', 'Architect'];
  estimatedDuration = '20-30 minutes';

} else if (businessComplexity <= 7 || technicalComplexity <= 7) {
  // Medium: Full workflow without DevOps
  workflow = ['Explore', 'BA', 'Designer', 'Architect', 'Full-Stack', 'QA'];
  estimatedDuration = '1-2 hours';

} else if (businessComplexity > 7 || technicalComplexity > 7) {
  // Complex: Full workflow with DevOps
  workflow = ['Explore', 'BA', 'Designer', 'Architect', 'Full-Stack', 'QA', 'DevOps'];
  estimatedDuration = '2-4 hours';
}

// Override for critical systems
if (storyAffects(['DB schema', 'Metrics', 'Core system'])) {
  workflow = [...workflow, 'Validation'];
  estimatedDuration = '3-5 hours';
}
```

---

### 4. BA Refinement of Business Complexity

After BA completes requirements analysis, they refine the business complexity estimate.

**BA Output Addition**:
```markdown
## Business Complexity Assessment
After analysis, refine the business complexity estimate (1-10):
- Original PM estimate: 5
- Refined estimate: 7
- Justification: Discovered additional validation rules and edge cases that weren't apparent from initial story description. Multiple state transitions required.
```

**Updated via MCP**:
- `update_story` with refined `businessComplexity`
- Coordinator may adjust remaining workflow if estimate changed significantly

---

### 5. Architect Refinement of Technical Complexity

After Architect completes design, they refine the technical complexity estimate.

**Architect Output Addition**:
```markdown
## Technical Complexity Assessment
After architecture analysis, refine the technical complexity estimate (1-10):
- Original PM estimate: 6
- Refined estimate: 8
- Justification: Requires new database table, 3 new API endpoints, and Redis caching layer
- DB schema changes: Yes (1 new table, 2 modified tables)
- API endpoints: 3 new
- New services: 1 (caching service)
- External integrations: 0
```

**Updated via MCP**:
- `update_story` with refined `technicalComplexity`
- Coordinator may add DevOps if complexity increased significantly

---

### 6. Adaptive Workflow Adjustment

**Scenario**: PM estimates Medium, but BA/Architect refine to Complex

```
Initial: BC=5, TC=6 → Medium workflow (no DevOps)

After BA: BC=8 (refined)
After Architect: TC=8 (refined)

Coordinator decision:
- Both estimates now > 7
- Reclassify to Complex workflow
- Add DevOps component to execution plan
```

---

## Updated Workflow Execution

```
1. Story assigned to workflow
   └─> Coordinator receives trigger

2. Coordinator retrieves story
   └─> get_story, get_project, start_workflow_run

3. PM ESTIMATION (NEW STEP)
   ├─> Analyze story title & description
   ├─> Estimate businessComplexity (1-10)
   ├─> Estimate technicalComplexity (1-10)
   ├─> Estimate estimatedTokenCost (tokens)
   └─> update_story with all 3 estimates

4. Classify workflow
   └─> Based on BC and TC estimates

5. Execute components
   ├─> Explore (if Medium+)
   ├─> BA executes
   │   └─> Refines businessComplexity
   ├─> Designer executes
   ├─> Architect executes
   │   └─> Refines technicalComplexity
   ├─> Coordinator checks refined estimates
   │   └─> Adjust workflow if needed
   ├─> Full-stack executes
   ├─> QA executes (if Medium+)
   └─> DevOps executes (if Complex+)

6. Complete workflow
   └─> Compare estimated vs actual metrics
```

---

## Benefits

### 1. Better Resource Planning
- Know upfront which components needed
- Estimate duration and cost accurately
- Can prioritize stories by estimated effort

### 2. Adaptive Workflow
- Start with PM's best guess
- Refine as experts analyze
- Adjust workflow dynamically

### 3. Metrics & Learning
- Track estimation accuracy
- PM learns from BA/Architect refinements
- Improve future estimates

### 4. Transparency
- User sees estimates upfront
- Refinements are documented
- Clear reasoning for complexity changes

### 5. Cost Control
- Estimate token usage before execution
- Can decide if story is worth the cost
- Budget management

---

## Example Flow

**Story**: "Add user profile export feature"

**PM Initial Estimate** (Coordinator):
```
businessComplexity: 5
  Reason: Multi-step process (select format, generate, download)

technicalComplexity: 6
  Reason: New API endpoint, file generation, S3 storage

estimatedTokenCost: 300000
  Reason: Medium complexity, full workflow

Classification: Medium
Workflow: Explore → BA → Designer → Architect → Full-Stack → QA
```

**BA Refinement**:
```
businessComplexity: 6 (increased from 5)
  Reason: Discovered GDPR compliance requirements, data filtering rules,
  and audit logging needs. More complex than initially thought.
```

**Architect Refinement**:
```
technicalComplexity: 7 (increased from 6)
  Reason: Requires new database table for export jobs, Redis queue for
  background processing, new worker service, and 4 API endpoints (not 1).
  Also need pagination for large exports.
```

**Coordinator Decision**:
```
Original: Medium (BC=5, TC=6)
Refined: Complex (BC=6, TC=7)
Action: Continue with current workflow (already includes QA)
Note: No workflow change needed as BC and TC still within Medium/Complex threshold
```

---

## Database Fields Used

All three fields already exist in Story model:
- ✅ `businessComplexity` (Int?)
- ✅ `technicalComplexity` (Int?)
- ✅ `estimatedTokenCost` (Int?)

No schema changes needed!

---

## MCP Tools Usage

**Coordinator**:
- `update_story` - Save initial estimates (BC, TC, token cost)
- `update_story` - Monitor refined estimates from components

**BA**:
- `get_story` - Read initial businessComplexity estimate
- `update_story` - Save refined businessComplexity

**Architect**:
- `get_story` - Read initial technicalComplexity estimate
- `update_story` - Save refined technicalComplexity

---

## Files Updated

- ✅ `/opt/stack/AIStudio/AISTUDIO_WORKFLOW_DESIGN.md`
  - Added PM estimation step to Coordinator instructions
  - Updated BA output to include complexity refinement
  - Updated Architect output to include complexity refinement
  - Updated workflow execution flow
  - Updated task classification with estimation scales

- ✅ `/opt/stack/AIStudio/PM_ESTIMATION_WORKFLOW.md` (this file)

---

## Next Steps

1. **Implement Coordinator** with estimation logic
2. **Test estimation algorithm** with sample stories
3. **Train PM model** on estimation patterns
4. **Add UI** to display estimates and refinements
5. **Track accuracy** of estimates over time
6. **Refine scales** based on actual data

---

## Estimation Guidelines for PM/Coordinator

### Business Complexity Quick Guide

**Ask these questions**:
- How many entities involved? (1=low, 3+=high)
- How many validation rules? (0-2=low, 5+=high)
- How many user roles affected? (1=low, 3+=high)
- How many state transitions? (0-1=low, 4+=high)
- External systems involved? (0=low, 2+=high)

**Sum the complexity**: More "high" answers = higher BC

### Technical Complexity Quick Guide

**Ask these questions**:
- Files to modify? (1=low, 5+=high)
- New database tables? (0=low, 2+=high)
- Schema migrations? (no=low, yes=high)
- New API endpoints? (0-1=low, 4+=high)
- New services/workers? (0=low, 2+=high)
- Performance critical? (no=low, yes=high)

**Sum the complexity**: More "high" answers = higher TC

### Token Cost Quick Guide

**Base estimate**: 100K tokens

**Add for each**:
- +50K: Each component beyond Full-stack
- +100K: If Designer involved (UI/UX work)
- +100K: If complex business logic
- +150K: If major architecture changes

**Examples**:
- Trivial (Full-stack only): 50K-100K
- Simple (Full-stack + Architect): 100K-200K
- Medium (6 components): 250K-400K
- Complex (7 components + complex logic): 500K-700K
- Critical (8 components + major changes): 800K-1M+
