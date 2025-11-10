# Agent Performance View - Text-Based Design

> **Based on**: UC-METRICS-001 (Framework Effectiveness), UC-METRICS-003 (Per-Agent Execution Details)
> **Primary Users**: PM, Architect, Admin, Stakeholder

---

## Screen Layout Overview

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ AI STUDIO - Agent Performance & Effectiveness                        👤 User ▼ ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📊 Dashboard │ 📋 Planning │ 📈 Metrics │ 🎯 Use Cases │ 🧪 Test Cases       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                 ┃
┃ Project: AI Studio MCP Control Plane                                           ┃
┃                                                                                 ┃
┃ ┌─ Tabs ────────────────────────────────────────────────────────────────────┐  ┃
┃ │ [Framework Comparison] [Per-Story Execution] [Per-Agent Analytics]        │  ┃
┃ └────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Tab 1: Framework Comparison View

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ FRAMEWORK COMPARISON ━━━━━━━━━━━━━━━━━                                     ┃
┃                                                                                                ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ View Mode: ● Overall Comparison  ○ Week-over-Week Analysis                            │    ┃
┃ │                                                                                        │    ┃
┃ │ Compare Frameworks:                                                                    │    ┃
┃ │ ☑ Dev-only                    ☑ BA+Arch+Dev+QA (Full)     ☐ Custom Framework 1       │    ┃
┃ │                                                                                        │    ┃
┃ │ Filters:                                                                               │    ┃
┃ │ Date Range: [Last 30 days ▼]                                                          │    ┃
┃ │ Complexity Band: [Medium (3) ▼]  ⚠️ Select complexity band for fair comparison        │    ┃
┃ │ Story Type: [All ▼]                                                                    │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ A. EFFICIENCY METRICS ━━━━━━━━━━━━━━━━━                                    ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Metric                       │ Dev-only  │ BA+Arch+Dev+QA │ Better    │ Difference      │  ┃
┃ ├──────────────────────────────┼───────────┼────────────────┼───────────┼─────────────────┤  ┃
┃ │ Avg tokens per story         │ 45,000    │ 62,000         │ Dev-only ↓│ +38% overhead   │  ┃
┃ │ Avg token per LOC            │ 85        │ 45             │ Full ✓    │ 47% better      │  ┃
┃ │ Story cycle time (hours)     │ 12        │ 18             │ Dev-only ↓│ +50% longer     │  ┃
┃ │ Prompt iterations per story  │ 25        │ 15             │ Full ✓    │ 40% fewer       │  ┃
┃ │ Parallelization efficiency % │ 65%       │ 82%            │ Full ✓    │ +17%            │  ┃
┃ │ Token efficiency (out/in)    │ 0.48      │ 0.63           │ Full ✓    │ +31%            │  ┃
┃ └──────────────────────────────┴───────────┴────────────────┴───────────┴─────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ B. QUALITY METRICS ━━━━━━━━━━━━━━━━━                                       ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Metric                       │ Dev-only  │ BA+Arch+Dev+QA │ Better    │ Difference      │  ┃
┃ ├──────────────────────────────┼───────────┼────────────────┼───────────┼─────────────────┤  ┃
┃ │ Defects per story            │ 2.3       │ 0.8            │ Full ✓    │ 65% fewer       │  ┃
┃ │ Defect leakage %             │ 45%       │ 12%            │ Full ✓    │ 73% reduction   │  ┃
┃ │ Code churn % (rework)        │ 35%       │ 18%            │ Full ✓    │ 49% less rework │  ┃
┃ │ Test coverage %              │ 72%       │ 91%            │ Full ✓    │ +19%            │  ┃
┃ │ Code complexity delta        │ +15%      │ -5%            │ Full ✓    │ 20% improvement │  ┃
┃ │ Critical defects             │ 8         │ 1              │ Full ✓    │ 87% fewer       │  ┃
┃ └──────────────────────────────┴───────────┴────────────────┴───────────┴─────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ C. COST & VALUE METRICS ━━━━━━━━━━━━━━━━━                                  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Metric                       │ Dev-only  │ BA+Arch+Dev+QA │ Better    │ Difference      │  ┃
┃ ├──────────────────────────────┼───────────┼────────────────┼───────────┼─────────────────┤  ┃
┃ │ Cost per story ($)           │ $4.50     │ $6.20          │ Dev-only ↓│ +38% more       │  ┃
┃ │ Cost per accepted LOC ($)    │ $0.12     │ $0.06          │ Full ✓    │ 50% cheaper     │  ┃
┃ │ Stories completed (30d)      │ 42        │ 35             │ Dev-only ↑│ +20% more       │  ┃
┃ │ Accepted LOC (30d)           │ 8,500     │ 12,000         │ Full ✓    │ +41% more       │  ┃
┃ │ Rework cost ($)              │ $2.80     │ $0.95          │ Full ✓    │ 66% less        │  ┃
┃ │ Net cost (incl rework)       │ $7.30     │ $6.20          │ Full ✓    │ 15% cheaper     │  ┃
┃ └──────────────────────────────┴───────────┴────────────────┴───────────┴─────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ D. FRAMEWORK OVERHEAD ANALYSIS ━━━━━━━━━━━━━━━━━                           ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ BA+Arch+Dev+QA Framework - Token Distribution:                                           │  ┃
┃ │                                                                                          │  ┃
┃ │ Role         │ Tokens │ % of Total │ Value Add                                          │  ┃
┃ ├──────────────┼────────┼────────────┼────────────────────────────────────────────────────┤  ┃
┃ │ BA           │ 8,000  │ 13%        │ Requirements clarity ↑ | Reduces ambiguity 40%     │  ┃
┃ │ Architect    │ 6,000  │ 10%        │ Design quality ↑ | Prevents 2.1 defects per story │  ┃
┃ │ Developer    │ 42,000 │ 68%        │ Implementation | Core development work             │  ┃
┃ │ QA           │ 6,000  │ 9%         │ Defect prevention ↑ | Catches 85% before prod     │  ┃
┃ ├──────────────┼────────┼────────────┼────────────────────────────────────────────────────┤  ┃
┃ │ Overhead     │ 20,000 │ 48%        │ Reduces rework by 17% ($2.80 → $0.95)             │  ┃
┃ │ Ratio        │ / 42K  │ (non-dev)  │ ✓ COST EFFECTIVE                                   │  ┃
┃ └──────────────┴────────┴────────────┴────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ E. TREND CHARTS (Last 30 days) ━━━━━━━━━━━━━━━━━                          ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ TOKEN USAGE PER STORY                                                                    │  ┃
┃ │                                                                                          │  ┃
┃ │ 70K┤                                                                                     │  ┃
┃ │ 60K┤                              ─┬─┬─┬─┬─ BA+Arch+Dev+QA (avg: 62K)                  │  ┃
┃ │ 50K┤          ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┘ │ │ │ │                                            │  ┃
┃ │ 40K┤  ─┬─┬─┬─┬┘ │ │ │ │ │ │ │ │ │   │ │ │ │  Dev-only (avg: 45K)                       │  ┃
┃ │ 30K┤   │ │ │ │  │ │ │ │ │ │ │ │ │   │ │ │ │                                            │  ┃
┃ │ 20K┤   │ │ │ │  │ │ │ │ │ │ │ │ │   │ │ │ │                                            │  ┃
┃ │    └─────────────────────────────────────────────                                        │  ┃
┃ │    Oct 10    Oct 17    Oct 24    Oct 31    Nov 7                                        │  ┃
┃ │                                                                                          │  ┃
┃ │ ━ BA+Arch+Dev+QA  ━ Dev-only                                                            │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ DEFECT RATE TREND                                                                        │  ┃
┃ │                                                                                          │  ┃
┃ │  3 ┤ ─┬─┬─┬  Dev-only                                                                   │  ┃
┃ │    │  │ │ │ ─┐                                                                          │  ┃
┃ │  2 ┤  │ │ │  └─┬─┬─┬─┬─                                                                 │  ┃
┃ │    │  │ │ │    │ │ │ │ │                                                                │  ┃
┃ │  1 ┤  │ │ │    │ │ │ │ │  ─┬─┬─┬─┬─┬─  BA+Arch+Dev+QA                                  │  ┃
┃ │    │  │ │ │    │ │ │ │ │   │ │ │ │ │ │                                                 │  ┃
┃ │  0 ┤──┴─┴─┴────┴─┴─┴─┴─┴───┴─┴─┴─┴─┴──                                                  │  ┃
┃ │    Oct 10    Oct 17    Oct 24    Oct 31    Nov 7                                        │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ F. COMPLEXITY BAND BREAKDOWN ━━━━━━━━━━━━━━━━━                             ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Complexity Band │ Stories │ Winner        │ Why                                         │  ┃
┃ ├─────────────────┼─────────┼───────────────┼─────────────────────────────────────────────┤  ┃
┃ │ Low (1-2)       │ 15 vs 18│ Dev-only ✓    │ 33% faster, comparable quality              │  ┃
┃ │ Medium (3)      │ 42 vs 35│ Full ✓        │ 73% fewer defects, worth overhead           │  ┃
┃ │ High (4-5)      │ 18 vs 12│ Full ✓        │ Significantly better quality & completion   │  ┃
┃ └─────────────────┴─────────┴───────────────┴─────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ G. AI-POWERED INSIGHTS ━━━━━━━━━━━━━━━━━                                   ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 🤖 Key Insights:                                                                         │  ┃
┃ │                                                                                          │  ┃
┃ │ • Full framework reduces defect leakage by 73% for medium complexity stories             │  ┃
┃ │ • Dev-only is 33% faster for low complexity stories with similar quality                 │  ┃
┃ │ • Full framework has 48% overhead but prevents $2.80 in rework per story                 │  ┃
┃ │ • Architect role prevents 2.1 defects per story on average                               │  ┃
┃ │ • BA reduces developer iterations by 40% (25 → 15 prompts)                               │  ┃
┃ │                                                                                          │  ┃
┃ │ 💡 Recommendation: Use Dev-only for complexity ≤2, Full framework for ≥3                 │  ┃
┃ │                                                                                          │  ┃
┃ │ [Get Optimization Recommendations] [Export Report] [Schedule Report]                     │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

