# Code Quality View - Text-Based Design

> **Based on**: UC-ARCH-002 (Code Quality Dashboard), UC-ARCH-004 (Query Code Health by Component)
> **Primary Users**: Architect, Tech Lead, Developer

---

## Screen Layout Overview

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ AI STUDIO - Code Quality Dashboard                                   👤 User ▼ ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📊 Dashboard │ 📋 Planning │ 📈 Metrics │ 🎯 Use Cases │ 🧪 Test Cases       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                 ┃
┃ Project: AI Studio MCP Control Plane                           Last Update: 2h ┃
┃                                                                                 ┃
┃ ┌────────────────────────────────────────────────────────────────────────────┐ ┃
┃ │ Filters:                                                        🔍 Search   │ ┃
┃ │ Time Range: [Last 30 days ▼]  Layer: [All ▼]  Component: [All ▼]          │ ┃
┃ │ Language: [All ▼]  Epic/Story: [All ▼]                                     │ ┃
┃ └────────────────────────────────────────────────────────────────────────────┘ ┃
┃                                                                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Main Dashboard View

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ PROJECT-LEVEL METRICS ━━━━━━━━━━━━━━━━━                                   ┃
┃                                                                                                ┃
┃ ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐        ┃
┃ │  OVERALL CODE HEALTH    │  │   TOTAL LINES OF CODE   │  │   TEST COVERAGE         │        ┃
┃ │                         │  │                         │  │                         │        ┃
┃ │         78/100          │  │       42,350 LOC        │  │         87%             │        ┃
┃ │  ███████████░░░░        │  │                         │  │  ████████████████░░░    │        ┃
┃ │    GOOD                 │  │  TypeScript:  28,450    │  │         ✓ GOOD          │        ┃
┃ │                         │  │  Python:      10,200    │  │                         │        ┃
┃ │  ↑ +3 (this week)       │  │  SQL:          3,700    │  │  ↑ +2% (this week)      │        ┃
┃ └─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘        ┃
┃                                                                                                ┃
┃ ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐        ┃
┃ │  TECHNICAL DEBT RATIO   │  │    CODE COMPLEXITY      │  │   SECURITY ISSUES       │        ┃
┃ │                         │  │                         │  │                         │        ┃
┃ │         8.2%            │  │     Avg: 6.5 / Max: 24  │  │  🔴 Critical:  2        │        ┃
┃ │  ████░░░░░░░░░░░        │  │  ██████░░░░░░░░░        │  │  ⚠️  High:      5        │        ┃
┃ │    ACCEPTABLE           │  │     MODERATE            │  │  ⚠️  Medium:    12       │        ┃
┃ │                         │  │                         │  │  ℹ️  Low:       23       │        ┃
┃ │  → -0.5% (this week)    │  │  ↑ +1.2 (this week)     │  │                         │        ┃
┃ └─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘        ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ TREND CHARTS ━━━━━━━━━━━━━━━━━                                            ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ CODE HEALTH TREND (Last 30 days)                                                         │  ┃
┃ │                                                                                          │  ┃
┃ │ 100┤                                                                                     │  ┃
┃ │  90┤                                              ┌──┬──┬──                             │  ┃
┃ │  80┤                      ┌──┬──┬──┬──┬──┬──┬──┘  │  │  │                             │  ┃
┃ │  70┤          ┌──┬──┬──┬──┘  │  │  │  │  │  │     │  │  │                             │  ┃
┃ │  60┤  ┌──┬──┬──┘  │  │  │     │  │  │  │  │  │     │  │  │                             │  ┃
┃ │  50┤──┘  │  │     │  │  │     │  │  │  │  │  │     │  │  └──                          │  ┃
┃ │    └───────────────────────────────────────────────────────────────                     │  ┃
┃ │    Oct 10    Oct 17    Oct 24    Oct 31    Nov 7     Nov 14                            │  ┃
┃ │                                                                                          │  ┃
┃ │ ━ Overall Health  ━ Coverage  ━ Complexity  ━ Tech Debt                                │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ LAYER-LEVEL METRICS ━━━━━━━━━━━━━━━━━                                     ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Layer          │ LOC    │ Health │ Complexity │ Churn  │ Coverage │ Defects │ Action   │  ┃
┃ ├────────────────┼────────┼────────┼────────────┼────────┼──────────┼─────────┼──────────┤  ┃
┃ │ Frontend       │ 18,200 │ 82/100 │ 5.8        │ Medium │ 85%      │ 8       │ [Drill]  │  ┃
┃ │                │  (43%) │ ████░  │ ██████░░░  │ ⚠️     │ ████░    │ ⚠️      │          │  ┃
┃ ├────────────────┼────────┼────────┼────────────┼────────┼──────────┼─────────┼──────────┤  ┃
┃ │ Backend/API    │ 15,800 │ 72/100 │ 7.2        │ High   │ 90%      │ 12      │ [Drill]  │  ┃
┃ │                │  (37%) │ ███░░  │ ███████░░  │ 🔴     │ █████    │ 🔴      │          │  ┃
┃ ├────────────────┼────────┼────────┼────────────┼────────┼──────────┼─────────┼──────────┤  ┃
┃ │ Infrastructure │  4,850 │ 88/100 │ 4.2        │ Low    │ 78%      │ 2       │ [Drill]  │  ┃
┃ │                │  (11%) │ █████  │ ████░░░░   │ ✓      │ ███░     │ ✓       │          │  ┃
┃ ├────────────────┼────────┼────────┼────────────┼────────┼──────────┼─────────┼──────────┤  ┃
┃ │ Tests          │  3,500 │ 92/100 │ 3.5        │ Medium │ N/A      │ 0       │ [Drill]  │  ┃
┃ │                │   (8%) │ █████  │ ███░░░░░   │ ⚠️     │ ─        │ ✓       │          │  ┃
┃ └────────────────┴────────┴────────┴────────────┴────────┴──────────┴─────────┴──────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ COMPONENT-LEVEL METRICS ━━━━━━━━━━━━━━━━━                                 ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Component        │ Health │ Complexity │ Churn │ Coverage │ Hotspots │ Action           │  ┃
┃ ├──────────────────┼────────┼────────────┼───────┼──────────┼──────────┼──────────────────┤  ┃
┃ │ Authentication   │ 72/100 │ 8.5        │ High  │ 78%      │ 🔥🔥🔥   │ [Drill] [Refactor│  ┃
┃ │ 🏷️ Backend/API   │ ███░░  │ ████████░  │ 🔴    │ ███░     │          │  Story]          │  ┃
┃ │ 12 files         │        │            │       │          │          │                  │  ┃
┃ ├──────────────────┼────────┼────────────┼───────┼──────────┼──────────┼──────────────────┤  ┃
┃ │ User Management  │ 85/100 │ 5.2        │ Low   │ 92%      │ ─        │ [Drill]          │  ┃
┃ │ 🏷️ Backend/API   │ ████░  │ █████░░░   │ ✓     │ █████    │          │                  │  ┃
┃ │ 8 files          │        │            │       │          │          │                  │  ┃
┃ ├──────────────────┼────────┼────────────┼───────┼──────────┼──────────┼──────────────────┤  ┃
┃ │ Email Service    │ 80/100 │ 6.0        │ Medium│ 85%      │ 🔥       │ [Drill]          │  ┃
┃ │ 🏷️ Integration   │ ████░  │ ██████░░   │ ⚠️    │ ████░    │          │                  │  ┃
┃ │ 5 files          │        │            │       │          │          │                  │  ┃
┃ ├──────────────────┼────────┼────────────┼───────┼──────────┼──────────┼──────────────────┤  ┃
┃ │ API Gateway      │ 68/100 │ 9.2        │ High  │ 72%      │ 🔥🔥     │ [Drill] [Refactor│  ┃
┃ │ 🏷️ Backend/API   │ ███░░  │ █████████  │ 🔴    │ ███░     │          │  Story]          │  ┃
┃ │ 15 files         │        │            │       │          │          │                  │  ┃
┃ ├──────────────────┼────────┼────────────┼───────┼──────────┼──────────┼──────────────────┤  ┃
┃ │ Search           │ 90/100 │ 4.5        │ Low   │ 95%      │ ─        │ [Drill]          │  ┃
┃ │ 🏷️ Backend/API   │ █████  │ ████░░░░   │ ✓     │ █████    │          │                  │  ┃
┃ │ 6 files          │        │            │       │          │          │                  │  ┃
┃ └──────────────────┴────────┴────────────┴───────┴──────────┴──────────┴──────────────────┘  ┃
┃                                                                                      [View All]┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ FILE-LEVEL HOTSPOTS (Top 10 by Risk) ━━━━━━━━━━━━━━━━━                    ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Rank │ File                               │ Risk  │ Complex │ Churn │ Cover │ Action   │  ┃
┃ ├──────┼────────────────────────────────────┼───────┼─────────┼───────┼───────┼──────────┤  ┃
┃ │ 🔥 1 │ src/auth/password-reset.ts         │ 89/100│ 24      │ 8×    │ 65%   │ [View]   │  ┃
┃ │      │ Authentication                     │ 🔴    │ 🔴      │ 🔴    │ ⚠️    │ [Refactor│  ┃
┃ │      │ 342 LOC │ Last: 3d ago (ST-38)     │       │         │       │       │  Story]  │  ┃
┃ ├──────┼────────────────────────────────────┼───────┼─────────┼───────┼───────┼──────────┤  ┃
┃ │ 🔥 2 │ src/api/gateway/rate-limiter.ts    │ 82/100│ 18      │ 6×    │ 70%   │ [View]   │  ┃
┃ │      │ API Gateway                        │ 🔴    │ 🔴      │ 🔴    │ ⚠️    │ [Refactor│  ┃
┃ │      │ 285 LOC │ Last: 5d ago (ST-45)     │       │         │       │       │  Story]  │  ┃
┃ ├──────┼────────────────────────────────────┼───────┼─────────┼───────┼───────┼──────────┤  ┃
┃ │ 🔥 3 │ src/auth/session-manager.ts        │ 67/100│ 18      │ 4×    │ 72%   │ [View]   │  ┃
┃ │      │ Authentication                     │ ⚠️    │ 🔴      │ ⚠️    │ ⚠️    │ [Refactor│  ┃
┃ │      │ 410 LOC │ Last: 7d ago (ST-42)     │       │         │       │       │  Story]  │  ┃
┃ ├──────┼────────────────────────────────────┼───────┼─────────┼───────┼───────┼──────────┤  ┃
┃ │ ⚠️ 4 │ src/auth/token-validator.ts        │ 58/100│ 15      │ 5×    │ 80%   │ [View]   │  ┃
┃ │      │ Authentication                     │ ⚠️    │ ⚠️      │ 🔴    │ ✓     │          │  ┃
┃ │      │ 198 LOC │ Last: 4d ago (ST-35)     │       │         │       │       │          │  ┃
┃ ├──────┼────────────────────────────────────┼───────┼─────────┼───────┼───────┼──────────┤  ┃
┃ │ ⚠️ 5 │ src/email/template-engine.ts       │ 52/100│ 12      │ 3×    │ 75%   │ [View]   │  ┃
┃ │      │ Email Service                      │ ⚠️    │ ⚠️      │ ⚠️    │ ⚠️    │          │  ┃
┃ │      │ 324 LOC │ Last: 10d ago (ST-28)    │       │         │       │       │          │  ┃
┃ └──────┴────────────────────────────────────┴───────┴─────────┴───────┴───────┴──────────┘  ┃
┃                                                                                      [View All]┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ CODE SMELLS & ISSUES ━━━━━━━━━━━━━━━━━                                     ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Severity  │ Type                    │ Count │ Files Affected │ Action                    │  ┃
┃ ├───────────┼─────────────────────────┼───────┼────────────────┼───────────────────────────┤  ┃
┃ │ 🔴 Critical│ Security Vulnerabilities│   2   │ 2 files        │ [View All] [Create Story] │  ┃
┃ │ ⚠️  High   │ Bug Risks               │   5   │ 5 files        │ [View All] [Create Story] │  ┃
┃ │ ⚠️  High   │ Performance Issues      │   3   │ 3 files        │ [View All]                │  ┃
┃ │ ⚠️  Medium │ Code Duplication        │  12   │ 18 files       │ [View All] [Create Story] │  ┃
┃ │ ⚠️  Medium │ Maintainability Issues  │  15   │ 12 files       │ [View All]                │  ┃
┃ │ ℹ️  Low    │ Code Style Issues       │  23   │ 20 files       │ [View All]                │  ┃
┃ └───────────┴─────────────────────────┴───────┴────────────────┴───────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ AI-POWERED INSIGHTS ━━━━━━━━━━━━━━━━━                                      ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 🤖 Insights (Last 7 days):                                                               │  ┃
┃ │                                                                                          │  ┃
┃ │ • Authentication component has 3× higher churn than average - consider refactoring      │  ┃
┃ │ • Test coverage dropped 5% in Backend/API layer - 8 new files lacking tests             │  ┃
┃ │ • 5 files have critical security issues - immediate attention required                   │  ┃
┃ │ • password-reset.ts is a HIGH RISK hotspot - complexity 24, coverage 65%                │  ┃
┃ │ • Recommended: Create refactoring story for Authentication module                        │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Component Drill-Down View

