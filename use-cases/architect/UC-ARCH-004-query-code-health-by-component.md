# UC-ARCH-004: Query Code Health by Layer/Component with Drill-Down

## Overview
Architect can quickly query code health metrics for specific layers/components during story planning to make informed decisions about refactoring needs, technical risks, and implementation approach.

**Key Requirement**: Architect should have the possibility to ask about layer/component code health KPIs with drill-down to files and functions if needed. For instance, if code touches API component, Architect asks about that component's health and decides if more granular checking is needed to recommend rework.

## Actor
Architect (human or agent)

## Preconditions
- Project exists with defined layers and components
- Code quality metrics are being collected by background workers
- Story being analyzed has component tags

## Main Flow

### Scenario: Architect Planning Story that Touches API Component

1. Architect is reviewing story ST-42: "Add rate limiting to password reset endpoint"
2. Story is tagged with:
   - Layer: Backend/API
   - Component: Authentication
3. Architect wants to assess code health before planning implementation

### Quick Health Query (MCP Tool or Web UI)

4. Architect asks (via Claude Code or Web UI):
   ```
   "What is the code health of the Authentication component?"
   ```

5. System calls MCP tool: `get_component_health({ component_id: "authentication" })`

6. System returns component-level health summary:
   ```
   ┌──────────────────────────────────────────────────────────────┐
   │ AUTHENTICATION COMPONENT - CODE HEALTH SUMMARY               │
   ├──────────────────────────────────────────────────────────────┤
   │                                                              │
   │ Overall Health Score: 72/100  ███████░░░  ⚠️ MODERATE      │
   │                                                              │
   │ ──────── KEY METRICS ────────                               │
   │                                                              │
   │ Code Complexity:       High  ⚠️                             │
   │ • Average Complexity:  8.5 (threshold: 10)                  │
   │ • Max Complexity:      24 (src/auth/password-reset.ts)      │
   │                                                              │
   │ Test Coverage:         78%  ███████░░░  ⚠️                  │
   │ • Unit Tests:          85%                                  │
   │ • Integration Tests:   70%                                  │
   │ • E2E Tests:          80%                                   │
   │                                                              │
   │ Code Churn (30 days):  High  ⚠️                             │
   │ • Files Modified:      12 files                             │
   │ • Change Frequency:    3.2 changes/file                     │
   │                                                              │
   │ Technical Debt:        Moderate  ⚠️                         │
   │ • Code Smells:         8 issues                             │
   │ • Duplication:         12%                                  │
   │ • Maintainability:     C rating                             │
   │                                                              │
   │ ──────── HOTSPOTS (3) ────────                              │
   │                                                              │
   │ 🔥 src/auth/password-reset.ts                               │
   │    Complexity: 24 | Churn: High | Coverage: 65%             │
   │    Risk Score: 89/100  ⚠️ HIGH RISK                         │
   │    [View Details]                                           │
   │                                                              │
   │ 🔥 src/auth/session-manager.ts                              │
   │    Complexity: 18 | Churn: Medium | Coverage: 72%           │
   │    Risk Score: 67/100  ⚠️ MODERATE RISK                     │
   │    [View Details]                                           │
   │                                                              │
   │ 🔥 src/auth/token-validator.ts                              │
   │    Complexity: 15 | Churn: High | Coverage: 80%             │
   │    Risk Score: 58/100  ⚠️ MODERATE RISK                     │
   │    [View Details]                                           │
   │                                                              │
   │ ──────── RECOMMENDATIONS ────────                           │
   │                                                              │
   │ ⚠️  High complexity in password-reset.ts may cause issues   │
   │ 💡 Consider refactoring before adding rate limiting         │
   │ 💡 Increase test coverage for password-reset.ts to 80%+     │
   │ 📋 Review session-manager.ts for potential simplification   │
   │                                                              │
   │ ────────────────────────────────────────────────────────    │
   │ [Drill Down] [View Files] [Create Refactor Story]          │
   └──────────────────────────────────────────────────────────────┘
   ```

### Decision Point: Architect Evaluates Health

7. Architect reviews summary:
   - Authentication component has moderate health (72/100)
   - Password-reset.ts is a HIGH RISK hotspot (complexity 24, low coverage)
   - Story will touch this exact file!

8. Architect decides: **Need more granular details on password-reset.ts**

### Drill-Down to File Level

9. Architect clicks "[View Details]" on password-reset.ts or asks:
   ```
   "Show me detailed metrics for password-reset.ts"
   ```