### Week-over-Week Analysis View

When user selects "Week-over-Week Analysis" radio button:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ WEEK-OVER-WEEK FRAMEWORK ANALYSIS ━━━━━━━━━━━━━━━━━                        ┃
┃                                                                                                ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ View Mode: ○ Overall Comparison  ● Week-over-Week Analysis                            │    ┃
┃ │                                                                                        │    ┃
┃ │ Framework: [BA+Arch+Dev+QA (Full) ▼]                                                  │    ┃
┃ │                                                                                        │    ┃
┃ │ Filters:                                                                               │    ┃
┃ │ Week Range: [Last 8 weeks ▼]   Baseline: [Project Average ▼]                         │    ┃
┃ │ Complexity Band: [All ▼]                                                              │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ WEEKLY SUMMARY ━━━━━━━━━━━━━━━━━                                           ┃
┃                                                                                                ┃
┃ Week       │Stories│Tokens│Defects│LOC │Cost  │Velocity│vs Avg │ [Expand Details]            ┃
┃────────────┼───────┼──────┼───────┼────┼──────┼────────┼───────┤                             ┃
┃ Week 44    │ 8 ✓   │ 58K ↓│ 0.6 ↓ │425↑│$5.80↓│ 92/100 │ +12% ✓│ [+]                         ┃
┃ (Oct 28-   │       │      │       │    │      │        │       │                             ┃
┃  Nov 3)    │       │      │       │    │      │        │       │                             ┃
┃────────────┼───────┼──────┼───────┼────┼──────┼────────┼───────┤                             ┃
┃ Week 43    │ 6     │ 64K  │ 0.8   │380 │$6.40 │ 88/100 │ +8%   │ [+]                         ┃
┃────────────┼───────┼──────┼───────┼────┼──────┼────────┼───────┤                             ┃
┃ Week 42    │ 7     │ 72K⚠ │ 1.2⚠  │355 │$7.20⚠│ 75/100 │ -8% ⚠ │ [+]                         ┃
┃────────────┼───────┼──────┼───────┼────┼──────┼────────┼───────┤                             ┃
┃ Week 41    │ 5     │ 62K  │ 0.9   │410 │$6.20 │ 85/100 │ +3%   │ [+]                         ┃
┃────────────┼───────┼──────┼───────┼────┼──────┼────────┼───────┤                             ┃
┃ Week 40    │ 9     │ 66K  │ 0.7   │395 │$6.60 │ 90/100 │ +10% ✓│ [+]                         ┃
┃────────────┼───────┼──────┼───────┼────┼──────┼────────┼───────┤                             ┃
┃ Week 39    │ 4     │ 48K↓ │ 2.5⚠  │320 │$4.80↓│ 65/100⚠│ -20%⚠ │ [+]                         ┃
┃────────────┼───────┼──────┼───────┼────┼──────┼────────┼───────┤                             ┃
┃ Week 38    │ 6     │ 60K  │ 0.8   │400 │$6.00 │ 87/100 │ +5%   │ [+]                         ┃
┃────────────┼───────┼──────┼───────┼────┼──────┼────────┼───────┤                             ┃
┃ Week 37    │ 7     │ 65K  │ 0.9   │385 │$6.50 │ 84/100 │ +2%   │ [+]                         ┃
┃────────────┼───────┼──────┼───────┼────┼──────┼────────┼───────┤                             ┃
┃ PROJECT AVG│ 6.5   │ 62K  │ 1.0   │385 │$6.20 │ 82/100 │ ---   │                             ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ DETAILED EFFICIENCY METRICS BY WEEK ━━━━━━━━━━━━━━━━━                      ┃
┃                                                                                                ┃
┃ Week    │Tok/LOC│LOC/Prmt│RT/LOC │RT/Tok │Churn│Leak %│Coverage│First-Right│ [Toggle Metrics]┃
┃─────────┼───────┼────────┼───────┼───────┼─────┼──────┼────────┼───────────┤                 ┃
┃ Week 44 │ 136↓✓ │ 16.7↑  │5.5min↓│0.14s↓ │ 15%✓│  20%✓│  93% ✓ │   72% ✓   │                 ┃
┃─────────┼───────┼────────┼───────┼───────┼─────┼──────┼────────┼───────────┤                 ┃
┃ Week 43 │ 168   │ 14.2   │6.2min │0.16s  │ 17% │  25% │  91%   │   68%     │                 ┃
┃─────────┼───────┼────────┼───────┼───────┼─────┼──────┼────────┼───────────┤                 ┃
┃ Week 42 │ 203⚠  │ 11.5↓  │7.8min⚠│0.18s⚠ │ 22%⚠│  38%⚠│  88%   │   58% ⚠   │                 ┃
┃─────────┼───────┼────────┼───────┼───────┼─────┼──────┼────────┼───────────┤                 ┃
┃ Week 41 │ 151   │ 15.8   │5.8min │0.15s  │ 18% │  28% │  90%   │   65%     │                 ┃
┃─────────┼───────┼────────┼───────┼───────┼─────┼──────┼────────┼───────────┤                 ┃
┃ Week 40 │ 167   │ 15.2   │6.0min │0.15s  │ 16%✓│  22%✓│  92% ✓ │   70%     │                 ┃
┃─────────┼───────┼────────┼───────┼───────┼─────┼──────┼────────┼───────────┤                 ┃
┃ Week 39 │ 150   │ 10.3↓  │8.5min⚠│0.19s⚠ │ 28%⚠│  52%⚠│  85% ⚠ │   48% ⚠   │                 ┃
┃─────────┼───────┼────────┼───────┼───────┼─────┼──────┼────────┼───────────┤                 ┃
┃ Week 38 │ 150   │ 16.0   │5.5min │0.14s  │ 18% │  26% │  91%   │   67%     │                 ┃
┃─────────┼───────┼────────┼───────┼───────┼─────┼──────┼────────┼───────────┤                 ┃
┃ Week 37 │ 169   │ 14.8   │6.3min │0.16s  │ 19% │  30% │  90%   │   64%     │                 ┃
┃─────────┼───────┼────────┼───────┼───────┼─────┼──────┼────────┼───────────┤                 ┃
┃ PROJ AVG│ 161   │ 14.3   │6.4min │0.16s  │ 19% │  30% │  90%   │   64%     │                 ┃
┃                                                                                                ┃
┃ Column Key: Tok/LOC=Tokens per LOC | LOC/Prmt=LOC per Prompt | RT=Runtime |                   ┃
┃             Leak %=Defect Leakage % | First-Right=First-Time-Right %                           ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ TREND VISUALIZATIONS ━━━━━━━━━━━━━━━━━                                      ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 📊 Stories Delivered per Week                                                            │  ┃
┃ │                                                                                          │  ┃
┃ │  10 │                          ●                                                         │  ┃
┃ │   9 │                          │                                                         │  ┃
┃ │   8 │          ●───────────────┼───────────────●─────────────────────────────           │  ┃
┃ │   7 │          │               │               │               │     ●────●─── Avg 6.5  │  ┃
┃ │   6 │          │       ●───────┼───────────────┼───────●───────●     │    │             │  ┃
┃ │   5 │          │       │       │       ●───────┼───────│───────│─────┼────┼             │  ┃
┃ │   4 │          │       │       │       │   ●───┼───────│───────│─────┼────┼             │  ┃
┃ │     └──────────┴───────┴───────┴───────┴───────┴───────┴───────┴─────┴────┴─────        │  ┃
┃ │         Week37  Week38  Week39  Week40  Week41  Week42  Week43  Week44                   │  ┃
┃ │                                                                                          │  ┃
┃ │ Best Week: Week 40 (9 stories) | Worst Week: Week 39 (4 stories)                        │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 📊 Quality Metrics Trend                                                                 │  ┃
┃ │                                                                                          │  ┃
┃ │  [Chart showing Defects/Story, Defect Leakage %, Code Churn over 8 weeks]               │  ┃
┃ │  • Defects trending down (except Week 42 spike)                                         │  ┃
┃ │  • Defect leakage significantly lower in recent weeks                                   │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ WEEK 44 vs PROJECT AVERAGE ━━━━━━━━━━━━━━━━━                              ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Metric                    │ Week 44  │ Proj Avg │ Difference                            │  ┃
┃ ├───────────────────────────┼──────────┼──────────┼───────────────────────────────────────┤  ┃
┃ │ Stories Delivered         │ 8        │ 6.5      │ +1.5 (+23%) ✓                         │  ┃
┃ │ Avg Tokens per Story      │ 58K      │ 62K      │ -4K (-6%) ✓                           │  ┃
┃ │ Tokens/LOC                │ 136      │ 161      │ -25 (-16%) ✓                          │  ┃
┃ │ LOC/Prompt                │ 16.7     │ 14.3     │ +2.4 (+17%) ✓                         │  ┃
┃ │ Runtime/LOC               │ 5.5 min  │ 6.4 min  │ -0.9 min (-14%) ✓                     │  ┃
┃ │ Runtime/Token             │ 0.14 s   │ 0.16 s   │ -0.02 s (-13%) ✓                      │  ┃
┃ │ Defects per Story         │ 0.6      │ 1.0      │ -0.4 (-40%) ✓                         │  ┃
┃ │ Defect Leakage %          │ 20%      │ 30%      │ -10% (-33%) ✓                         │  ┃
┃ │ Code Churn %              │ 15%      │ 19%      │ -4% (-21%) ✓                          │  ┃
┃ │ Test Coverage %           │ 93%      │ 90%      │ +3% ✓                                 │  ┃
┃ │ First-Time-Right %        │ 72%      │ 64%      │ +8% ✓                                 │  ┃
┃ │ Velocity Score            │ 92/100   │ 82/100   │ +10 points ✓                          │  ┃
┃ ├───────────────────────────┴──────────┴──────────┴───────────────────────────────────────┤  ┃
┃ │ ✓ Overall: Week 44 EXCELLENT - Above average on all metrics                             │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ AI INSIGHTS ━━━━━━━━━━━━━━━━━                                             ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 🤖 WEEK 44 ANALYSIS:                                                                     │  ┃
┃ │                                                                                          │  ┃
┃ │ ✓ EXCELLENT WEEK - Week 44 performed 12% better than project average                    │  ┃
┃ │                                                                                          │  ┃
┃ │ KEY HIGHLIGHTS:                                                                          │  ┃
┃ │ • Story throughput up 23% - delivered 8 stories vs 6.5 avg                              │  ┃
┃ │ • Quality improved significantly - only 0.6 defects/story vs 1.0 avg (40% reduction)    │  ┃
┃ │ • Efficiency gains - used 6% fewer tokens per story despite higher LOC output           │  ┃
┃ │ • Framework consistency at 100% - all stories used full BA+Arch+Dev+QA framework        │  ┃
┃ │                                                                                          │  ┃
┃ │ WEEK 42 ANALYSIS (Mixed Framework Week):                                                │  ┃
┃ │ • Week 42 underperformed (-8% vs avg) when 3 stories used Dev-only framework            │  ┃
┃ │ • Those 3 Dev-only stories had 2.3 defects/story avg vs 0.5 for Full framework          │  ┃
┃ │ • This increased overall week defect rate to 1.2/story                                  │  ┃
┃ │ • Lesson: Medium+ complexity stories benefit from full framework                        │  ┃
┃ │                                                                                          │  ┃
┃ │ RECOMMENDATIONS:                                                                         │  ┃
┃ │ 1. Continue using full framework consistently (as in Week 44)                           │  ┃
┃ │ 2. Week 44's BA Agent performance was exceptional (prevented 3.8 iterations avg)        │  ┃
┃ │ 3. Consider Week 44 as template for optimal week structure                              │  ┃
┃ │                                                                                          │  ┃
┃ │ [View Week 44 Details] [Compare to Week 42] [Export Weekly Report]                      │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Tab 2: Per-Story Execution View