When user clicks "Drill" on Authentication component:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ← Back to Dashboard                                                                           ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                                ┃
┃ AUTHENTICATION COMPONENT - CODE HEALTH SUMMARY                                                 ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ HEALTH OVERVIEW ━━━━━━━━━━━━━━━━━                                          ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │                                                                                          │  ┃
┃ │ Overall Health Score: 72/100  ███████░░░  ⚠️ MODERATE                                   │  ┃
┃ │                                                                                          │  ┃
┃ │ ──────── KEY METRICS ────────                                                           │  ┃
┃ │                                                                                          │  ┃
┃ │ Code Complexity:       High  ⚠️                                                          │  ┃
┃ │ • Average Complexity:  8.5 (threshold: 10)                                              │  ┃
┃ │ • Max Complexity:      24 (src/auth/password-reset.ts)                                  │  ┃
┃ │                                                                                          │  ┃
┃ │ Test Coverage:         78%  ███████░░░  ⚠️                                               │  ┃
┃ │ • Unit Tests:          85%  (24 tests)                                                  │  ┃
┃ │ • Integration Tests:   70%  (12 tests)                                                  │  ┃
┃ │ • E2E Tests:           80%  (6 tests)                                                   │  ┃
┃ │                                                                                          │  ┃
┃ │ Code Churn (30 days):  High  ⚠️                                                          │  ┃
┃ │ • Files Modified:      12 files                                                         │  ┃
┃ │ • Change Frequency:    3.2 changes/file                                                 │  ┃
┃ │ • Most Changed:        password-reset.ts (8 changes)                                    │  ┃
┃ │                                                                                          │  ┃
┃ │ Technical Debt:        Moderate  ⚠️                                                      │  ┃
┃ │ • Code Smells:         8 issues                                                         │  ┃
┃ │ • Duplication:         12% (450 duplicated lines)                                       │  ┃
┃ │ • Maintainability:     C rating                                                         │  ┃
┃ │                                                                                          │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ HOTSPOTS (3 files) ━━━━━━━━━━━━━━━━━                                       ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 🔥 src/auth/password-reset.ts                                                            │  ┃
┃ │    Complexity: 24 │ Churn: 8× │ Coverage: 65% │ LOC: 342                                 │  ┃
┃ │    Risk Score: 89/100  ⚠️ HIGH RISK                                                      │  ┃
┃ │    Last Modified: 3 days ago (ST-38)                                                     │  ┃
┃ │                                                                                          │  ┃
┃ │    Critical Issues:                                                                      │  ┃
┃ │    🔴 Security: Hardcoded secret in line 145                                             │  ┃
┃ │    🔴 Bug Risk: Unchecked null pointer in line 203                                       │  ┃
┃ │    ⚠️  Complexity: handlePasswordReset() function too complex (CC: 18)                   │  ┃
┃ │                                                                                          │  ┃
┃ │    [View File Details] [View Source] [Create Refactor Story]                            │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 🔥 src/auth/session-manager.ts                                                           │  ┃
┃ │    Complexity: 18 │ Churn: 4× │ Coverage: 72% │ LOC: 410                                 │  ┃
┃ │    Risk Score: 67/100  ⚠️ MODERATE RISK                                                  │  ┃
┃ │    Last Modified: 7 days ago (ST-42)                                                     │  ┃
┃ │                                                                                          │  ┃
┃ │    Issues:                                                                               │  ┃
┃ │    ⚠️  Duplication: 15 lines duplicated in password-reset.ts                             │  ┃
┃ │    ⚠️  Complexity: createSession() function complexity: 12                               │  ┃
┃ │                                                                                          │  ┃
┃ │    [View File Details] [View Source]                                                     │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 🔥 src/auth/token-validator.ts                                                           │  ┃
┃ │    Complexity: 15 │ Churn: 5× │ Coverage: 80% │ LOC: 198                                 │  ┃
┃ │    Risk Score: 58/100  ⚠️ MODERATE RISK                                                  │  ┃
┃ │    Last Modified: 4 days ago (ST-35)                                                     │  ┃
┃ │                                                                                          │  ┃
┃ │    Issues:                                                                               │  ┃
┃ │    ⚠️  High Churn: Modified 5 times in last 30 days                                      │  ┃
┃ │                                                                                          │  ┃
┃ │    [View File Details] [View Source]                                                     │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ ALL FILES (12 total) ━━━━━━━━━━━━━━━━━                                     ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ File                           │ LOC │ Complex │ Churn │ Cover │ Health │ Action        │  ┃
┃ ├────────────────────────────────┼─────┼─────────┼───────┼───────┼────────┼───────────────┤  ┃
┃ │ password-reset.ts              │ 342 │ 24 🔴   │ 8× 🔴 │ 65% ⚠️│ 45/100 │ [View] [Refac]│  ┃
┃ │ session-manager.ts             │ 410 │ 18 🔴   │ 4× ⚠️ │ 72% ⚠️│ 62/100 │ [View]        │  ┃
┃ │ token-validator.ts             │ 198 │ 15 ⚠️   │ 5× 🔴 │ 80% ✓ │ 68/100 │ [View]        │  ┃
┃ │ auth-middleware.ts             │ 156 │ 8 ✓     │ 2× ✓  │ 88% ✓ │ 85/100 │ [View]        │  ┃
┃ │ login-handler.ts               │ 245 │ 10 ⚠️   │ 3× ⚠️ │ 92% ✓ │ 78/100 │ [View]        │  ┃
┃ │ logout-handler.ts              │ 98  │ 5 ✓     │ 1× ✓  │ 95% ✓ │ 92/100 │ [View]        │  ┃
┃ │ oauth-provider.ts              │ 312 │ 12 ⚠️   │ 2× ✓  │ 75% ⚠️│ 72/100 │ [View]        │  ┃
┃ │ 2fa-authenticator.ts           │ 189 │ 9 ✓     │ 1× ✓  │ 85% ✓ │ 82/100 │ [View]        │  ┃
┃ │ user-credentials.ts            │ 125 │ 6 ✓     │ 2× ✓  │ 90% ✓ │ 88/100 │ [View]        │  ┃
┃ │ auth-config.ts                 │ 78  │ 2 ✓     │ 1× ✓  │ 100% ✓│ 98/100 │ [View]        │  ┃
┃ │ auth-utils.ts                  │ 142 │ 7 ✓     │ 2× ✓  │ 88% ✓ │ 85/100 │ [View]        │  ┃
┃ │ auth-types.ts                  │ 52  │ 1 ✓     │ 1× ✓  │ N/A   │ 95/100 │ [View]        │  ┃
┃ └────────────────────────────────┴─────┴─────────┴───────┴───────┴────────┴───────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ RECOMMENDATIONS ━━━━━━━━━━━━━━━━━                                          ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 🤖 AI Recommendations:                                                                    │  ┃
┃ │                                                                                          │  ┃
┃ │ 🚨 CRITICAL: Fix security issue in password-reset.ts (hardcoded secret) - IMMEDIATE     │  ┃
┃ │ 🚨 CRITICAL: Add null check at line 203 in password-reset.ts                            │  ┃
┃ │ 💡 HIGH PRIORITY: Refactor password-reset.ts before making changes                       │  ┃
┃ │    • Extract handlePasswordReset() into smaller functions                               │  ┃
┃ │    • Target: Reduce complexity from 24 to <10                                           │  ┃
┃ │    • Estimated Effort: Medium (2-3 days)                                                 │  ┃
┃ │ 💡 Increase test coverage for password-reset.ts to 80%+                                  │  ┃
┃ │ 💡 Extract duplicated logic between password-reset.ts and session-manager.ts             │  ┃
┃ │ 📋 Review high churn files - may indicate unclear requirements                           │  ┃
┃ │                                                                                          │  ┃
┃ │ [Create Refactor Story] [Schedule Review] [Export Report]                               │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## File Detail View

