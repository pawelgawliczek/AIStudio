# UC-BA-005: Advanced Use Case Search and Management

## Overview
Comprehensive use case management with powerful search by layer/component, enabling BAs to efficiently find relevant use cases when analyzing new requirements.

**Key Requirement**: For bigger projects, proper use case management is critical. When BA starts working on new requirements/story/epic, they should pull all relevant use cases from the system. Search and use case management must be very good. Layers/components serve as helpers for this.

## Actor
Business Analyst, also available to PM, Architect, Developer

## Preconditions
- Project has defined layers and components
- Use case library exists with use cases tagged by component
- User is authenticated

## Main Flow

### Scenario: BA Analyzing New Story

1. BA is assigned story ST-42: "Implement password reset flow"
2. Story is tagged with components: "Authentication", "Email Service"
3. BA needs to find ALL relevant existing use cases

### Advanced Search Interface

4. BA navigates to Use Case Library or clicks "Find Relevant Use Cases" in story view
5. System displays **Advanced Use Case Search** with multiple search modes:

```
┌──────────────────────────────────────────────────────────────┐
│ USE CASE LIBRARY                                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Search Mode: [Component Filter ▼] [Semantic Search]  [Text] │
│                                                              │
│ ──────── FILTER BY COMPONENT ────────                       │
│                                                              │
│ Selected Components (from current story ST-42):             │
│ ☑ Authentication                [12 use cases]              │
│ ☑ Email Service                 [8 use cases]               │
│                                                              │
│ Add more components:                                         │
│ ☐ User Management               [15 use cases]              │
│ ☐ Billing                       [10 use cases]              │
│ ☐ Reporting                     [7 use cases]               │
│ ☐ Search                        [5 use cases]               │
│                                                              │
│ ──────── FILTER BY LAYER ────────                           │
│ ☑ Frontend                      [25 use cases]              │
│ ☑ Backend/API                   [42 use cases]              │
│ ☐ Database                      [18 use cases]              │
│ ☐ Integration                   [12 use cases]              │
│                                                              │
│ ──────── ADDITIONAL FILTERS ────────                        │
│ Status: [Active ▼]                                          │
│ Last Modified: [Anytime ▼]                                  │
│ Created By: [Anyone ▼]                                      │
│ Has Defects: [All ▼]                                        │
│                                                              │
│ [Apply Filters]  [Clear All]                                │
│                                                              │
│ ──────── RESULTS (18 use cases) ────────                    │
│                                                              │
│ Showing use cases for: Authentication ∩ Email Service       │
│ Sort by: [Relevance ▼] [Last Modified] [Title] [Defects]   │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ UC-AUTH-001: User Login                                 │ │
│ │ Component: Authentication | Layer: Backend, Frontend    │ │
│ │ Last Modified: Nov 5, 2025 | Version: 3                │ │
│ │ Linked Stories: 5 | Test Coverage: 92% ✓                │ │
│ │ Status: Active                                          │ │
│ │                                                         │ │
│ │ Summary: Users authenticate using email/password...    │ │
│ │                                                         │ │
│ │ [View Details] [Link to ST-42] [View History]          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ UC-AUTH-003: Password Reset Flow ⭐ HIGHLY RELEVANT     │ │
│ │ Component: Authentication, Email Service | Backend, FE  │ │
│ │ Last Modified: Oct 28, 2025 | Version: 2               │ │
│ │ Linked Stories: 3 | Test Coverage: 85% ✓                │ │
│ │ ⚠️ 1 open defect (Medium severity)                      │ │
│ │                                                         │ │
│ │ Summary: User requests password reset via email...     │ │
│ │                                                         │ │
│ │ [View Details] [✓ Already Linked] [View History]       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ UC-EMAIL-001: Email Notification System                 │ │
│ │ Component: Email Service | Layer: Integration          │ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Load More...]                                               │
│                                                              │
│ ──────── QUICK ACTIONS ────────                             │
│ [Link Selected to ST-42] [Create New Use Case] [Export]    │
└──────────────────────────────────────────────────────────────┘
```

### Component-Based Auto-Discovery

