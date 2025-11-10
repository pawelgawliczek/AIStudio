# UC-METRICS-004: Framework Week-over-Week Comparison

## Actor
PM, Architect, Admin, Stakeholder

## Preconditions
- User is authenticated
- Project exists with completed stories across multiple weeks
- At least one agentic framework has executed work
- Run data has been collected via `log_run` MCP tool

## Main Flow

### Week Selection and Filtering

1. User navigates to "Agent Performance" → "Framework Comparison" tab in web UI
2. System displays week-over-week comparison dashboard with filters:
   - Project selection
   - Framework filter (multi-select: Dev-only, BA+Arch+Dev+QA, Custom frameworks)
   - Week range selector (default: last 8 weeks)
   - Complexity band filter (low: 1-2, medium: 3, high: 4-5)
   - Comparison baseline: [Project Average] [Previous Week] [Best Week] [Custom Week]

3. User selects week range (e.g., "Last 8 weeks")
4. User selects frameworks to track (e.g., "BA+Arch+Dev+QA")
5. User selects complexity band (e.g., "All complexity bands" or "Medium only")
6. System calls MCP tool: `get_weekly_framework_metrics({ project_id, framework_ids, start_week, end_week, complexity_band })`

### Weekly Metrics Dashboard

7. System displays comprehensive week-over-week dashboard:

#### A. Weekly Summary Table

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ WEEK-OVER-WEEK FRAMEWORK PERFORMANCE (BA+Arch+Dev+QA Framework)                                                    │
├─────────────┬──────────┬──────────┬──────────┬────────────┬─────────────┬────────────┬───────────┬────────────────┤
│ Week        │ Stories  │ Framework│ Avg      │ Defects    │ Avg LOC     │ Cost       │ Velocity  │ vs Project Avg │
│             │ Delivered│ Used     │ Tokens   │ per Story  │ per Story   │ per Story  │ Score     │                │
├─────────────┼──────────┼──────────┼──────────┼────────────┼─────────────┼────────────┼───────────┼────────────────┤
│ Week 44     │ 8 ✓      │ Full     │ 58K ↓    │ 0.6 ↓      │ 425 ↑       │ $5.80 ↓    │ 92/100 ✓  │ +12% better    │
│ (Oct 28-    │          │ (8/8)    │          │            │             │            │           │                │
│  Nov 3)     │          │          │          │            │             │            │           │                │
├─────────────┼──────────┼──────────┼──────────┼────────────┼─────────────┼────────────┼───────────┼────────────────┤
│ Week 43     │ 6        │ Full     │ 64K      │ 0.8        │ 380         │ $6.40      │ 88/100    │ +8% better     │
│ (Oct 21-27) │          │ (6/6)    │          │            │             │            │           │                │
├─────────────┼──────────┼──────────┼──────────┼────────────┼─────────────┼────────────┼───────────┼────────────────┤
│ Week 42     │ 7        │ Mixed    │ 72K ⚠    │ 1.2 ⚠      │ 355         │ $7.20 ⚠    │ 75/100    │ -8% worse      │
│ (Oct 14-20) │          │ (4 Full, │          │            │             │            │           │                │
│             │          │ 3 Dev)   │          │            │             │            │           │                │
├─────────────┼──────────┼──────────┼──────────┼────────────┼─────────────┼────────────┼───────────┼────────────────┤
│ Week 41     │ 5        │ Full     │ 62K      │ 0.9        │ 410         │ $6.20      │ 85/100    │ +3% better     │
│ (Oct 7-13)  │          │ (5/5)    │          │            │             │            │           │                │
├─────────────┼──────────┼──────────┼──────────┼────────────┼─────────────┼────────────┼───────────┼────────────────┤
│ Week 40     │ 9        │ Full     │ 66K      │ 0.7        │ 395         │ $6.60      │ 90/100 ✓  │ +10% better    │
│ (Sep 30-    │          │ (9/9)    │          │            │             │            │           │                │
│  Oct 6)     │          │          │          │            │             │            │           │                │
├─────────────┼──────────┼──────────┼──────────┼────────────┼─────────────┼────────────┼───────────┼────────────────┤
│ Week 39     │ 4        │ Dev      │ 48K ↓    │ 2.5 ⚠      │ 320         │ $4.80 ↓    │ 65/100 ⚠  │ -20% worse     │
│ (Sep 23-29) │          │ (4/4)    │          │            │             │            │           │                │
├─────────────┼──────────┼──────────┼──────────┼────────────┼─────────────┼────────────┼───────────┼────────────────┤
│ Week 38     │ 6        │ Full     │ 60K      │ 0.8        │ 400         │ $6.00      │ 87/100    │ +5% better     │
│ (Sep 16-22) │          │ (6/6)    │          │            │             │            │           │                │
├─────────────┼──────────┼──────────┼──────────┼────────────┼─────────────┼────────────┼───────────┼────────────────┤
│ Week 37     │ 7        │ Full     │ 65K      │ 0.9        │ 385         │ $6.50      │ 84/100    │ +2% better     │
│ (Sep 9-15)  │          │ (7/7)    │          │            │             │            │           │                │
├─────────────┼──────────┼──────────┼──────────┼────────────┼─────────────┼────────────┼───────────┼────────────────┤
│ PROJECT AVG │ 6.5      │ Full     │ 62K      │ 1.0        │ 385         │ $6.20      │ 82/100    │ Baseline       │
│ (All weeks) │          │ (87%)    │          │            │             │            │           │                │
└─────────────┴──────────┴──────────┴──────────┴────────────┴─────────────┴────────────┴───────────┴────────────────┘