When user clicks "View File Details" on password-reset.ts:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ← Back to Authentication Component                                                            ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                                ┃
┃ FILE: src/auth/password-reset.ts                                                               ┃
┃ Component: Authentication │ Layer: Backend/API │ Language: TypeScript                          ┃
┃                                                                                                ┃
┃ Risk Score: 89/100  🔥 HIGH RISK                                                              ┃
┃ Lines of Code: 342                                                                             ┃
┃ Last Modified: 3 days ago (ST-38: Add token expiration logic)                                  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ COMPLEXITY ANALYSIS ━━━━━━━━━━━━━━━━━                                      ┃
┃                                                                                                ┃
┃ Cyclomatic Complexity: 24  ⚠️ VERY HIGH (max: 10)                                             ┃
┃ Cognitive Complexity:  32  ⚠️ VERY HIGH                                                        ┃
┃ Maintainability Index: 42  ⚠️ LOW (target: >65)                                                ┃
┃                                                                                                ┃
┃ Functions by Complexity:                                                                       ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ handlePasswordReset()      Complexity: 18  🔥 HIGH          [View Details]            │    ┃
┃ │ validateResetToken()       Complexity: 12  ⚠️ MEDIUM        [View Details]            │    ┃
┃ │ generateResetLink()        Complexity: 8   ✓ OK             [View Details]            │    ┃
┃ │ sendResetEmail()           Complexity: 6   ✓ OK             [View Details]            │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ TEST COVERAGE ━━━━━━━━━━━━━━━━━                                            ┃
┃                                                                                                ┃
┃ Overall Coverage: 65%  ██████░░░░  ⚠️ BELOW TARGET (80%)                                      ┃
┃                                                                                                ┃
┃ Function Coverage:                                                                             ┃
┃ • handlePasswordReset()    45%  ⚠️ CRITICAL GAP                                               ┃
┃ • validateResetToken()     80%  ✓                                                             ┃
┃ • generateResetLink()      90%  ✓                                                             ┃
┃ • sendResetEmail()         75%  ⚠️                                                             ┃
┃                                                                                                ┃
┃ Uncovered Branches: 12                                                                         ┃
┃ Critical Paths Untested: 3                                                                     ┃
┃ • Token expiration edge cases                                                                  ┃
┃ • Email service failure handling                                                               ┃
┃ • Concurrent reset request handling                                                            ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ CODE CHURN (30 days) ━━━━━━━━━━━━━━━━━                                     ┃
┃                                                                                                ┃
┃ Modifications: 8 times (by 3 different stories)                                                ┃
┃ Lines Changed: 145 lines (+82, -63)                                                            ┃
┃ Churn Rate: 42% (high churn indicates instability)                                             ┃
┃                                                                                                ┃
┃ Recent Changes:                                                                                ┃
┃ • ST-38: Added token expiration logic              (3 days ago)                                ┃
┃ • ST-35: Fixed email template bug                  (8 days ago)                                ┃
┃ • ST-31: Updated validation rules                  (12 days ago)                               ┃
┃ • ST-28: Refactored error handling                 (18 days ago)                               ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ CODE QUALITY ISSUES ━━━━━━━━━━━━━━━━━                                      ┃
┃                                                                                                ┃
┃ 🔴 Critical (2):                                                                               ┃
┃ • [Line 145] Security: Hardcoded secret 'secret_key_123'                                       ┃
┃   Fix: Move to environment variable or secrets manager                                         ┃
┃ • [Line 203] Bug Risk: Unchecked null pointer - user.email may be null                         ┃
┃   Fix: Add null check before accessing user.email                                              ┃
┃                                                                                                ┃
┃ ⚠️  Major (3):                                                                                  ┃
┃ • [Lines 87-102] Duplication: 15 lines duplicated in session-manager.ts                        ┃
┃   Fix: Extract to shared utility function                                                      ┃
┃ • [Lines 45-128] Code Smell: Function too long (handlePasswordReset: 83 lines)                 ┃
┃   Fix: Extract into smaller functions                                                          ┃
┃ • [Line 178] Performance: Inefficient loop - O(n²) complexity                                  ┃
┃   Fix: Use Map for O(1) lookup                                                                 ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ DEPENDENCIES ━━━━━━━━━━━━━━━━━                                             ┃
┃                                                                                                ┃
┃ Imported by: 5 files                                                                           ┃
┃ • src/api/routes/auth-routes.ts                                                                ┃
┃ • src/services/user-service.ts                                                                 ┃
┃ • src/api/controllers/auth-controller.ts                                                       ┃
┃ • tests/integration/auth/password-reset.test.ts                                                ┃
┃ • tests/e2e/auth-flows.spec.ts                                                                 ┃
┃                                                                                                ┃
┃ Imports: 12 modules                                                                            ┃
┃ Coupling Score: High  ⚠️                                                                        ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ RECOMMENDATIONS ━━━━━━━━━━━━━━━━━                                           ┃
┃                                                                                                ┃
┃ 🚨 CRITICAL: Fix security issue (hardcoded secret) - IMMEDIATE ACTION REQUIRED                 ┃
┃ 🚨 CRITICAL: Add null check at line 203                                                        ┃
┃ 💡 Refactor handlePasswordReset() - too complex (CC: 18)                                       ┃
┃    Suggested approach:                                                                         ┃
┃    • Extract token validation (lines 45-65) → validateToken()                                  ┃
┃    • Extract email sending (lines 109-128) → sendEmail()                                       ┃
┃    • Apply guard clauses for early returns                                                     ┃
┃    • Reduce nesting from 5 to 3 levels                                                         ┃
┃ 💡 Increase test coverage to 80%+ before making further changes                                ┃
┃ 💡 Extract duplicated logic to shared utility (auth-utils.ts)                                  ┃
┃                                                                                                ┃
┃ Estimated Refactor Effort: Medium (2-3 days)                                                   ┃
┃ Risk if Modified Without Refactor: HIGH                                                        ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ┃
┃ [View Source Code] [View Function Details] [Create Refactor Story] [Export Report]             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Function Detail View

