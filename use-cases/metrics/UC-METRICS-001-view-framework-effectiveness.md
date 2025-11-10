# UC-METRICS-001: View Framework Effectiveness Dashboard

## Actor
PM, Architect, Admin, Stakeholder

## Preconditions
- User is authenticated
- Project exists with completed stories
- At least one agentic framework has executed work
- Run data has been collected via `log_run` MCP tool

## Main Flow
1. User navigates to "Agent Effectiveness" tab in web UI (https://studio.pawelgawliczek.cloud/)
2. System displays Framework Effectiveness Dashboard with filters:
   - Project selection
   - Framework comparison (multi-select)
   - Date range
   - Complexity band filter (low: 1-2, medium: 3, high: 4-5)
   - Story type filter (feature, bug, refactor)

3. User selects frameworks to compare (e.g., "Dev-only" vs "BA+Arch+Dev+QA")
4. User selects complexity band (e.g., "medium complexity stories only")
5. System calls MCP tool: `get_framework_metrics({ project_id, framework_ids, complexity_band, date_range })`

6. System displays comparative dashboard with sections:

   **A. Efficiency Metrics**
   | Metric | Dev-only | BA+Arch+Dev+QA | Better |
   |--------|----------|----------------|--------|
   | Avg tokens per story | 45K | 62K | Dev-only ↓ |
   | Avg token per LOC | 85 | 45 | Full ↓ |
   | Story cycle time (hours) | 12 | 18 | Dev-only ↓ |
   | Prompt iterations per story | 25 | 15 | Full ↓ |
   | Parallelization efficiency % | 65% | 82% | Full ↑ |
   | Token efficiency (out/in) | 0.48 | 0.63 | Full ↑ |

   **B. Quality Metrics**
   | Metric | Dev-only | BA+Arch+Dev+QA | Better |
   |--------|----------|----------------|--------|
   | Defects per story | 2.3 | 0.8 | Full ↓ |
   | Defect leakage % | 45% | 12% | Full ↓ |
   | Code churn % (rework) | 35% | 18% | Full ↓ |
   | Test coverage % | 72% | 91% | Full ↑ |
   | Code complexity delta | +15% | -5% | Full ↓ |
   | Critical defects | 8 | 1 | Full ↓ |

   **C. Cost & Value Metrics**
   | Metric | Dev-only | BA+Arch+Dev+QA | Better |
   |--------|----------|----------------|--------|
   | Cost per story ($) | $4.50 | $6.20 | Dev-only ↓ |
   | Cost per accepted LOC ($) | $0.12 | $0.06 | Full ↓ |
   | Stories completed (30d) | 42 | 35 | Dev-only ↑ |
   | Accepted LOC (30d) | 8,500 | 12,000 | Full ↑ |
   | Rework cost ($) | $2.80 | $0.95 | Full ↓ |
   | Net value (LOC - rework cost) | High | Higher | Full ↑ |

   **D. Framework Overhead Analysis**
   | Role | Tokens | % of Total | Value Add |
   |------|--------|-----------|-----------|
   | BA | 8K | 13% | Requirements clarity ↑ |
   | Architect | 6K | 10% | Design quality ↑ |
   | Developer | 42K | 68% | Implementation |
   | QA | 6K | 9% | Defect prevention ↑ |
   | **Overhead ratio** | **20K / 42K** | **48%** | **Reduces rework by 17%** |

   **E. Trend Charts**
   - Token usage over time (line chart per framework)
   - Defect rate over time
   - Story completion velocity
   - Cost per story trend
   - Quality score trend (composite: coverage + churn + defects)

   **F. Complexity Band Breakdown**
   (Only shows selected complexity band, but can toggle to see all)
   - Low complexity (1-2): Dev-only wins on speed
   - Medium complexity (3): Full framework wins on quality
   - High complexity (4-5): Full framework significantly better

7. User can drill down on any metric:
   - Click "Defects per story" → see list of actual defects
   - Click "Story cycle time" → see distribution and outliers
   - Click "Token per LOC" → see story-by-story breakdown

8. User can perform actions:
   - Export comparison report as PDF
   - Save current view as preset
   - Schedule automated reports (weekly/monthly)
   - Share dashboard link with stakeholders
   - Adjust complexity band to see different segments

9. System provides AI-generated insights:
   - "Full framework reduces defect leakage by 73% for medium complexity"
   - "Dev-only is 33% faster for low complexity stories"
   - "Full framework has 48% overhead but prevents $2.80 in rework per story"
   - "Architect role prevents 2.1 defects per story on average"
   - "Recommended: Use Dev-only for complexity ≤2, Full for ≥3"

## Postconditions
- User has clear understanding of framework effectiveness
- Comparison is apples-to-apples (same complexity band)
- User can make data-driven decisions on framework selection
- Insights are actionable for process improvement

## Alternative Flows

### 4a. Compare across all complexity bands
- At step 4, user selects "All complexity bands"
- System shows aggregated metrics with warning:
  - "⚠️  Comparing across complexity bands. Use filters for fair comparison."
- Each metric shows breakdown by complexity:
  - Low: Dev-only 15 tokens/LOC, Full 18 tokens/LOC
  - Medium: Dev-only 85 tokens/LOC, Full 45 tokens/LOC
  - High: Dev-only 180 tokens/LOC (many failures), Full 75 tokens/LOC

### 7a. Drill down to individual stories
- At step 7, user clicks "View stories" for a metric
- System displays filtered story list with relevant metrics
- User can see which specific stories contributed to averages
- Can identify outliers and anomalies

### 8a. Create framework optimization recommendation
- At step 8, user clicks "Get Optimization Recommendations"
- System analyzes data and suggests:
  - "For low complexity stories, activate 'Dev-only' framework"
  - "For high complexity stories, activate 'BA+Arch+Dev+QA' framework"
  - "Consider adding Architect to current framework - ROI: $2.50 per story"
- User can accept and auto-configure frameworks

### 6a. Insufficient data for comparison
- At step 6, one framework has < 5 stories in selected complexity band
- System displays: "⚠️  Insufficient data for reliable comparison (min 5 stories)"
- System shows available data with confidence indicator
- Suggests broadening date range or complexity band

### 9a. Export detailed comparison report
- At step 8, user clicks "Export Detailed Report"
- System generates PDF with:
  - Executive summary with key findings
  - All metric tables
  - Trend charts
  - AI insights
  - Story-level data appendix
  - Recommendations

## Business Rules
- Metrics must be normalized by complexity band for fair comparison
- Minimum 5 stories per framework per complexity band for statistical validity
- Token costs calculated using provider rate tables (configurable)
- Defect leakage = (uat + production defects) ÷ total defects
- Code churn = LOC rewritten ÷ total LOC
- Overhead ratio = (non-dev tokens) ÷ dev tokens
- Net value accounts for both production output and rework costs

## Technical Implementation
- Background aggregation job runs nightly to pre-calculate metrics
- MCP tool `get_framework_metrics` queries pre-aggregated tables
- Real-time recalculation for custom date ranges
- Uses PostgreSQL window functions for trend analysis
- Caching for common queries (5-minute TTL)

## Related Use Cases
- UC-METRICS-002: View Defect Leakage Report
- UC-METRICS-003: View Token Usage Analysis
- UC-PM-004: Assign Story to Framework
- UC-ADMIN-003: Configure Framework

## Acceptance Criteria
- Dashboard loads within 3 seconds for typical dataset
- Metrics are accurate and verifiable against raw data
- Comparison is always normalized by complexity band
- Trend charts show clear patterns
- AI insights are relevant and actionable
- Export functionality produces professional reports
- User can easily understand which framework performs better for which scenarios
- Drill-down works seamlessly
- Cost calculations are accurate (token × rate)
- Statistical validity warnings appear when data insufficient