When user clicks on a story (e.g., ST-42):

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                                                ┃
┃ Story ST-42: Implement Password Reset Flow                                                    ┃
┃ Status: Done │ Epic: EP-3 User Authentication │ Complexity: 3 (Medium)                        ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ AGENT EXECUTION TIMELINE (7 total executions) ━━━━━━━━━━━━━━━━━            ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ [1] 👤 BUSINESS ANALYST - Requirements Analysis                                          │  ┃
┃ │     Run ID: run-001                                                                      │  ┃
┃ │                                                                                          │  ┃
┃ │     ⏱️  Started:  2025-11-10 09:00:00                                                    │  ┃
┃ │     ⏹️  Finished: 2025-11-10 09:25:00                                                    │  ┃
┃ │     ⌛ Duration: 25 minutes                                                              │  ┃
┃ │                                                                                          │  ┃
┃ │     📊 Tokens:                                                                           │  ┃
┃ │     • Input:  5,200  ←                                                                   │  ┃
┃ │     • Output: 3,800  →                                                                   │  ┃
┃ │     • Total:  9,000  ═══════════                                                         │  ┃
┃ │                                                                                          │  ┃
┃ │     🔄 Iterations: 6 prompts                                                             │  ┃
┃ │     📝 LOC Generated: 0 (analysis phase - no code)                                       │  ┃
┃ │     ✅ Success: ✓                                                                        │  ┃
┃ │                                                                                          │  ┃
┃ │     📈 Metrics:                                                                          │  ┃
┃ │     • tokens/LOC:     N/A (no code generation)                                           │  ┃
┃ │     • runtime/token:  0.17 sec/token                                                     │  ┃
┃ │     • LOC/prompt:     N/A                                                                │  ┃
┃ │                                                                                          │  ┃
┃ │     📦 Outputs:                                                                          │  ┃
┃ │     • Linked 3 use cases (UC-AUTH-003, UC-EMAIL-001, UC-AUTH-001)                        │  ┃
┃ │     • Refined 8 acceptance criteria                                                      │  ┃
┃ │     • Documented business rules                                                          │  ┃
┃ │                                                                                          │  ┃
┃ │     [View Conversation Log] [View Full Details]                                          │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ [2] 🏗️ ARCHITECT - Technical Assessment #1                                               │  ┃
┃ │     Run ID: run-002                                                                      │  ┃
┃ │                                                                                          │  ┃
┃ │     ⏱️  Started:  2025-11-10 09:30:00                                                    │  ┃
┃ │     ⏹️  Finished: 2025-11-10 09:45:00                                                    │  ┃
┃ │     ⌛ Duration: 15 minutes                                                              │  ┃
┃ │                                                                                          │  ┃
┃ │     📊 Tokens:                                                                           │  ┃
┃ │     • Input:  4,500  ←                                                                   │  ┃
┃ │     • Output: 2,100  →                                                                   │  ┃
┃ │     • Total:  6,600  ═══════                                                             │  ┃
┃ │                                                                                          │  ┃
┃ │     🔄 Iterations: 4 prompts                                                             │  ┃
┃ │     📝 LOC Generated: 0 (design phase - no code)                                         │  ┃
┃ │     ✅ Success: ✓                                                                        │  ┃
┃ │                                                                                          │  ┃
┃ │     📈 Metrics:                                                                          │  ┃
┃ │     • tokens/LOC:     N/A (no code generation)                                           │  ┃
┃ │     • runtime/token:  0.14 sec/token                                                     │  ┃
┃ │     • LOC/prompt:     N/A                                                                │  ┃
┃ │                                                                                          │  ┃
┃ │     📦 Outputs:                                                                          │  ┃
┃ │     • Assessed code health: Authentication component (72/100)                            │  ┃
┃ │     • Identified high-risk file: password-reset.ts                                       │  ┃
┃ │     • Set technical complexity: 3 (Moderate)                                             │  ┃
┃ │                                                                                          │  ┃
┃ │     [View Conversation Log] [View Full Details]                                          │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ [3] 🏗️ ARCHITECT - Code Review & Refinement #2                                           │  ┃
┃ │     Run ID: run-003                                                                      │  ┃
┃ │     ⏱️  Started:  2025-11-10 11:30:00 │ ⏹️  Finished: 11:42:00 │ ⌛ Duration: 12 min     │  ┃
┃ │     📊 Tokens: 3,200 in │ 1,800 out │ 5,000 total                                       │  ┃
┃ │     🔄 Iterations: 3 │ 📝 LOC: 0 │ ✅ Success: ✓                                         │  ┃
┃ │     [View Details]                                                                       │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ [4] 🏗️ ARCHITECT - Final Architecture Validation #3                                      │  ┃
┃ │     Run ID: run-004                                                                      │  ┃
┃ │     ⏱️  Started:  2025-11-10 14:15:00 │ ⏹️  Finished: 14:28:00 │ ⌛ Duration: 13 min     │  ┃
┃ │     📊 Tokens: 2,800 in │ 1,500 out │ 4,300 total                                       │  ┃
┃ │     🔄 Iterations: 2 │ 📝 LOC: 0 │ ✅ Success: ✓                                         │  ┃
┃ │     [View Details]                                                                       │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ [5] 💻 DEVELOPER - Backend Implementation                                                │  ┃
┃ │     Run ID: run-005                                                                      │  ┃
┃ │                                                                                          │  ┃
┃ │     ⏱️  Started:  2025-11-10 10:00:00                                                    │  ┃
┃ │     ⏹️  Finished: 2025-11-10 10:45:00                                                    │  ┃
┃ │     ⌛ Duration: 45 minutes                                                              │  ┃
┃ │                                                                                          │  ┃
┃ │     📊 Tokens:                                                                           │  ┃
┃ │     • Input:  15,000 ←                                                                   │  ┃
┃ │     • Output:  8,500 →                                                                   │  ┃
┃ │     • Total:  23,500 ══════════════════════════                                          │  ┃
┃ │                                                                                          │  ┃
┃ │     🔄 Iterations: 12 prompts                                                            │  ┃
┃ │     📝 LOC Generated: 285 lines  ✓                                                       │  ┃
┃ │     ✅ Success: ✓                                                                        │  ┃
┃ │                                                                                          │  ┃
┃ │     📈 Metrics:                                                                          │  ┃
┃ │     • tokens/LOC:     82.5 tokens/line  (✓ efficient)                                    │  ┃
┃ │     • LOC/prompt:     23.8 lines/prompt (✓ productive)                                   │  ┃
┃ │     • runtime/LOC:    9.5 sec/line                                                       │  ┃
┃ │     • runtime/token:  0.11 sec/token                                                     │  ┃
┃ │                                                                                          │  ┃
┃ │     📂 Commits: abc123, def456                                                           │  ┃
┃ │     📄 Files Modified:                                                                   │  ┃
┃ │     • src/auth/reset-password.ts (+245 LOC)                                              │  ┃
┃ │     • src/email/templates.ts (+40 LOC)                                                   │  ┃
┃ │                                                                                          │  ┃
┃ │     [View Conversation Log] [View Commits] [View Full Details]                           │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ [6] 💻 DEVELOPER - Frontend Implementation                                               │  ┃
┃ │     Run ID: run-006                                                                      │  ┃
┃ │     ⏱️  Started:  2025-11-10 13:00:00 │ ⏹️  Finished: 13:38:00 │ ⌛ Duration: 38 min     │  ┃
┃ │     📊 Tokens: 12,000 in │ 7,200 out │ 19,200 total                                     │  ┃
┃ │     🔄 Iterations: 10 │ 📝 LOC: 198 lines │ ✅ Success: ✓                                │  ┃
┃ │     📈 Metrics: 97.0 tokens/LOC │ 19.8 LOC/prompt │ 11.5 sec/LOC                        │  ┃
┃ │     📂 Commits: ghi789                                                                   │  ┃
┃ │     📄 Files: src/components/PasswordResetForm.tsx (+198 LOC)                            │  ┃
┃ │     [View Details]                                                                       │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ [7] 🧪 QA TESTER - Validation                                                            │  ┃
┃ │     Run ID: run-007                                                                      │  ┃
┃ │     ⏱️  Started:  2025-11-10 15:00:00 │ ⏹️  Finished: 15:20:00 │ ⌛ Duration: 20 min     │  ┃
┃ │     📊 Tokens: 4,000 in │ 2,500 out │ 6,500 total                                       │  ┃
┃ │     🔄 Iterations: 5 │ 📝 LOC: 87 lines (tests) │ ✅ Success: ✓                          │  ┃
┃ │     📈 Metrics: 74.7 tokens/LOC │ 17.4 LOC/prompt │ 13.8 sec/LOC                        │  ┃
┃ │     📂 Commits: jkl012                                                                   │  ┃
┃ │     📄 Files: tests/auth/reset-password.test.ts (+87 LOC)                                │  ┃
┃ │     [View Details]                                                                       │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ STORY-LEVEL SUMMARY ━━━━━━━━━━━━━━━━━                                     ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Total Executions: 7                                                                      │  ┃
┃ │ • BA: 1 run                                                                              │  ┃
┃ │ • Architect: 3 runs (multiple iterations for design refinement)                          │  ┃
┃ │ • Developer: 2 runs (backend + frontend)                                                 │  ┃
┃ │ • QA: 1 run                                                                              │  ┃
┃ │                                                                                          │  ┃
┃ │ Total Time: 2 hours 48 minutes                                                           │  ┃
┃ │ Total Tokens: 74,100                                                                     │  ┃
┃ │ • Input:  46,700 (63%)                                                                   │  ┃
┃ │ • Output: 27,400 (37%)                                                                   │  ┃
┃ │                                                                                          │  ┃
┃ │ Total LOC: 570 lines                                                                     │  ┃
┃ │ Total Iterations: 42 prompts                                                             │  ┃
┃ │                                                                                          │  ┃
┃ │ Aggregate Metrics:                                                                       │  ┃
┃ │ • tokens/LOC:     130.0 tokens/line (all agents)                                         │  ┃
┃ │ • LOC/prompt:     13.6 lines/prompt (code agents only)                                   │  ┃
┃ │ • runtime/LOC:    17.7 sec/line                                                          │  ┃
┃ │ • runtime/token:  0.14 sec/token                                                         │  ┃
┃ │                                                                                          │  ┃
┃ │ Cost Estimate: $7.41 (based on current token rates)                                      │  ┃
┃ │                                                                                          │  ┃
┃ │ [Export Execution Report] [View Timeline Visualization]                                  │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Tab 3: Per-Agent Analytics View

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ PER-AGENT EFFICIENCY METRICS ━━━━━━━━━━━━━━━━━                             ┃
┃ Comparing: BA+Arch+Dev+QA vs Dev-only | Complexity Band: Medium (3) | Stories: 42 vs 38       ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 👤 BUSINESS ANALYST                                                                      │  ┃
┃ ├──────────────────────────────────────────────────────────────────────────────────────────┤  ┃
┃ │ Metric                │ BA+Arch+Dev+QA       │ Dev-only         │ Delta                 │  ┃
┃ ├───────────────────────┼──────────────────────┼──────────────────┼───────────────────────┤  ┃
┃ │ tokens/LOC            │ N/A (no code)        │ N/A              │ -                     │  ┃
┃ │ runtime/token         │ 0.16 sec/token       │ N/A              │ -                     │  ┃
┃ │ Avg tokens per run    │ 9,000 tokens         │ N/A              │ -                     │  ┃
┃ │ Avg runtime per run   │ 24 minutes           │ N/A              │ -                     │  ┃
┃ │ Runs per story        │ 1.0 run              │ 0 (not used)     │ -                     │  ┃
┃ │                       │                      │                  │                       │  ┃
┃ │ Value Add:            │ Reduces developer iterations by 40% (25 → 15 prompts)           │  ┃
┃ │                       │ Links use cases, clarifies requirements                          │  ┃
┃ └───────────────────────┴──────────────────────┴──────────────────┴───────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 🏗️ ARCHITECT                                                                              │  ┃
┃ ├──────────────────────────────────────────────────────────────────────────────────────────┤  ┃
┃ │ Metric                │ BA+Arch+Dev+QA       │ Dev-only         │ Delta                 │  ┃
┃ ├───────────────────────┼──────────────────────┼──────────────────┼───────────────────────┤  ┃
┃ │ tokens/LOC            │ N/A (no code)        │ N/A              │ -                     │  ┃
┃ │ runtime/token         │ 0.15 sec/token       │ N/A              │ -                     │  ┃
┃ │ Avg tokens per run    │ 6,200 tokens         │ N/A              │ -                     │  ┃
┃ │ Avg runtime per run   │ 15 minutes           │ N/A              │ -                     │  ┃
┃ │ Runs per story        │ 3.0 runs (avg)       │ 0 (not used)     │ -                     │  ┃
┃ │                       │                      │                  │                       │  ┃
┃ │ Value Add:            │ Prevents 2.1 defects per story on average                        │  ┃
┃ │                       │ Assesses code health, identifies risks before implementation     │  ┃
┃ └───────────────────────┴──────────────────────┴──────────────────┴───────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 💻 DEVELOPER                                                                             │  ┃
┃ ├──────────────────────────────────────────────────────────────────────────────────────────┤  ┃
┃ │ Metric                │ BA+Arch+Dev+QA       │ Dev-only         │ Delta                 │  ┃
┃ ├───────────────────────┼──────────────────────┼──────────────────┼───────────────────────┤  ┃
┃ │ tokens/LOC            │ 89.5 tokens/line     │ 125.0 tokens/line│ ✓ 28% better          │  ┃
┃ │ LOC/prompt            │ 20.5 lines/prompt    │ 15.2 lines/prompt│ ✓ 35% more productive │  ┃
┃ │ runtime/LOC           │ 10.2 sec/line        │ 14.8 sec/line    │ ✓ 31% faster          │  ┃
┃ │ runtime/token         │ 0.11 sec/token       │ 0.12 sec/token   │ ✓ 8% faster           │  ┃
┃ │ Avg tokens per run    │ 24,000 tokens        │ 42,000 tokens    │ ✓ 43% fewer           │  ┃
┃ │ Avg runtime per run   │ 44 minutes           │ 88 minutes       │ ✓ 50% faster          │  ┃
┃ │ Runs per story        │ 2.0 runs             │ 4.5 runs         │ ✓ 56% fewer (rework!) │  ┃
┃ │                       │                      │                  │                       │  ┃
┃ │ Analysis:             │ BA+Arch prep reduces ambiguity & complexity → cleaner impl      │  ┃
┃ │                       │ Dev-only requires 2.25× more runs due to rework & iteration     │  ┃
┃ └───────────────────────┴──────────────────────┴──────────────────┴───────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 🧪 QA TESTER                                                                             │  ┃
┃ ├──────────────────────────────────────────────────────────────────────────────────────────┤  ┃
┃ │ Metric                │ BA+Arch+Dev+QA       │ Dev-only         │ Delta                 │  ┃
┃ ├───────────────────────┼──────────────────────┼──────────────────┼───────────────────────┤  ┃
┃ │ tokens/LOC            │ 75.0 tokens/line     │ N/A              │ -                     │  ┃
┃ │ LOC/prompt            │ 17.5 lines/prompt    │ N/A              │ -                     │  ┃
┃ │ runtime/LOC           │ 13.5 sec/line        │ N/A              │ -                     │  ┃
┃ │ runtime/token         │ 0.18 sec/token       │ N/A              │ -                     │  ┃
┃ │ Avg tokens per run    │ 6,500 tokens         │ N/A              │ -                     │  ┃
┃ │ Avg runtime per run   │ 20 minutes           │ N/A              │ -                     │  ┃
┃ │ Runs per story        │ 1.0 run              │ 0 (not used)     │ -                     │  ┃
┃ │                       │                      │                  │                       │  ┃
┃ │ Value Add:            │ Catches 85% of defects before production                         │  ┃
┃ │                       │ Reduces defect leakage from 45% to 12%                           │  ┃
┃ └───────────────────────┴──────────────────────┴──────────────────┴───────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ TOTAL STORY COST COMPARISON ━━━━━━━━━━━━━━━━━                              ┃
┃                                                                                                ┃
┃ ┌───────────────────────────────────────────────┬────────────────┬─────────────────────────┐  ┃
┃ │ BA+Arch+Dev+QA Framework                      │ Dev-only       │ Winner                  │  ┃
┃ ├───────────────────────────────────────────────┼────────────────┼─────────────────────────┤  ┃
┃ │ Cost per story: $6.20                         │ $4.50          │ Dev initially cheaper   │  ┃
┃ │ • BA:    $0.90                                │ $0.00          │                         │  ┃
┃ │ • Arch:  $0.85 (3 runs avg)                   │ $0.00          │                         │  ┃
┃ │ • Dev:   $3.60 (2 runs avg)                   │ $4.50 (4.5 run)│                         │  ┃
┃ │ • QA:    $0.85                                │ $0.00          │                         │  ┃
┃ │                                               │                │                         │  ┃
┃ │ Total runtime: 118 minutes                    │ 396 minutes    │ Full 70% faster         │  ┃
┃ │ Defects per story: 0.8                        │ 2.3            │ Full 65% fewer          │  ┃
┃ │ Rework cost: $0.95                            │ $2.80          │ Full 66% less           │  ┃
┃ │                                               │                │                         │  ┃
┃ │ NET COST (including rework): $6.20            │ $7.30          │ Full 15% cheaper ✓      │  ┃
┃ └───────────────────────────────────────────────┴────────────────┴─────────────────────────┘  ┃
┃                                                                                                ┃
┃ 💡 RECOMMENDATION: Use BA+Arch+Dev+QA for medium+ complexity stories                           ┃
┃ Higher upfront cost ($6.20 vs $4.50) but lower total cost due to reduced rework ($0.95 vs $2.80)┃
┃                                                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Key Features & Interactions