Legend: ✓ = Excellent | ↑↓ = Trend | ⚠ = Below average
```

#### B. Detailed Efficiency Metrics by Week

System displays extended efficiency metrics for each week:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ DETAILED WEEK-OVER-WEEK EFFICIENCY METRICS (BA+Arch+Dev+QA Framework)                                                              │
├─────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┬──────────────┬───────────┬────────────────────┤
│ Week        │ Tokens/  │ LOC/     │ Runtime/ │ Runtime/ │ Avg      │ Code         │ Defect       │ Test      │ First-Time-Right  │
│             │ LOC      │ Prompt   │ LOC      │ Token    │ Prompts  │ Churn %      │ Leakage %    │ Coverage  │ %                 │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┼──────────────┼───────────┼────────────────────┤
│ Week 44     │ 136 ↓ ✓  │ 16.7 ↑   │ 5.5 min  │ 0.14 s   │ 25.5     │ 15% ✓        │ 20% ✓        │ 93% ✓     │ 72% ✓              │
│ (Oct 28-    │          │          │ /LOC ↓   │ /tok ↓   │          │              │              │           │                    │
│  Nov 3)     │          │          │          │          │          │              │              │           │                    │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┼──────────────┼───────────┼────────────────────┤
│ Week 43     │ 168      │ 14.2     │ 6.2 min  │ 0.16 s   │ 26.8     │ 17%          │ 25%          │ 91%       │ 68%                │
│ (Oct 21-27) │          │          │ /LOC     │ /tok     │          │              │              │           │                    │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┼──────────────┼───────────┼────────────────────┤
│ Week 42     │ 203 ⚠    │ 11.5 ↓   │ 7.8 min  │ 0.18 s   │ 30.8 ⚠   │ 22% ⚠        │ 38% ⚠        │ 88%       │ 58% ⚠              │
│ (Oct 14-20) │          │          │ /LOC ⚠   │ /tok ⚠   │          │              │              │           │                    │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┼──────────────┼───────────┼────────────────────┤
│ Week 41     │ 151      │ 15.8     │ 5.8 min  │ 0.15 s   │ 26.0     │ 18%          │ 28%          │ 90%       │ 65%                │
│ (Oct 7-13)  │          │          │ /LOC     │ /tok     │          │              │              │           │                    │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┼──────────────┼───────────┼────────────────────┤
│ Week 40     │ 167      │ 15.2     │ 6.0 min  │ 0.15 s   │ 26.0     │ 16% ✓        │ 22% ✓        │ 92% ✓     │ 70%                │
│ (Sep 30-    │          │          │ /LOC     │ /tok     │          │              │              │           │                    │
│  Oct 6)     │          │          │          │          │          │              │              │           │                    │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┼──────────────┼───────────┼────────────────────┤
│ Week 39     │ 150      │ 10.3 ↓   │ 8.5 min  │ 0.19 s   │ 31.0 ⚠   │ 28% ⚠        │ 52% ⚠        │ 85% ⚠     │ 48% ⚠              │
│ (Sep 23-29) │          │          │ /LOC ⚠   │ /tok ⚠   │          │              │              │           │                    │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┼──────────────┼───────────┼────────────────────┤
│ Week 38     │ 150      │ 16.0     │ 5.5 min  │ 0.14 s   │ 25.0     │ 18%          │ 26%          │ 91%       │ 67%                │
│ (Sep 16-22) │          │          │ /LOC     │ /tok     │          │              │              │           │                    │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┼──────────────┼───────────┼────────────────────┤
│ Week 37     │ 169      │ 14.8     │ 6.3 min  │ 0.16 s   │ 26.0     │ 19%          │ 30%          │ 90%       │ 64%                │
│ (Sep 9-15)  │          │          │ /LOC     │ /tok     │          │              │              │           │                    │
├─────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┼──────────────┼───────────┼────────────────────┤
│ PROJECT AVG │ 161      │ 14.3     │ 6.4 min  │ 0.16 s   │ 27.0     │ 19%          │ 30%          │ 90%       │ 64%                │
│ (All weeks) │          │          │ /LOC     │ /tok     │          │              │              │           │                    │
└─────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┴──────────────┴───────────┴────────────────────┘

Metric Definitions:
• Tokens/LOC: Average tokens consumed per line of code generated (lower is better - more efficient)
• LOC/Prompt: Average lines of code generated per agent prompt iteration (higher is better - more productive)
• Runtime/LOC: Average runtime (in minutes) per line of code generated (lower is better - faster)
• Runtime/Token: Average runtime (in seconds) per token processed (lower is better - faster processing)
• Avg Prompts: Average number of prompt iterations per story (lower is better - less back-and-forth)
• Code Churn: Percentage of LOC that needed rework/rewrite (lower is better - less wasted effort)
• Defect Leakage: Percentage of defects that escaped to UAT/production vs caught in dev (lower is better)
• Test Coverage: Average test coverage percentage across all stories (higher is better)
• First-Time-Right: Percentage of stories that passed QA without requiring rework (higher is better)

Legend: ✓ = Excellent (above average) | ↓ = Declining trend | ↑ = Improving trend | ⚠ = Below average (needs attention)
```