6. System automatically suggests use cases based on story components:
   - Story has components: Authentication, Email Service
   - System queries: `use_cases WHERE component_id IN (authentication_id, email_service_id)`
   - Returns 18 matching use cases
   - Highlights use cases matching BOTH components as "HIGHLY RELEVANT"

7. BA reviews results:
   - Sees UC-AUTH-003 is highly relevant (matches both components)
   - Sees it's already linked to story
   - Sees there's an open defect (important context!)
   - Views other 17 use cases quickly

### Semantic Search Mode

8. BA switches to "Semantic Search" tab
9. System shows natural language query interface:
   ```
   ──────── SEMANTIC SEARCH ────────

   Ask a question or describe what you're looking for:

   [What happens when a user forgets their password?          ]

   [Search]

   Results (ranked by similarity):

   1. UC-AUTH-003: Password Reset Flow        Similarity: 95%
      "User requests password reset via email. System sends
      reset link. User clicks link and sets new password..."

   2. UC-AUTH-007: Account Recovery          Similarity: 72%
      "When user loses access to account..."

   3. UC-EMAIL-001: Email Notification       Similarity: 68%
      "System sends emails for various events..."
   ```

10. Semantic search uses vector embeddings to find conceptually similar use cases even if keywords don't match exactly

### Hierarchical Component View

11. BA clicks "Component Tree View" tab
12. System displays hierarchical organization:
    ```
    📁 Components (8 total)

    📂 Authentication (12 use cases) ⬇️
    │  ├─ UC-AUTH-001: User Login
    │  ├─ UC-AUTH-002: User Logout
    │  ├─ UC-AUTH-003: Password Reset Flow ⭐
    │  ├─ UC-AUTH-004: Two-Factor Authentication
    │  ├─ UC-AUTH-005: Session Management
    │  └─ ... (7 more)
    │
    📂 Email Service (8 use cases) ⬇️
    │  ├─ UC-EMAIL-001: Email Notification System ⭐
    │  ├─ UC-EMAIL-002: Email Template Management
    │  └─ ... (6 more)
    │
    📂 User Management (15 use cases) ⬆️
    📂 Billing (10 use cases) ⬆️
    ...
    ```

13. BA can:
    - Expand/collapse components
    - See use case count per component
    - Quickly navigate component hierarchy
    - Multi-select use cases to link to story

### Use Case Detail View