10. System calls MCP: `get_file_health({ file_path: "src/auth/password-reset.ts" })`

11. System returns file-level details:
    ```
    ┌──────────────────────────────────────────────────────────────┐
    │ FILE: src/auth/password-reset.ts                             │
    ├──────────────────────────────────────────────────────────────┤
    │                                                              │
    │ Risk Score: 89/100  🔥 HIGH RISK                            │
    │ Lines of Code: 342                                          │
    │ Last Modified: 3 days ago (ST-38)                           │
    │                                                              │
    │ ──────── COMPLEXITY ANALYSIS ────────                       │
    │                                                              │
    │ Cyclomatic Complexity: 24  ⚠️ VERY HIGH (max: 10)          │
    │ Cognitive Complexity:  32  ⚠️ VERY HIGH                     │
    │ Maintainability Index: 42  ⚠️ LOW (target: >65)             │
    │                                                              │
    │ Functions by Complexity:                                    │
    │ ┌────────────────────────────────────────────────────────┐  │
    │ │ handlePasswordReset()      Complexity: 18  🔥 HIGH     │  │
    │ │ validateResetToken()       Complexity: 12  ⚠️ MEDIUM   │  │
    │ │ generateResetLink()        Complexity: 8   ✓ OK        │  │
    │ │ sendResetEmail()           Complexity: 6   ✓ OK        │  │
    │ └────────────────────────────────────────────────────────┘  │
    │                                                              │
    │ ──────── TEST COVERAGE ────────                             │
    │                                                              │
    │ Overall Coverage: 65%  ██████░░░░  ⚠️ BELOW TARGET (80%)   │
    │                                                              │
    │ Function Coverage:                                          │
    │ • handlePasswordReset()    45%  ⚠️ CRITICAL GAP            │
    │ • validateResetToken()     80%  ✓                          │
    │ • generateResetLink()      90%  ✓                          │
    │ • sendResetEmail()         75%  ⚠️                          │
    │                                                              │
    │ Uncovered Branches: 12                                      │
    │ Critical Paths Untested: 3                                  │
    │                                                              │
    │ ──────── CODE CHURN (30 days) ────────                      │
    │                                                              │
    │ Modifications: 8 times (by 3 different stories)             │
    │ Lines Changed: 145 lines (+82, -63)                         │
    │ Churn Rate: 42% (high churn indicates instability)          │
    │                                                              │
    │ Recent Changes:                                             │
    │ • ST-38: Added token expiration logic                       │
    │ • ST-35: Fixed email template bug                           │
    │ • ST-31: Updated validation rules                           │
    │                                                              │
    │ ──────── CODE QUALITY ISSUES ────────                       │
    │                                                              │
    │ 🔴 Critical (2):                                            │
    │ • Security: Hardcoded secret in line 145                    │
    │ • Bug Risk: Unchecked null pointer in line 203              │
    │                                                              │
    │ ⚠️  Major (3):                                               │
    │ • Duplication: 15 lines duplicated in session-manager.ts    │
    │ • Code Smell: Function too long (handlePasswordReset)       │
    │ • Performance: Inefficient loop in line 178                 │
    │                                                              │
    │ ──────── DEPENDENCIES ────────                              │
    │                                                              │
    │ Imported by: 5 files                                        │
    │ Imports: 12 modules                                         │
    │ Coupling Score: High  ⚠️                                    │
    │                                                              │
    │ ──────── RECOMMENDATIONS ────────                           │
    │                                                              │
    │ 🚨 CRITICAL: Fix security issue (hardcoded secret)          │
    │ 🚨 CRITICAL: Add null check at line 203                     │
    │ 💡 Refactor handlePasswordReset() - too complex             │
    │ 💡 Increase test coverage to 80%+ before changes            │
    │ 💡 Extract duplicated logic to shared utility               │
    │                                                              │
    │ Estimated Refactor Effort: Medium (2-3 days)                │
    │ Risk if Modified Without Refactor: HIGH                     │
    │                                                              │
    │ ────────────────────────────────────────────────────────    │
    │ [View Function Details] [View Source] [Create Refactor Story]│
    └──────────────────────────────────────────────────────────────┘
    ```

### Further Drill-Down to Function Level

12. Architect wants even more detail on `handlePasswordReset()` function
13. Architect clicks "[View Function Details]" or asks:
    ```
    "Show me the complexity breakdown of handlePasswordReset function"
    ```

14. System calls MCP: `get_function_metrics({ file_path, function_name })`