When user clicks "View Details" on handlePasswordReset() function:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ← Back to File Details                                                                         ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                                ┃
┃ FUNCTION: handlePasswordReset()                                                                ┃
┃ File: src/auth/password-reset.ts:45-128                                                        ┃
┃                                                                                                ┃
┃ Cyclomatic Complexity: 18  🔥 VERY HIGH                                                        ┃
┃ Cognitive Complexity:  24  🔥 VERY HIGH                                                         ┃
┃ Lines of Code: 83                                                                              ┃
┃ Parameters: 3                                                                                  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ COMPLEXITY CONTRIBUTORS ━━━━━━━━━━━━━━━━━                                   ┃
┃                                                                                                ┃
┃ Conditional Branches: 12                                                                       ┃
┃ • if statements: 8                                                                             ┃
┃ • switch cases: 2                                                                              ┃
┃ • ternary operators: 2                                                                         ┃
┃                                                                                                ┃
┃ Loops: 3                                                                                       ┃
┃ • for loops: 2                                                                                 ┃
┃ • while loops: 1                                                                               ┃
┃                                                                                                ┃
┃ Try-Catch Blocks: 4                                                                            ┃
┃ Nested Depth: 5 levels  ⚠️ TOO DEEP (max: 3)                                                   ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ CODE STRUCTURE ━━━━━━━━━━━━━━━━━                                            ┃
┃                                                                                                ┃
┃ Lines 45-65:   Token validation         (complexity: 6)   [Extract to function]               ┃
┃ Lines 66-85:   Email existence check    (complexity: 4)                                        ┃
┃ Lines 86-108:  Token generation & store (complexity: 5)   [Extract to function]               ┃
┃ Lines 109-128: Email sending logic      (complexity: 3)   [Extract to function]               ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ TEST COVERAGE ━━━━━━━━━━━━━━━━━                                             ┃
┃                                                                                                ┃
┃ Coverage: 45%  ████░░░░░░  ⚠️ CRITICAL                                                         ┃
┃                                                                                                ┃
┃ Covered Paths: 6 of 18 paths                                                                   ┃
┃ Untested Scenarios:                                                                            ┃
┃ • Token expiration edge cases (lines 52-58)                                                    ┃
┃ • Email service failure handling (lines 115-120)                                               ┃
┃ • Concurrent reset request handling (lines 90-95)                                              ┃
┃ • Database connection failures (lines 102-106)                                                 ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ REFACTORING SUGGESTIONS ━━━━━━━━━━━━━━━━━                                   ┃
┃                                                                                                ┃
┃ 💡 Extract Method: Token validation logic (lines 45-65)                                        ┃
┃    Target complexity: 6 → 2                                                                    ┃
┃    function validateToken(token: string): ValidationResult { ... }                             ┃
┃                                                                                                ┃
┃ 💡 Extract Method: Email sending (lines 109-128)                                               ┃
┃    Target complexity: 3 → 1                                                                    ┃
┃    async function sendEmail(user: User, link: string): Promise<void> { ... }                   ┃
┃                                                                                                ┃
┃ 💡 Simplify Nested Conditionals: Reduce nesting from 5 to 3                                    ┃
┃    Use early returns and guard clauses                                                         ┃
┃                                                                                                ┃
┃ 💡 Apply Guard Clauses: Early returns for validation                                           ┃
┃    if (!token) return error("Invalid token");                                                  ┃
┃    if (!user) return error("User not found");                                                  ┃
┃                                                                                                ┃
┃ Expected Result After Refactor:                                                                ┃
┃ • Complexity: 18 → 8  (56% reduction)                                                          ┃
┃ • Testability: Much improved (smaller, focused functions)                                      ┃
┃ • Maintainability: C → B rating                                                                ┃
┃ • Nested depth: 5 → 2 levels                                                                   ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ┃
┃ [View Source Code] [Generate Refactor Plan] [AI Refactor Suggestions] [Create Story]          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Key Features & Interactions