14. BA clicks "View Details" on UC-AUTH-003
15. System shows comprehensive use case view:
    ```
    ┌──────────────────────────────────────────────────────────┐
    │ UC-AUTH-003: Password Reset Flow                     [✕] │
    ├──────────────────────────────────────────────────────────┤
    │                                                          │
    │ Component: Authentication, Email Service                 │
    │ Layer: Backend/API, Frontend                            │
    │ Status: Active | Version: 2 (Nov 5, 2025)              │
    │                                                          │
    │ ──────── DESCRIPTION ────────                           │
    │ Primary Actor: End User                                 │
    │ Scope: Password recovery for authenticated users        │
    │                                                          │
    │ Preconditions:                                          │
    │ • User has registered account with verified email       │
    │ • User is not currently logged in                       │
    │                                                          │
    │ Main Success Scenario:                                  │
    │ 1. User clicks "Forgot Password" link                   │
    │ 2. System displays password reset request form          │
    │ 3. User enters email address                            │
    │ 4. System validates email exists                        │
    │ 5. System generates unique reset token                  │
    │ 6. System sends reset email with link                   │
    │ 7. User clicks link in email                            │
    │ 8. System validates token (not expired)                 │
    │ 9. System displays new password form                    │
    │ 10. User enters new password (twice)                    │
    │ 11. System validates password strength                  │
    │ 12. System updates password                             │
    │ 13. System displays success message                     │
    │                                                          │
    │ Alternative Flows:                                      │
    │ 4a. Email not found: Display generic success (security) │
    │ 8a. Token expired: Display error, offer resend          │
    │ 11a. Password too weak: Display requirements            │
    │                                                          │
    │ Postconditions:                                         │
    │ • User password is updated                              │
    │ • Reset token is invalidated                            │
    │ • Audit log records password change                     │
    │                                                          │
    │ ──────── BUSINESS RULES ────────                        │
    │ • Reset token expires after 1 hour                      │
    │ • Token is single-use only                              │
    │ • Password must meet strength requirements              │
    │ • Email response time: < 2 minutes                      │
    │                                                          │
    │ ──────── LINKED STORIES (3) ────────                    │
    │ • ST-12: Initial password reset implementation          │
    │ • ST-35: Add token expiration                           │
    │ • ST-42: Current story (new implementation)             │
    │                                                          │
    │ ──────── TEST COVERAGE ────────                         │
    │ Overall Coverage: 85%  [View Details]                   │
    │                                                          │
    │ ✓ Unit Tests:        12 tests | 92% coverage           │
    │   - test_reset_token_generation                         │
    │   - test_reset_email_sent                               │
    │   - test_token_validation                               │
    │   - ... (9 more)                                        │
    │                                                          │
    │ ✓ Integration Tests: 5 tests  | 78% coverage           │
    │   - test_reset_flow_end_to_end                          │
    │   - test_expired_token_handling                         │
    │   - ... (3 more)                                        │
    │                                                          │
    │ ✓ E2E Tests:         2 tests  | 100% coverage          │
    │   - test_complete_password_reset_flow                   │
    │   - test_invalid_token_flow                             │
    │                                                          │
    │ ⚠️ Coverage Gaps:                                        │
    │ • Concurrent reset requests not tested                  │
    │ • Rate limiting not covered                             │
    │                                              [Add Tests] │
    │                                                          │
    │ ──────── DEFECTS (1 open) ────────                      │
    │ ⚠️ DEFECT-42 (Medium): Reset email sometimes delayed    │
    │    Opened: Nov 8 | Assigned: Dev Team                   │
    │                                              [View]      │
    │                                                          │
    │ ──────── IMPACTED FILES ────────                        │
    │ Backend:                                                │
    │ • src/auth/password-reset.ts                            │
    │ • src/email/reset-email.ts                              │
    │ Frontend:                                               │
    │ • src/pages/reset-password.tsx                          │
    │                                                          │
    │ ──────── VERSION HISTORY ────────                       │
    │ v2 (Nov 5, 2025) - Added token expiration [View Diff]  │
    │ v1 (Oct 1, 2025) - Initial version                     │
    │                                                          │
    │ ────────────────────────────────────────────────────    │
    │ [✓ Link to ST-42] [Edit] [Create New Version] [Export] │
    └──────────────────────────────────────────────────────────┘
    ```

### Batch Linking to Story

16. BA selects multiple relevant use cases (checkboxes)
17. Clicks "Link Selected to ST-42"
18. System calls MCP: `link_use_cases_to_story({ story_id, use_case_ids })`
19. Use cases are linked
20. BA can now see in story detail:
    ```
    Story ST-42

    Linked Use Cases (5):
    • UC-AUTH-003: Password Reset Flow
    • UC-EMAIL-001: Email Notification System
    • UC-AUTH-001: User Login (dependency)
    • ...
    ```

## Postconditions
- BA has found all relevant use cases efficiently
- Use cases are linked to story
- BA has complete context for analysis
- Test coverage visibility enables quality planning

## Business Rules
- Use cases must be tagged with at least one component
- Search results ranked by:
  1. Component match relevance (matches both > matches one)
  2. Semantic similarity (if semantic search)
  3. Last modified date
  4. Number of linked stories (popularity)
- Deprecated use cases appear only if explicitly filtered
- Only active use cases linkable to new stories

## Data Model

