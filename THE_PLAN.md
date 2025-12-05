# ST-173: Transcript Viewer Integration - Implementation Plan

**Story:** ST-173 - Transcript Viewer Integration
**Epic:** Workflow Execution Monitoring
**Priority:** High
**Status:** Phase 6 Complete (Backend) → Phase 7 Implementation (Frontend UI)

---

## Overview

This story implements a comprehensive transcript viewer that allows users to view both master (orchestrator) and agent (component) transcripts from Claude Code sessions. The system stores transcripts as artifacts and provides a rich UI for viewing conversation history, tool calls, and execution details.

**Scope for This Run:** Phase 7 ONLY - Frontend UI Components and Integration

**Previous Run Completed:**
- ✅ Phase 1: Database schema (migration)
- ✅ Phase 2: Backend service layer (TranscriptsService)
- ✅ Phase 3: Backend API endpoints (TranscriptsController)
- ✅ Phase 4: Frontend API client (transcripts.service.ts)
- ✅ Phase 5: Frontend parsing utilities (transcript-parser.ts)
- ✅ Phase 6: Security review and validations

---

## Phase 7: Frontend UI Components

**Goal:** Create modal components for viewing transcripts with proper Material-UI patterns, React hooks, and security measures.

### 7.1 Component: TranscriptViewerModal

**Purpose:** Main modal for displaying transcript content with tabs and conversation flow

**Location:** `frontend/src/components/workflow-viz/TranscriptViewerModal.tsx`

**Design Pattern Reference:** `ArtifactViewerModal.tsx` (lines 59-350)

**Key Features:**
1. **Modal Structure** (matching ArtifactViewerModal pattern):
   - Dialog with DialogTitle, DialogContent, DialogActions
   - maxWidth="lg", fullWidth
   - PaperProps with height: '80vh'
   - Close button in header

2. **Header Section:**
   - Transcript metadata (type: master/agent, session ID, model)
   - Status chips (transcript type badge)
   - Close button
   - Metadata row: size, created date, component name (for agent transcripts)

3. **Tab System** (Material-UI Tabs):
   - Tab 1: "Conversation" - Parsed, human-readable view
   - Tab 2: "Raw JSONL" - Raw transcript file (LAZY LOADED for security)

4. **Conversation Tab Content:**
   - Scrollable container with dark background (grey.900)
   - Renders list of TranscriptTurn components
   - Auto-scroll to bottom for live feeds (future)
   - Empty state: "No conversation data available"

5. **Raw JSONL Tab Content:**
   - ⚠️ CRITICAL: Lazy loading to prevent XSS attacks
   - Size warning if >1MB: "Large file warning"
   - Monospace pre-formatted display
   - Syntax highlighting (optional enhancement)

6. **Footer Actions:**
   - Copy button (copies parsed conversation text)
   - Download button (downloads raw JSONL file)
   - Close button

**React Hooks:**
- `useState` for: activeTab, isLoadingContent, copied status
- `useEffect` for: lazy loading raw JSONL when tab switches
- `useCallback` for: handleCopy, handleDownload

**Props Interface:**
```typescript
interface TranscriptViewerModalProps {
  open: boolean;
  transcriptId: string | null;
  transcriptType: 'master' | 'agent';
  projectId: string;
  runId: string;
  onClose: () => void;
}
```

**State Management:**
```typescript
const [activeTab, setActiveTab] = useState(0);
const [parsedTranscript, setParsedTranscript] = useState<ParsedTranscript | null>(null);
const [rawContent, setRawContent] = useState<string | null>(null);
const [isLoadingRaw, setIsLoadingRaw] = useState(false);
const [copied, setCopied] = useState(false);
```

**Security Measures:**
1. Lazy load raw JSONL only when tab is opened
2. Size warnings for large files (>1MB)
3. Use transcript-parser.ts for sanitization
4. DOMPurify integration via parser

---

### 7.2 Component: TranscriptTurn

**Purpose:** Individual conversation turn display (user/assistant/system message)

**Location:** `frontend/src/components/workflow-viz/TranscriptTurn.tsx`

**Design Pattern Reference:** StateBlock phases (StateBlock.tsx lines 240-254 for phase boxes)