#### D. Framework Mix by Week

Shows which frameworks were used for stories each week:

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ FRAMEWORK USAGE BY WEEK                                                           │
├────────────┬──────────────────────────────────────────────────────────────────────┤
│ Week 44    │ ████████ BA+Arch+Dev+QA: 8 stories (100%)                            │
├────────────┼──────────────────────────────────────────────────────────────────────┤
│ Week 43    │ ████████ BA+Arch+Dev+QA: 6 stories (100%)                            │
├────────────┼──────────────────────────────────────────────────────────────────────┤
│ Week 42    │ █████ BA+Arch+Dev+QA: 4 (57%) │ ███ Dev-only: 3 (43%)                │
├────────────┼──────────────────────────────────────────────────────────────────────┤
│ Week 41    │ ████████ BA+Arch+Dev+QA: 5 stories (100%)                            │
├────────────┼──────────────────────────────────────────────────────────────────────┤
│ Week 40    │ ████████ BA+Arch+Dev+QA: 9 stories (100%)                            │
├────────────┼──────────────────────────────────────────────────────────────────────┤
│ Week 39    │ ████████ Dev-only: 4 stories (100%)                                  │
├────────────┼──────────────────────────────────────────────────────────────────────┤
│ Week 38    │ ████████ BA+Arch+Dev+QA: 6 stories (100%)                            │
├────────────┼──────────────────────────────────────────────────────────────────────┤
│ Week 37    │ ████████ BA+Arch+Dev+QA: 7 stories (100%)                            │
└────────────┴──────────────────────────────────────────────────────────────────────┘
```

#### E. Weekly KPI Trends (Line Charts)

System displays 4 trend charts:

**Chart 1: Stories Delivered per Week**
- Line chart showing story count by week
- Average line (6.5 stories) shown as baseline
- Best week (Week 40: 9 stories) and worst week (Week 39: 4 stories) highlighted

**Chart 2: Quality Metrics Trend**
- Defects per story (lower is better)
- Code churn % (rework)
- Test coverage %

**Chart 3: Efficiency Metrics Trend**
- Avg tokens per story
- Tokens per LOC
- LOC per story

**Chart 4: Cost Metrics Trend**
- Cost per story
- Cost per accepted LOC
- Net cost (including rework)

#### F. Week Comparison: Selected vs Project Average

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ WEEK 44 vs PROJECT AVERAGE                                                         │
├──────────────────────────────┬─────────────┬─────────────┬───────────────────────┤
│ Metric                       │ Week 44     │ Project Avg │ Difference            │
├──────────────────────────────┼─────────────┼─────────────┼───────────────────────┤
│ Stories Delivered            │ 8           │ 6.5         │ +1.5 (+23%) ✓         │
│ Framework Consistency        │ 100% Full   │ 87% Full    │ +13% ✓                │
│ Avg Tokens per Story         │ 58K         │ 62K         │ -4K (-6%) ✓           │
│ Defects per Story            │ 0.6         │ 1.0         │ -0.4 (-40%) ✓         │
│ Avg LOC per Story            │ 425         │ 385         │ +40 (+10%) ✓          │
│ Cost per Story               │ $5.80       │ $6.20       │ -$0.40 (-6%) ✓        │
│ Token Efficiency (tok/LOC)   │ 136         │ 161         │ -25 (-16%) ✓          │
│ Code Churn %                 │ 15%         │ 18%         │ -3% ✓                 │
│ Test Coverage %              │ 93%         │ 91%         │ +2% ✓                 │
│ Velocity Score               │ 92/100      │ 82/100      │ +10 points ✓          │
├──────────────────────────────┴─────────────┴─────────────┴───────────────────────┤
│ Overall Assessment: Week 44 was EXCELLENT - Above average on all key metrics      │
└────────────────────────────────────────────────────────────────────────────────────┘
```