**use_cases table** (updated):
```sql
CREATE TABLE use_cases (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  key TEXT UNIQUE, -- UC-AUTH-003
  title TEXT NOT NULL,
  component_id UUID REFERENCES components NOT NULL, -- REQUIRED
  layer_id UUID REFERENCES layers,

  -- Content
  summary TEXT,
  primary_actor TEXT,
  scope TEXT,
  preconditions TEXT,
  main_scenario TEXT,
  alternative_flows TEXT,
  postconditions TEXT,
  business_rules TEXT,

  -- Metadata
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  parent_use_case_id UUID REFERENCES use_cases, -- for versioning
  created_by UUID REFERENCES users,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,

  -- Search optimization
  search_vector tsvector, -- for full-text search
  embedding vector(1536) -- for semantic search
);

CREATE INDEX idx_use_cases_component ON use_cases(component_id);
CREATE INDEX idx_use_cases_layer ON use_cases(layer_id);
CREATE INDEX idx_use_cases_search ON use_cases USING GIN(search_vector);
CREATE INDEX idx_use_cases_embedding ON use_cases USING ivfflat(embedding vector_cosine_ops);
```

**story_use_case_links table**:
```sql
CREATE TABLE story_use_case_links (
  story_id UUID REFERENCES stories,
  use_case_id UUID REFERENCES use_cases,
  relationship_type TEXT, -- 'implements', 'modifies', 'deprecates', 'depends_on'
  linked_at TIMESTAMPTZ,
  linked_by UUID REFERENCES users,
  PRIMARY KEY (story_id, use_case_id)
);
```

## MCP Tools

**Tool: `search_use_cases`** (critical for BA workflow):
```typescript
{
  name: "search_use_cases",
  parameters: {
    project_id: string,

    // Component-based search
    component_ids?: string[], // filter by components
    layer_ids?: string[],

    // Text search
    query?: string, // full-text search

    // Semantic search
    semantic_query?: string, // natural language query

    // Filters
    status?: "active" | "deprecated",
    created_by?: string,
    has_defects?: boolean,
    min_test_coverage?: number,

    // Pagination
    limit?: number,
    offset?: number
  },
  returns: {
    use_cases: UseCase[],
    total_count: number,
    search_metadata: {
      component_match_scores?: Record<string, number>,
      semantic_scores?: Record<string, number>
    }
  }
}
```

**Tool: `get_use_case_with_coverage`**:
```typescript
{
  name: "get_use_case_with_coverage",
  parameters: {
    use_case_id: string
  },
  returns: {
    use_case: UseCase,
    test_coverage: {
      unit_tests: TestCase[],
      integration_tests: TestCase[],
      e2e_tests: TestCase[],
      overall_coverage: number,
      coverage_by_level: {
        unit: number,
        integration: number,
        e2e: number
      },
      coverage_gaps: string[]
    },
    linked_stories: Story[],
    defects: Defect[],
    impacted_files: string[]
  }
}
```

## Technical Implementation

### Semantic Search
- Use case content → embeddings (OpenAI ada-002 or open-source)
- Query → embedding
- Cosine similarity search (pgvector extension in PostgreSQL)
- Cache embeddings (regenerate only on use case update)

### Full-Text Search
- PostgreSQL full-text search (tsvector)
- Weighted: title (A) > summary (B) > content (C)
- Support stemming and synonyms

### Search Ranking Algorithm
```typescript
score =
  0.5 * component_match_score +  // exact component match
  0.3 * semantic_similarity +     // semantic relevance
  0.1 * recency_score +          // recently modified
  0.1 * popularity_score         // often linked
```

## Related Use Cases
- UC-ADMIN-003: Manage Layers and Components (defines structure)
- UC-BA-001: Analyze Story Requirements (uses this search)
- UC-BA-002: Create Use Case (creates searchable use cases)
- UC-QA-003: Manage Test Cases (test coverage data)

## Acceptance Criteria
- ✓ Component-based filtering finds all relevant use cases
- ✓ Semantic search works with natural language queries
- ✓ Search results ranked by relevance
- ✓ Use cases matching multiple components highlighted
- ✓ Component tree view enables browsing
- ✓ Test coverage displayed per use case (unit/integration/E2E levels)
- ✓ Defects linked to use cases are visible
- ✓ Batch linking works correctly
- ✓ Search performance < 500ms for 10,000 use cases
- ✓ BA can find relevant use cases in < 30 seconds
- ✓ Use case detail view shows all required information
- ✓ Coverage gaps are identified and actionable