15. System returns function-level details:
    ```
    ┌──────────────────────────────────────────────────────────────┐
    │ FUNCTION: handlePasswordReset()                              │
    │ File: src/auth/password-reset.ts:45-128                      │
    ├──────────────────────────────────────────────────────────────┤
    │                                                              │
    │ Cyclomatic Complexity: 18  🔥 VERY HIGH                     │
    │ Cognitive Complexity:  24  🔥 VERY HIGH                      │
    │ Lines of Code: 83                                           │
    │ Parameters: 3                                               │
    │                                                              │
    │ ──────── COMPLEXITY CONTRIBUTORS ────────                   │
    │                                                              │
    │ Conditional Branches: 12                                    │
    │ • if statements: 8                                          │
    │ • switch cases: 2                                           │
    │ • ternary operators: 2                                      │
    │                                                              │
    │ Loops: 3                                                    │
    │ • for loops: 2                                              │
    │ • while loops: 1                                            │
    │                                                              │
    │ Try-Catch Blocks: 4                                         │
    │ Nested Depth: 5 levels  ⚠️ TOO DEEP                         │
    │                                                              │
    │ ──────── CODE STRUCTURE ────────                            │
    │                                                              │
    │ Lines 45-65:   Token validation (complexity: 6)             │
    │ Lines 66-85:   Email existence check (complexity: 4)        │
    │ Lines 86-108:  Token generation & storage (complexity: 5)   │
    │ Lines 109-128: Email sending logic (complexity: 3)          │
    │                                                              │
    │ ──────── TEST COVERAGE ────────                             │
    │                                                              │
    │ Coverage: 45%  ████░░░░░░░  ⚠️ CRITICAL                     │
    │                                                              │
    │ Covered Paths: 6 of 18 paths                                │
    │ Untested Scenarios:                                         │
    │ • Token expiration edge cases                               │
    │ • Email service failure handling                            │
    │ • Concurrent reset request handling                         │
    │ • Database connection failures                              │
    │                                                              │
    │ ──────── REFACTORING SUGGESTIONS ────────                   │
    │                                                              │
    │ 💡 Extract Method: Token validation logic (lines 45-65)     │
    │    Target complexity: 6 → 2                                 │
    │                                                              │
    │ 💡 Extract Method: Email sending (lines 109-128)            │
    │    Target complexity: 3 → 1                                 │
    │                                                              │
    │ 💡 Simplify Nested Conditionals: Reduce nesting from 5 to 3 │
    │                                                              │
    │ 💡 Apply Guard Clauses: Early returns for validation        │
    │                                                              │
    │ Expected Result After Refactor:                             │
    │ • Complexity: 18 → 8  (56% reduction)                       │
    │ • Testability: Much improved                                │
    │ • Maintainability: C → B rating                             │
    │                                                              │
    │ ────────────────────────────────────────────────────────    │
    │ [View Source Code] [Generate Refactor Plan] [AI Suggestions]│
    └──────────────────────────────────────────────────────────────┘
    ```

### Architect Makes Decision

16. Based on drill-down analysis, Architect decides:
    - ✅ **CRITICAL**: Must fix security issue before ANY changes
    - ✅ **HIGH PRIORITY**: Refactor `handlePasswordReset()` before adding rate limiting
    - ✅ **RECOMMENDATION**: Create separate refactor story before ST-42

17. Architect documents decision in story ST-42:
    ```
    Architect Analysis:

    Component Health Assessment:
    - Authentication component: Moderate health (72/100)
    - password-reset.ts: HIGH RISK (complexity 24, coverage 65%)

    Critical Findings:
    - Security issue: hardcoded secret (line 145)
    - handlePasswordReset() function too complex (18)
    - Test coverage below 80% threshold

    Recommendation:
    - BLOCK: Create refactor story ST-43 first
    - BLOCK: Fix security issue immediately
    - Target: Reduce complexity to <10, increase coverage to 80%
    - Then proceed with rate limiting implementation

    Technical Complexity: 5 (Very High due to existing tech debt)
    ```

18. Architect creates refactor story ST-43 using "[Create Refactor Story]" button
19. ST-42 is blocked until ST-43 completes

## Alternative Flows

### 4a. Query multiple components
- Architect asks: "Compare health of Authentication and Email Service components"
- System returns side-by-side comparison
- Architect sees which component is higher risk

### 4b. Query entire layer
- Architect asks: "What is the health of the Backend/API layer?"
- System aggregates all components in that layer
- Shows layer-level metrics and hotspots