#### G. Framework-Specific KPIs

For each framework used during the week, show:

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ BA+ARCH+DEV+QA FRAMEWORK - WEEK 44 PERFORMANCE                                     │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│ Stories Processed: 8                                                               │
│                                                                                    │
│ Agent Performance:                                                                 │
│ • BA Agent:         9,200 tokens avg (14%) | 6.2 iterations avg | 28 min avg      │
│ • Architect Agent:  5,800 tokens avg (10%) | 4.1 iterations avg | 18 min avg      │
│ • Developer Agent: 38,500 tokens avg (66%) | 11.5 iterations avg | 52 min avg     │
│   └─ Code Generated: 425 LOC avg | 90.6 tokens/LOC                                │
│ • QA Agent:         4,500 tokens avg (8%)  | 3.8 iterations avg | 22 min avg      │
│                                                                                    │
│ Total Avg: 58,000 tokens | 2h 20min | 25.5 iterations                             │
│                                                                                    │
│ Quality Metrics:                                                                   │
│ • Defects Found: 5 total (0.6 per story)                                          │
│   └─ Caught by QA Agent: 4 (80%) | Leaked to production: 1 (20%)                  │
│ • Test Coverage: 93% avg                                                           │
│ • Code Churn: 15% (60 LOC reworked out of 425 LOC)                                │
│                                                                                    │
│ Efficiency:                                                                        │
│ • Parallelization: 85% (agents ran concurrently where possible)                    │
│ • First-time-right: 72% (stories that passed QA without rework)                   │
│ • Requirements clarity: 94% (BA analysis prevented 3.2 iterations avg)            │
│                                                                                    │
│ Cost Analysis:                                                                     │
│ • Direct cost: $5.80 per story ($0.0136 per LOC)                                  │
│ • Rework cost: $0.87 per story (15% churn)                                        │
│ • Net cost: $6.67 per story                                                        │
│ • ROI vs Dev-only: Saves $1.13 per story (prevents $2.80 rework, costs $1.67 more)│
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### AI-Generated Weekly Insights