### 1. Multi-Dimensional Analysis
- **Framework Comparison**: Side-by-side metrics for different agentic setups
- **Per-Story Drill-Down**: See every agent execution for a story
- **Per-Agent Analytics**: Understand individual agent contribution

### 2. Automatic Data Collection
- **MCP Integration**: All metrics logged via `log_run` tool automatically
- **LOC Calculation**: Extracted from Git commits automatically
- **No Manual Entry**: Zero developer interruption

### 3. Fair Comparison
- **Complexity Band Filtering**: Compare apples-to-apples
- **Statistical Validity**: Warns when sample size < 5 stories
- **Normalized Metrics**: Account for story size/complexity

### 4. Actionable Insights
- **AI Analysis**: Automatic insight generation
- **ROI Calculation**: Show cost/benefit of each agent role
- **Recommendations**: Data-driven framework selection

### 5. Export & Reporting
- **PDF Export**: Professional reports for stakeholders
- **CSV Export**: Raw data for analysis
- **Scheduled Reports**: Weekly/monthly automated emails

---

## Data Collection Flow

```
Story Assignment
      ↓
  Agent Starts
      ↓
  MCP: log_run (start)
      ↓
  Agent Works (tokens counted automatically)
      ↓
  Agent Commits Code
      ↓
  Git Hook: link_commit
      ↓
  Background Worker: Calculate LOC
      ↓
  MCP: log_run (finish)
      ↓
  Metrics Auto-Calculated:
  • tokens/LOC = total_tokens / loc_generated
  • LOC/prompt = loc_generated / iterations
  • runtime/LOC = duration / loc_generated
  • runtime/token = duration / total_tokens
      ↓
  Dashboard Updates (real-time)
```

---

## Design Principles

1. **Data-Driven**: Every insight backed by hard metrics
2. **Fair Comparison**: Always normalize by complexity
3. **Automatic**: Zero manual data entry
4. **Actionable**: Show ROI and recommendations
5. **Transparent**: Drill down to raw execution logs
6. **Real-time**: Live updates as stories complete

---

## Calculation Examples

**Risk Score**: `complexity × churn × (1 - coverage/100)`
- File with complexity 24, churn 8×, coverage 65%
- Risk = 24 × 8 × (1 - 0.65) = 24 × 8 × 0.35 = 67.2

**Token Efficiency**: `output_tokens / input_tokens`
- Input: 5,200, Output: 3,800
- Efficiency = 3,800 / 5,200 = 0.73

**Net Cost**: `upfront_cost + rework_cost`
- Full: $6.20 + $0.95 = $7.15
- Dev-only: $4.50 + $2.80 = $7.30