**Key Features:**
1. **Turn Layout:**
   - User messages: Right-aligned, blue background
   - Assistant messages: Left-aligned, grey background
   - System messages: Full-width, yellow/warning background

2. **Turn Header:**
   - Icon: 👤 (user), 🤖 (assistant), ⚙️ (system)
   - Role label
   - Timestamp (formatted: "2:45 PM" or "5m ago")
   - Token usage badge (if available)

3. **Turn Content:**
   - Message text (sanitized via parser)
   - Pre-formatted code blocks with proper wrapping
   - Tool calls section (expandable, uses ToolCallCard)
   - Tool results section (expandable)

4. **Expandable Sections:**
   - "Show X tool calls" button → expands to show ToolCallCard list
   - "Show X results" button → expands inline

**Props Interface:**
```typescript
interface TranscriptTurnProps {
  turn: ConversationTurn;
  index: number;
}
```

**Styling Pattern (from StateBlock):**
- Use theme-aware classes: `bg-gray-50 dark:bg-gray-800/50`
- Border radius: `rounded-lg`
- Padding: `p-3`
- Transitions: `transition-colors duration-200`

---

### 7.3 Component: ToolCallCard

**Purpose:** Display individual tool call with collapsible input parameters

**Location:** `frontend/src/components/workflow-viz/ToolCallCard.tsx`

**Design Pattern Reference:** Collapsible cards pattern from StateBlock phases

**Key Features:**
1. **Card Structure:**
   - Tool name badge (color-coded by category)
   - Collapse/expand icon (▶/▼)
   - Execution status icon (⏱ pending, ✓ complete, ✕ error)

2. **Collapsed View:**
   - Tool name
   - Parameter count: "3 parameters"
   - Status badge

3. **Expanded View:**
   - Full tool name and description
   - Input parameters (JSON formatted, syntax highlighted)
   - Copy parameters button
   - Execution time (if available)

4. **Tool Categories** (color coding):
   - Read operations: blue (Grep, Glob, Read)
   - Write operations: green (Edit, Write)
   - Execute operations: orange (Bash, NotebookEdit)
   - MCP tools: purple (mcp__vibestudio__*, mcp__playwright__*)

**Props Interface:**
```typescript
interface ToolCallCardProps {
  toolCall: ToolCall;
  toolResult?: ToolResult;
  isExpanded?: boolean;
  onToggle?: () => void;
}
```

**State:**
```typescript
const [isExpanded, setIsExpanded] = useState(false);
const [copiedParams, setCopiedParams] = useState(false);
```

---

## Integration Points

### 7.4 Integration: StateBlock.tsx

**Modifications Needed:** ✅ Already Implemented (lines 260-318)

The StateBlock component already has the correct integration:
- Props: `transcriptId`, `onViewTranscript` callback
- Agent phase box (lines 260-324) is clickable
- Shows "📜 View Transcript" button for completed/failed states (lines 307-317)
- Calls `onViewTranscript(transcriptId)` when clicked

**No changes required** - pattern already matches TranscriptViewerModal expectations.

---

### 7.5 Integration: WorkflowExecutionMonitor.tsx

**Modifications Needed:** Replace placeholder modal (lines 727-763) with TranscriptViewerModal

**Current Code (lines 727-763):**
```typescript
{/* Transcript Modal */}
<Dialog
  open={transcriptModalOpen}
  onClose={() => setTranscriptModalOpen(false)}
  maxWidth="lg"
  fullWidth
>
  <DialogTitle>Agent Transcript</DialogTitle>
  <DialogContent>
    {/* Placeholder */}
  </DialogContent>
</Dialog>
```

**Replacement:**
```typescript
{/* Transcript Viewer Modal */}
<TranscriptViewerModal
  open={transcriptModalOpen}
  transcriptId={selectedTranscriptId}
  transcriptType="agent" // Could be dynamically determined
  projectId={projectId}
  runId={runId || ''}
  onClose={() => {
    setTranscriptModalOpen(false);
    setSelectedTranscriptId('');
  }}
/>
```

**Import Addition:**
```typescript
import { TranscriptViewerModal } from '../components/workflow-viz/TranscriptViewerModal';
```

---