8. System provides AI-generated insights comparing week to averages:

```
🤖 AI INSIGHTS FOR WEEK 44:

✓ EXCELLENT WEEK - Week 44 performed 12% better than your project average

KEY HIGHLIGHTS:
• Story throughput up 23% - delivered 8 stories vs 6.5 avg
• Quality improved significantly - only 0.6 defects/story vs 1.0 avg (40% reduction)
• Efficiency gains - used 6% fewer tokens per story despite higher LOC output
• Framework consistency at 100% - all stories used full BA+Arch+Dev+QA framework

WEEK 42 ANALYSIS (Mixed Framework Week):
• Week 42 underperformed (-8% vs avg) when 3 stories used Dev-only framework
• Those 3 Dev-only stories had 2.3 defects/story avg vs 0.5 for Full framework
• This increased overall week defect rate to 1.2/story
• Lesson: Medium+ complexity stories benefit from full framework

RECOMMENDATIONS:
1. Continue using full framework consistently (as in Week 44)
2. Week 44's BA Agent performance was exceptional (prevented 3.8 iterations avg)
3. Consider Week 44 as template for optimal week structure
4. QA Agent caught 80% of defects in Week 44 - maintain this practice

TREND OBSERVATION:
• Weeks with 100% full framework usage (37, 38, 40, 41, 43, 44) avg 88/100 velocity
• Weeks with mixed frameworks (42) or Dev-only (39) avg 70/100 velocity
• Your project is trending positive: last 3 weeks all above 85/100 velocity
```

### Drill-Down Capabilities

9. User can drill down on any metric:
   - Click "8 stories" in Week 44 → see list of all 8 stories with details
   - Click "0.6 defects" → see breakdown of 5 defects found that week
   - Click "425 LOC" → see story-by-story LOC breakdown
   - Click "92/100 velocity" → see velocity score calculation breakdown
   - Click week row → expand full week details with all metrics

10. User can perform actions:
    - Export weekly report as PDF/CSV
    - Schedule automated weekly reports (sent every Monday)
    - Set up alerts (e.g., "Alert me if week velocity drops below 80/100")
    - Save custom week comparison views
    - Share dashboard link with stakeholders
    - Download raw data for external analysis

### Comparison Modes

11. User can switch comparison baseline:
    - **Project Average** (default): Compare each week to overall project avg
    - **Previous Week**: Week-over-week delta (e.g., Week 44 vs Week 43)
    - **Best Week**: Compare to best performing week (Week 40 in example)
    - **Custom Week**: Pick specific week as baseline

## Postconditions
- User has clear understanding of week-over-week performance trends
- User can identify which weeks performed well and why
- User can see impact of framework choices on weekly performance
- User can make data-driven decisions on framework selection
- User can identify process improvements based on successful weeks

## Alternative Flows

### 7a. Drill down to specific week details
- At step 7, user clicks on specific week row
- System expands inline to show:
  - List of all stories completed that week with individual metrics
  - Breakdown of which frameworks were used for which stories
  - Week-specific anomalies (e.g., "ST-123 took 3x longer than average")
  - Agent-by-agent performance for that week
- User can click story to see full story details

### 8a. Compare two specific weeks
- At step 8, user clicks "Compare Weeks"
- User selects two weeks (e.g., Week 44 vs Week 42)
- System displays side-by-side comparison:
  - All metrics compared
  - Framework mix differences highlighted
  - Story list comparison
  - Root cause analysis for differences
- Example insight: "Week 42 had 3 Dev-only stories which caused 1.2 avg defects vs Week 44's 0.6"