### 1. Multi-Level Drill-Down
- **Project → Layer → Component → File → Function**
- Each level provides progressively more detail
- Breadcrumb navigation for easy back-tracking

### 2. Real-time Health Scoring
- **Risk Score Formula**: `complexity × churn × (1 - coverage/100)`
- **Health Score**: Composite of all metrics
- **Color Coding**: 🔴 Critical, ⚠️ Warning, ✓ Good

### 3. Actionable Insights
- **AI-Powered**: Automatic insight generation
- **Context-Aware**: Considers project history
- **Actionable**: Direct links to create refactor stories

### 4. Integrated Workflow
- **Create Refactor Story**: Pre-filled with metrics and recommendations
- **View Source**: Direct link to file in IDE/GitHub
- **Export Reports**: PDF/CSV for stakeholder reviews

### 5. Automated Data Collection
- **Background Workers**: Process commits every 6 hours
- **Static Analysis**: SonarQube, ESLint, Pylint integration
- **CI/CD Integration**: Test coverage from build reports
- **Git Analysis**: Churn calculation from commit history

---

## Design Principles

1. **Traffic Light System**: Red/Yellow/Green for instant recognition
2. **Progressive Disclosure**: Summary → Detail → Deep Detail
3. **Contextualized Metrics**: Always show thresholds and targets
4. **Actionable Data**: Every metric has a "what to do about it"
5. **Trend Awareness**: Show direction of change, not just current state

---

## Data Freshness

- **Metrics Update**: Every 6 hours via background workers
- **Real-time**: Git commits trigger immediate file-level updates
- **Cache**: Dashboard caches for 5 minutes for performance
- **Manual Refresh**: Available for on-demand updates

---

## Export & Reporting

- **PDF Export**: Full dashboard or specific component
- **CSV Export**: Raw data for external analysis
- **Scheduled Reports**: Weekly/monthly automated emails
- **API Access**: Query metrics programmatically via MCP tools