### 9a. Acceptable health - proceed without refactor
- At step 7, health score is 85/100 (Good)
- No critical hotspots
- Architect sets technical complexity to 3 (moderate)
- Proceeds with implementation without refactor story

### 13a. AI-powered refactor suggestions
- At step 15, Architect clicks "[AI Suggestions]"
- System uses AI to analyze code and suggest refactoring approach
- Provides code snippets and refactor plan
- Architect reviews and incorporates into refactor story

## MCP Tools

### Tool: `get_component_health`
```typescript
{
  name: "get_component_health",
  parameters: {
    component_id: string,
    include_files?: boolean, // include file list
    include_recommendations?: boolean
  },
  returns: {
    component: Component,
    health_score: number, // 0-100
    metrics: {
      complexity: { avg: number, max: number, status: string },
      coverage: { overall: number, by_level: {...}, status: string },
      churn: { file_count: number, change_frequency: number, status: string },
      technical_debt: { smells: number, duplication_pct: number, maintainability: string }
    },
    hotspots: Array<{
      file_path: string,
      risk_score: number,
      complexity: number,
      churn: string,
      coverage: number
    }>,
    recommendations: string[]
  }
}
```

### Tool: `get_file_health`
```typescript
{
  name: "get_file_health",
  parameters: {
    file_path: string,
    include_functions?: boolean
  },
  returns: {
    file_path: string,
    risk_score: number,
    loc: number,
    complexity: { cyclomatic: number, cognitive: number, maintainability: number },
    coverage: { overall: number, by_function: {...}, uncovered_branches: number },
    churn: { modifications: number, lines_changed: number, churn_rate: number },
    quality_issues: Array<{ severity: string, type: string, line: number, message: string }>,
    functions: Array<{ name: string, complexity: number, coverage: number }>,
    dependencies: { imported_by: string[], imports: string[], coupling_score: number },
    recommendations: string[]
  }
}
```

### Tool: `get_function_metrics`
```typescript
{
  name: "get_function_metrics",
  parameters: {
    file_path: string,
    function_name: string
  },
  returns: {
    function_name: string,
    line_range: { start: number, end: number },
    complexity: { cyclomatic: number, cognitive: number },
    loc: number,
    parameters: number,
    nested_depth: number,
    coverage: { percentage: number, covered_paths: number, total_paths: number, untested_scenarios: string[] },
    refactor_suggestions: Array<{ type: string, description: string, expected_improvement: string }>
  }
}
```

### Tool: `get_layer_health`
```typescript
{
  name: "get_layer_health",
  parameters: {
    layer_id: string
  },
  returns: {
    layer: Layer,
    components: Array<{ component: Component, health_score: number }>,
    overall_health: number,
    total_files: number,
    total_loc: number,
    aggregated_metrics: {...}
  }
}
```

## Postconditions
- Architect has detailed understanding of code health
- Architect can make informed decision about refactoring needs
- Technical risks are identified and documented
- Refactor stories created if needed
- Story technical complexity is accurately assessed

## Business Rules
- Health scores: 90-100 (Excellent), 80-89 (Good), 70-79 (Moderate), 60-69 (Poor), <60 (Critical)
- Risk score calculated: `complexity × churn × (1 - coverage/100)`
- Complexity thresholds: <10 (OK), 10-15 (Review), >15 (Refactor)
- Coverage thresholds: >80% (Good), 70-80% (Acceptable), <70% (Needs improvement)
- Churn threshold: >30% in 30 days is "High"

## Related Use Cases
- UC-ARCH-001: Assess Technical Complexity (uses health data)
- UC-ARCH-002: View Code Quality Dashboard (displays layer/component health)
- UC-ADMIN-003: Manage Layers and Components (defines structure)
- UC-PM-003: Create Story (Architect fills technical complexity based on health)

## Acceptance Criteria
- ✓ Architect can query component health in <2 seconds
- ✓ Health summary includes all key metrics (complexity, coverage, churn, debt)
- ✓ Hotspots are automatically identified and ranked
- ✓ Drill-down to file level works seamlessly
- ✓ Drill-down to function level provides actionable insights
- ✓ Recommendations are specific and actionable
- ✓ Architect can create refactor story directly from health view
- ✓ Health data influences technical complexity assessment
- ✓ MCP tools work from Claude Code CLI
- ✓ Web UI provides visual drill-down interface
- ✓ Security issues are highlighted as CRITICAL
- ✓ Refactor effort estimation is provided