### 9a. Filter by complexity band
- At step 9, user filters to "Medium complexity only"
- System recalculates all weekly metrics for medium complexity stories only
- Shows fair comparison (apples-to-apples)
- Example: "Week 44 medium stories: 5 delivered, 0.4 defects avg"

### 10a. Framework adoption tracking
- User clicks "Framework Adoption Trends"
- System shows trend of framework usage over time:
  - % of stories using each framework per week
  - Migration patterns (e.g., "Project shifted from Dev-only to Full in Week 38")
  - Correlation between framework adoption and quality/efficiency
- Chart shows adoption curve and performance correlation

### 6a. Insufficient data for weekly comparison
- At step 6, project has fewer than 4 weeks of data
- System displays: "⚠️  Insufficient data for weekly trends (minimum 4 weeks recommended)"
- System shows available data with limited insights
- Suggests waiting for more data or viewing overall metrics instead

### 8b. Velocity score breakdown
- At step 8, user clicks "Velocity Score: 92/100"
- System shows velocity calculation:
  ```
  Velocity Score Breakdown (Week 44):

  Throughput (40 points): 38/40 ✓
  • Stories delivered: 8 vs 6.5 avg → 8 points (target: 10)
  • LOC generated: 3,400 vs 2,500 avg → 10 points (target: 10)
  • Story completion rate: 100% (8/8 started) → 10 points (target: 10)
  • Avg story cycle time: 2.5 days vs 3.2 avg → 10 points (target: 10)

  Quality (40 points): 37/40 ✓
  • Defects per story: 0.6 vs 1.0 avg → 10 points (target: 10)
  • Test coverage: 93% vs 91% avg → 9 points (target: 10)
  • Code churn: 15% vs 18% avg → 10 points (target: 10)
  • Defect leakage: 20% vs 25% avg → 8 points (target: 10)

  Efficiency (20 points): 17/20 ✓
  • Token efficiency: 136 tok/LOC vs 161 avg → 9 points (target: 10)
  • Cost per story: $5.80 vs $6.20 avg → 8 points (target: 10)

  Total: 92/100 (Excellent)

  Grade: A (90-100) | Previous week: 88/100 (B+)
  ```

## Business Rules
- Weeks are defined as Monday-Sunday
- Current incomplete week shown with "(In Progress)" label
- Minimum 1 completed story per week to be included in comparison
- Velocity score calculation:
  - Throughput (40%): Stories delivered, LOC generated, completion rate, cycle time
  - Quality (40%): Defects, coverage, churn, leakage
  - Efficiency (20%): Token efficiency, cost
- Project average excludes current incomplete week
- Framework consistency = % of stories using primary framework
- Best week = highest velocity score

## Technical Implementation
- Weekly metrics pre-aggregated via nightly batch job
- MCP tool `get_weekly_framework_metrics` queries pre-aggregated tables
- Real-time recalculation for current week
- Uses PostgreSQL window functions for trend calculations
- Caching for historical week data (24-hour TTL)
- AI insights generated via OpenAI API with weekly metrics context

## Related Use Cases
- UC-METRICS-001: View Framework Effectiveness Dashboard
- UC-METRICS-002: View Project Tracker
- UC-METRICS-003: View Agent Execution Details
- UC-PM-004: Assign Story to Framework
- UC-PM-007: JIRA-like Planning View

## Acceptance Criteria
- ✓ Dashboard shows minimum 4 weeks of data (or warning if less)
- ✓ Weekly summary table displays all key metrics accurately
- ✓ Framework mix by week shows which frameworks used for each story
- ✓ Trend charts show clear patterns over time
- ✓ Week comparison highlights differences clearly
- ✓ Framework-specific KPIs show agent performance breakdown
- ✓ AI insights provide actionable recommendations
- ✓ Drill-down works for all metrics
- ✓ Velocity score calculation is transparent and verifiable
- ✓ Export functionality produces professional reports
- ✓ User can easily identify best/worst weeks and understand why
- ✓ Statistical validity warnings appear when data insufficient
- ✓ LOC metrics displayed for all Developer agent executions
- ✓ Framework consistency tracked and reported
- ✓ Comparison modes (avg, previous, best, custom) work correctly