## Security Review

**Reviewer:** Security Architect
**Date:** 2025-12-05
**Scope:** Frontend transcript display and XSS prevention

### Critical Security Requirements

#### Test Case 5: XSS Prevention in Transcripts

**Attack Vector:** Malicious JSONL with embedded scripts
```json
{"type":"text","content":"<script>alert('xss')</script>"}
{"type":"text","content":"<img src=x onerror=alert('xss')>"}
```

**Defense Layers:**

1. **Parser Layer** (transcript-parser.ts lines 286-314):
   - DOMPurify sanitization with ALLOWED_TAGS: [] (strip ALL HTML)
   - HTML entity escaping for safe display
   - Content length limits (10KB per record)
   - Prototype pollution protection

2. **Display Layer** (TranscriptViewerModal):
   - Use `dangerouslySetInnerHTML` NEVER
   - Use `<pre>` with escaped content
   - Material-UI Typography with `whiteSpace: 'pre-wrap'`

3. **Raw JSONL Tab:**
   - Lazy loading (CRITICAL)
   - Size warnings (>1MB)
   - Display in `<pre>` with monospace, no HTML rendering

#### Quota Enforcement (Backend)

Already implemented in backend (transcripts.service.ts lines 29-31):
- 10MB per workflow run
- 100MB per project
- Enforced before artifact upload

#### Sensitive Data Redaction (Backend)

Already implemented in backend (transcripts.service.ts lines 34-53):
- API keys (OpenAI, Anthropic, AWS)
- JWTs
- Email addresses
- Passwords and secrets

**Frontend Responsibility:** Display redacted content as-is, no additional processing needed.

---

### Security Verdict

✅ **APPROVED** - Subject to implementation following security patterns:

1. ✅ Parser uses DOMPurify with strict sanitization
2. ✅ Raw JSONL tab uses lazy loading
3. ✅ No `dangerouslySetInnerHTML` in any component
4. ✅ Backend handles quota and redaction (frontend displays only)

**Conditional Requirements:**
- TranscriptViewerModal MUST lazy load raw JSONL tab
- TranscriptTurn MUST use escaped content from parser
- ToolCallCard MUST escape JSON parameter display

---

## Architecture Review - Phase 7

**Reviewed by:** Architect
**Date:** 2025-12-05
**Scope:** Phase 7 UI Components Only
**Verdict:** ✅ APPROVED with Recommendations

### Component Architecture

| Component | Pattern Reference | Status | Notes |
|-----------|------------------|--------|-------|
| TranscriptViewerModal | ArtifactViewerModal.tsx | ✅ APPROVED | Excellent pattern match - modal structure, tabs, lazy loading, actions footer |
| TranscriptTurn | StateBlock phase boxes | ✅ APPROVED | Good use of theme-aware classes, collapsible sections, icon patterns |
| ToolCallCard | StateBlock collapsible pattern | ✅ APPROVED | Consistent with existing collapsible UI elements |

### Integration Points Validated

- [x] StateBlock.tsx props extension matches existing patterns (already implemented)
- [x] WorkflowExecutionMonitor.tsx button placement appropriate (lines 307-317 in StateBlock)
- [x] API service integration follows existing patterns (transcripts.service.ts matches artifact service)
- [x] TypeScript interfaces properly defined (ConversationTurn, ToolCall, etc.)

### Performance Considerations

- [x] Lazy loading implemented for Raw JSONL tab (CRITICAL security requirement)
- [x] Size warnings for large transcripts (>1MB threshold)
- [x] Proper React.memo() usage recommended for TranscriptTurn (list rendering optimization)
- [x] useCallback/useMemo for expensive operations (transcript parsing cached in state)

### Code Quality Checklist

- [x] Follows existing Material-UI theme usage (Dialog, Tabs, Typography, Chip patterns)
- [x] Proper error boundary handling (inherited from parent Dialog component)
- [x] Accessibility (ARIA labels, keyboard navigation via MUI defaults)
- [x] Consistent naming conventions (camelCase, descriptive prop names)

### Required Changes

**None - Architecture is sound. Proceed with implementation.**

### Recommendations (Non-Blocking)

1. **Performance Enhancement:**
   - Wrap TranscriptTurn in React.memo() for list rendering optimization
   - Use virtualization (react-window) if transcript has >100 turns

2. **UX Enhancements:**
   - Add search/filter for long transcripts (future enhancement)
   - Syntax highlighting for Raw JSONL tab (use react-syntax-highlighter)
   - Auto-scroll to latest message for live feeds

3. **Testing:**
   - Unit tests for transcript-parser.ts (XSS attack vectors)
   - Integration tests for TranscriptViewerModal (lazy loading behavior)
   - E2E tests for full workflow execution → transcript viewing flow

---

## Implementation Checklist

### Phase 7: Frontend UI Components

- [ ] **7.1** Create TranscriptViewerModal.tsx
  - [ ] Modal structure with tabs
  - [ ] Lazy loading for Raw JSONL tab
  - [ ] Copy and download actions
  - [ ] Error handling and loading states

- [ ] **7.2** Create TranscriptTurn.tsx
  - [ ] User/assistant/system message layouts
  - [ ] Timestamp formatting
  - [ ] Token usage display
  - [ ] Expandable tool calls section

- [ ] **7.3** Create ToolCallCard.tsx
  - [ ] Collapsible card structure
  - [ ] Tool category color coding
  - [ ] JSON parameter formatting
  - [ ] Copy parameters button

- [ ] **7.4** Update WorkflowExecutionMonitor.tsx
  - [ ] Import TranscriptViewerModal
  - [ ] Replace placeholder transcript modal (lines 727-763)
  - [ ] Wire up state management (transcriptId, transcriptType)

- [ ] **7.5** Update StateBlock.tsx (if needed)
  - [x] Already implemented - no changes required
  - [x] Verify callback signature matches TranscriptViewerModal

### Testing

- [ ] Manual testing: View master transcript from workflow run
- [ ] Manual testing: View agent transcript from completed state
- [ ] Manual testing: Large transcript lazy loading (>1MB)
- [ ] Manual testing: XSS attack vector (script injection in transcript)
- [ ] Manual testing: Copy and download functionality
- [ ] Visual regression: Dark/light theme switching

---

## Approval

**Status:** ✅ APPROVED FOR IMPLEMENTATION
**Next State:** Human Approval → Implementation

**Approval Conditions:**
1. Follow ArtifactViewerModal.tsx patterns exactly
2. Implement lazy loading for Raw JSONL tab (security requirement)
3. Use transcript-parser.ts for all content sanitization
4. No `dangerouslySetInnerHTML` in any component

**Implementation Order:**
1. ToolCallCard.tsx (smallest component, no dependencies)
2. TranscriptTurn.tsx (uses ToolCallCard)
3. TranscriptViewerModal.tsx (uses TranscriptTurn)
4. Update WorkflowExecutionMonitor.tsx (wires everything together)

---

## Notes for Implementer

### Key Design Decisions

1. **Why separate TranscriptTurn component?**
   - Reusability across different views (modal, live feed, history)
   - Performance optimization via React.memo()
   - Clear separation of concerns (turn layout vs. modal container)

2. **Why lazy load Raw JSONL tab?**
   - Security: Prevents XSS from auto-executing in background
   - Performance: Large files (1MB+) don't block initial render
   - UX: Users rarely need raw JSONL, so don't pay the cost upfront

3. **Why use existing ArtifactViewerModal pattern?**
   - Consistency: Users already familiar with artifact viewer
   - Tested: ArtifactViewerModal has proven UX patterns
   - Maintainability: Similar components easier to maintain

### Common Pitfalls to Avoid

1. ❌ Don't use `dangerouslySetInnerHTML` - Always use escaped text
2. ❌ Don't load raw JSONL eagerly - Use lazy loading on tab switch
3. ❌ Don't forget dark mode classes - Use `dark:` prefix for all colors
4. ❌ Don't skip size warnings - Large transcripts can crash browser

### Success Criteria

✅ Can view master transcript from workflow run page
✅ Can view agent transcript from StateBlock
✅ Raw JSONL tab loads only when clicked
✅ Copy and download buttons work
✅ No XSS vulnerabilities in transcript display
✅ Dark/light theme both work correctly

---

**End of Plan**
