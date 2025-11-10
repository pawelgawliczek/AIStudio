# Use Case View - Text-Based Design

> **Based on**: UC-BA-004 (Search Use Case Library), UC-BA-005 (Advanced Use Case Search)
> **Primary Users**: BA, PM, Architect, Developer

---

## Screen Layout Overview

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ AI STUDIO - Use Case Library                                         👤 User ▼ ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📊 Dashboard │ 📋 Planning │ 📈 Metrics │ 🎯 Use Cases │ 🧪 Test Cases       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                 ┃
┃ Project: AI Studio MCP Control Plane                                           ┃
┃                                                                                 ┃
┃ ┌─ Search Modes ────────────────────────────────────────────────────────────┐  ┃
┃ │ [Component Filter] [Semantic Search] [Text Search] [Component Tree View]  │  ┃
┃ └────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Main View: Component Filter Search

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                                                ┃
┃ USE CASE LIBRARY - 248 total use cases                                      [+ Create New]    ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ COMPONENT FILTER ━━━━━━━━━━━━━━━━━                                         ┃
┃                                                                                                ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ Context: Working on Story ST-42: "Implement password reset flow"                      │    ┃
┃ │                                                                                        │    ┃
┃ │ Selected Components (from story):                                                      │    ┃
┃ │ ☑ Authentication                                            12 use cases               │    ┃
┃ │ ☑ Email Service                                             8 use cases                │    ┃
┃ │                                                                                        │    ┃
┃ │ Showing use cases that match: Authentication ∩ Email Service → 3 highly relevant      │    ┃
┃ │                                                                                        │    ┃
┃ │ Add more components:                                                                   │    ┃
┃ │ ☐ User Management                                           15 use cases               │    ┃
┃ │ ☐ Billing                                                   10 use cases               │    ┃
┃ │ ☐ API Gateway                                               18 use cases               │    ┃
┃ │ ☐ Reporting                                                 7 use cases                │    ┃
┃ │ ☐ Search                                                    5 use cases                │    ┃
┃ │                                                             ... [View All Components]  │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ ──────── FILTER BY LAYER ────────                                                      │    ┃
┃ │ ☑ Frontend                                                  25 use cases               │    ┃
┃ │ ☑ Backend/API                                               42 use cases               │    ┃
┃ │ ☐ Database                                                  18 use cases               │    ┃
┃ │ ☐ Integration                                               12 use cases               │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ ──────── ADDITIONAL FILTERS ────────                                                   │    ┃
┃ │ Status: [Active ▼]    Last Modified: [Anytime ▼]    Created By: [Anyone ▼]           │    ┃
┃ │ Has Defects: [All ▼]  Test Coverage: [Any ▼]                                          │    ┃
┃ │                                                                                        │    ┃
┃ │ [Apply Filters]  [Clear All]  [Save Filter Preset]                                    │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ RESULTS (18 use cases) ━━━━━━━━━━━━━━━━━                                   ┃
┃ Sort by: [Relevance ▼] [Last Modified] [Title] [Linked Stories] [Test Coverage]              ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ UC-AUTH-003: Password Reset Flow ⭐ HIGHLY RELEVANT                                      │  ┃
┃ │                                                                                          │  ┃
┃ │ Component: 🏷️ Authentication, 🏷️ Email Service │ Layer: Backend/API, Frontend          │  ┃
┃ │ Last Modified: Oct 28, 2025  │  Version: 2  │  Status: Active                           │  ┃
┃ │ Linked Stories: 3  │  Test Coverage: 85% ✓  │  ⚠️ 1 open defect (Medium severity)       │  ┃
┃ │                                                                                          │  ┃
┃ │ Summary:                                                                                 │  ┃
┃ │ User requests password reset via email. System sends reset link with token. User        │  ┃
┃ │ clicks link and sets new password. Token expires after 1 hour.                          │  ┃
┃ │                                                                                          │  ┃
┃ │ Test Coverage Breakdown:                                                                 │  ┃
┃ │ • Unit: 92% (12 tests)  • Integration: 78% (5 tests)  • E2E: 100% (2 tests)            │  ┃
┃ │                                                                                          │  ┃
┃ │ Coverage Gaps:                                                                           │  ┃
┃ │ • Concurrent reset requests not tested                                                   │  ┃
┃ │ • Rate limiting not covered                                                              │  ┃
┃ │                                                                                          │  ┃
┃ │ [View Details] [✓ Already Linked to ST-42] [View History] [View Tests]                 │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ UC-AUTH-001: User Login                                                                  │  ┃
┃ │                                                                                          │  ┃
┃ │ Component: 🏷️ Authentication │ Layer: Backend/API, Frontend                             │  ┃
┃ │ Last Modified: Nov 5, 2025  │  Version: 3  │  Status: Active                            │  ┃
┃ │ Linked Stories: 5  │  Test Coverage: 96% ✓  │  No defects                               │  ┃
┃ │                                                                                          │  ┃
┃ │ Summary:                                                                                 │  ┃
┃ │ Users authenticate using email/password or OAuth providers. System validates             │  ┃
┃ │ credentials and creates session. Failed attempts are logged for security monitoring.     │  ┃
┃ │                                                                                          │  ┃
┃ │ Test Coverage Breakdown:                                                                 │  ┃
┃ │ • Unit: 95% (18 tests)  • Integration: 94% (8 tests)  • E2E: 100% (4 tests)            │  ┃
┃ │                                                                                          │  ┃
┃ │ [View Details] [Link to ST-42] [View History] [View Tests]                              │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ UC-EMAIL-001: Email Notification System                                                  │  ┃
┃ │                                                                                          │  ┃
┃ │ Component: 🏷️ Email Service │ Layer: Integration                                        │  ┃
┃ │ Last Modified: Oct 15, 2025  │  Version: 1  │  Status: Active                           │  ┃
┃ │ Linked Stories: 8  │  Test Coverage: 88% ✓  │  No defects                               │  ┃
┃ │                                                                                          │  ┃
┃ │ Summary:                                                                                 │  ┃
┃ │ System sends transactional emails (password reset, verification, notifications) using   │  ┃
┃ │ template engine and queue. Supports multiple providers with fallback.                    │  ┃
┃ │                                                                                          │  ┃
┃ │ Test Coverage Breakdown:                                                                 │  ┃
┃ │ • Unit: 90% (15 tests)  • Integration: 85% (6 tests)  • E2E: 90% (3 tests)             │  ┃
┃ │                                                                                          │  ┃
┃ │ [View Details] [Link to ST-42] [View History] [View Tests]                              │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ UC-AUTH-004: Two-Factor Authentication (2FA)                                             │  ┃
┃ │ Component: 🏷️ Authentication │ Layer: Backend/API, Frontend                             │  ┃
┃ │ Last Modified: Nov 1, 2025  │  Version: 2  │  Linked: 4  │  Coverage: 92% ✓             │  ┃
┃ │ [View Details] [Link to ST-42] [View Tests]                                             │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ... [Load More] (14 more use cases)                                                           ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ QUICK ACTIONS ━━━━━━━━━━━━━━━━━                                            ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ [☑ Select All] [Link Selected to ST-42] [Export Selected] [Create New Use Case]       │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Semantic Search Mode

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ SEMANTIC SEARCH ━━━━━━━━━━━━━━━━━                                          ┃
┃                                                                                                ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ Ask a question or describe what you're looking for:                                    │    ┃
┃ │                                                                                        │    ┃
┃ │ [What happens when a user forgets their password?                                ]    │    ┃
┃ │                                                                                        │    ┃
┃ │ [Search] or press Enter                                                                │    ┃
┃ │                                                                                        │    ┃
┃ │ Example queries:                                                                       │    ┃
┃ │ • "How do users change their email address?"                                           │    ┃
┃ │ • "What happens when payment fails?"                                                   │    ┃
┃ │ • "User account recovery process"                                                      │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ RESULTS (ranked by similarity) ━━━━━━━━━━━━━━━━━                           ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 1. UC-AUTH-003: Password Reset Flow                          Similarity: 95%  ⭐⭐⭐⭐⭐  │  ┃
┃ │                                                                                          │  ┃
┃ │ "User requests password reset via email. System sends reset link. User clicks link     │  ┃
┃ │  and sets new password..."                                                               │  ┃
┃ │                                                                                          │  ┃
┃ │ Matched sections:                                                                        │  ┃
┃ │ • Main flow: Steps 1-13 describe password reset process                                 │  ┃
┃ │ • Alternative flow 8a: Token expired handling                                            │  ┃
┃ │                                                                                          │  ┃
┃ │ Component: Authentication, Email Service │ Coverage: 85% │ Linked: 3 stories            │  ┃
┃ │ [View Details] [Link to ST-42]                                                           │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 2. UC-AUTH-007: Account Recovery                            Similarity: 72%  ⭐⭐⭐⭐     │  ┃
┃ │                                                                                          │  ┃
┃ │ "When user loses access to account due to forgotten password or locked account,         │  ┃
┃ │  system provides recovery options..."                                                    │  ┃
┃ │                                                                                          │  ┃
┃ │ Matched sections:                                                                        │  ┃
┃ │ • Main flow: Multi-step account recovery process                                         │  ┃
┃ │                                                                                          │  ┃
┃ │ Component: Authentication │ Coverage: 78% │ Linked: 2 stories                           │  ┃
┃ │ [View Details] [Link to ST-42]                                                           │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 3. UC-EMAIL-001: Email Notification System                   Similarity: 68%  ⭐⭐⭐      │  ┃
┃ │                                                                                          │  ┃
┃ │ "System sends emails for various events including password reset, verification,         │  ┃
┃ │  and notifications..."                                                                    │  ┃
┃ │                                                                                          │  ┃
┃ │ Component: Email Service │ Coverage: 88% │ Linked: 8 stories                            │  ┃
┃ │ [View Details] [Link to ST-42]                                                           │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 4. UC-AUTH-008: Change Password                              Similarity: 62%  ⭐⭐⭐      │  ┃
┃ │ Component: Authentication │ Coverage: 90% │ Linked: 4 stories                            │  ┃
┃ │ [View Details]                                                                           │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Component Tree View

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ COMPONENT TREE VIEW ━━━━━━━━━━━━━━━━━                                      ┃
┃                                                                                                ┃
┃ 📁 Components (8 total) - 248 use cases                                                       ┃
┃                                                                                                ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ 📂 Authentication (12 use cases) ⬇️                                                     │    ┃
┃ │ │                                                                                      │    ┃
┃ │ │  ┌─────────────────────────────────────────────────────────────────────────────┐    │    ┃
┃ │ │  │ UC-AUTH-001: User Login                         ✓ 96% │ 5 stories │ Active │    │    ┃
┃ │ │  │ UC-AUTH-002: User Logout                        ✓ 100%│ 3 stories │ Active │    │    ┃
┃ │ │  │ UC-AUTH-003: Password Reset Flow ⭐              ✓ 85% │ 3 stories │ ⚠️ 1 def│    │    ┃
┃ │ │  │ UC-AUTH-004: Two-Factor Authentication          ✓ 92% │ 4 stories │ Active │    │    ┃
┃ │ │  │ UC-AUTH-005: Session Management                 ✓ 88% │ 6 stories │ Active │    │    ┃
┃ │ │  │ UC-AUTH-006: OAuth Integration                  ✓ 85% │ 2 stories │ Active │    │    ┃
┃ │ │  │ UC-AUTH-007: Account Recovery                   ⚠️ 78% │ 2 stories │ Active │    │    ┃
┃ │ │  │ UC-AUTH-008: Change Password                    ✓ 90% │ 4 stories │ Active │    │    ┃
┃ │ │  │ UC-AUTH-009: Session Timeout                    ✓ 95% │ 3 stories │ Active │    │    ┃
┃ │ │  │ UC-AUTH-010: Password Policy Enforcement        ✓ 92% │ 2 stories │ Active │    │    ┃
┃ │ │  │ UC-AUTH-011: Login Attempt Logging              ✓ 100%│ 1 story  │ Active │    │    ┃
┃ │ │  │ UC-AUTH-012: Social Login (Google, GitHub)      ❌ 0%  │ 1 story  │ Draft  │    │    ┃
┃ │ │  └─────────────────────────────────────────────────────────────────────────────┘    │    ┃
┃ │                                                                                        │    ┃
┃ │  [Collapse] [Select All] [Link Selected to ST-42]                                      │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ 📂 Email Service (8 use cases) ⬇️                                                       │    ┃
┃ │ │                                                                                      │    ┃
┃ │ │  ┌─────────────────────────────────────────────────────────────────────────────┐    │    ┃
┃ │ │  │ UC-EMAIL-001: Email Notification System ⭐      ✓ 88% │ 8 stories │ Active │    │    ┃
┃ │ │  │ UC-EMAIL-002: Email Template Management         ✓ 90% │ 5 stories │ Active │    │    ┃
┃ │ │  │ UC-EMAIL-003: Email Queue Processing            ✓ 95% │ 4 stories │ Active │    │    ┃
┃ │ │  │ UC-EMAIL-004: Email Bounce Handling             ⚠️ 75% │ 2 stories │ Active │    │    ┃
┃ │ │  │ UC-EMAIL-005: Email Provider Failover           ✓ 82% │ 3 stories │ Active │    │    ┃
┃ │ │  │ UC-EMAIL-006: Email Analytics                   ✓ 88% │ 2 stories │ Active │    │    ┃
┃ │ │  │ UC-EMAIL-007: Transactional Email Sending       ✓ 92% │ 6 stories │ Active │    │    ┃
┃ │ │  │ UC-EMAIL-008: Email Unsubscribe Management      ✓ 85% │ 3 stories │ Active │    │    ┃
┃ │ │  └─────────────────────────────────────────────────────────────────────────────┘    │    ┃
┃ │                                                                                        │    ┃
┃ │  [Collapse] [Select All] [Link Selected to ST-42]                                      │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ 📂 User Management (15 use cases) ⬆️                                                           ┃
┃ 📂 Billing (10 use cases) ⬆️                                                                    ┃
┃ 📂 API Gateway (18 use cases) ⬆️                                                               ┃
┃ 📂 Reporting (7 use cases) ⬆️                                                                   ┃
┃ 📂 Search (5 use cases) ⬆️                                                                      ┃
┃ 📂 Integration (12 use cases) ⬆️                                                               ┃
┃                                                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Use Case Detail View

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ← Back to Search Results                                                                      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                                ┃
┃ UC-AUTH-003: Password Reset Flow                                                       [✕]    ┃
┃                                                                                                ┃
┃ Component: 🏷️ Authentication, 🏷️ Email Service                                                ┃
┃ Layer: Backend/API, Frontend                                                                   ┃
┃ Status: Active │ Version: 2 (Nov 5, 2025) │ Created: Oct 1, 2025                              ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ DESCRIPTION ━━━━━━━━━━━━━━━━━                                              ┃
┃                                                                                                ┃
┃ Primary Actor: End User                                                                        ┃
┃ Scope: Password recovery for authenticated users                                              ┃
┃                                                                                                ┃
┃ Preconditions:                                                                                 ┃
┃ • User has registered account with verified email                                             ┃
┃ • User is not currently logged in                                                             ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ MAIN SUCCESS SCENARIO ━━━━━━━━━━━━━━━━━                                    ┃
┃                                                                                                ┃
┃ 1. User clicks "Forgot Password" link on login page                                           ┃
┃ 2. System displays password reset request form                                                ┃
┃ 3. User enters email address                                                                   ┃
┃ 4. System validates email exists in database                                                   ┃
┃ 5. System generates unique, cryptographically secure reset token                              ┃
┃ 6. System stores token with 1-hour expiration                                                 ┃
┃ 7. System sends email with reset link containing token                                        ┃
┃ 8. User receives email and clicks reset link                                                  ┃
┃ 9. System validates token (not expired, not already used)                                     ┃
┃ 10. System displays new password form                                                         ┃
┃ 11. User enters new password (twice for confirmation)                                         ┃
┃ 12. System validates password meets strength requirements                                     ┃
┃ 13. System updates password, invalidates token                                                ┃
┃ 14. System displays success message                                                           ┃
┃ 15. User redirected to login page                                                             ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ ALTERNATIVE FLOWS ━━━━━━━━━━━━━━━━━                                        ┃
┃                                                                                                ┃
┃ 4a. Email not found:                                                                           ┃
┃     • System displays generic success message (security: don't reveal user existence)          ┃
┃     • No email sent                                                                            ┃
┃     • Flow ends                                                                                ┃
┃                                                                                                ┃
┃ 7a. Email sending fails:                                                                       ┃
┃     • System retries with backup email provider                                                ┃
┃     • If all providers fail, log error and notify admins                                       ┃
┃     • User sees "Please try again later" message                                               ┃
┃                                                                                                ┃
┃ 9a. Token expired:                                                                             ┃
┃     • System displays "Link expired" message                                                   ┃
┃     • Offers option to request new reset link                                                  ┃
┃     • User can restart process                                                                 ┃
┃                                                                                                ┃
┃ 9b. Token already used:                                                                        ┃
┃     • System displays "Link already used" message                                              ┃
┃     • Suggests logging in or requesting new reset                                              ┃
┃                                                                                                ┃
┃ 12a. Password too weak:                                                                        ┃
┃     • System displays password requirements                                                    ┃
┃     • User must enter stronger password                                                        ┃
┃     • Flow returns to step 11                                                                  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ POSTCONDITIONS ━━━━━━━━━━━━━━━━━                                           ┃
┃                                                                                                ┃
┃ • User password is updated in database                                                         ┃
┃ • Reset token is marked as used/invalidated                                                    ┃
┃ • Audit log records password change event                                                      ┃
┃ • User receives confirmation email                                                             ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ BUSINESS RULES ━━━━━━━━━━━━━━━━━                                           ┃
┃                                                                                                ┃
┃ • Reset token expires after 1 hour                                                             ┃
┃ • Token is single-use only                                                                     ┃
┃ • Password must meet strength requirements (min 8 chars, uppercase, lowercase, number)         ┃
┃ • Email response time must be < 2 minutes                                                      ┃
┃ • Rate limiting: Max 3 reset requests per email per hour                                       ┃
┃ • Security: Never reveal whether email exists in system                                        ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ LINKED STORIES (3) ━━━━━━━━━━━━━━━━━                                       ┃
┃                                                                                                ┃
┃ • ST-12: Initial password reset implementation              Done   Nov 1, 2024                ┃
┃ • ST-35: Add token expiration logic                         Done   Oct 28, 2025               ┃
┃ • ST-42: Implement password reset flow (current story) ✓    In Progress                        ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ TEST COVERAGE (85% overall) ━━━━━━━━━━━━━━━━━                               ┃
┃                                                                                                ┃
┃ ✓ Unit Tests: 92% coverage (12 tests)                                                         ┃
┃   • test_reset_token_generation                          ✓ Pass                               ┃
┃   • test_reset_email_sent                                ✓ Pass                               ┃
┃   • test_token_validation                                ✓ Pass                               ┃
┃   • test_token_expiration                                ✓ Pass                               ┃
┃   • test_password_strength_validation                    ✓ Pass                               ┃
┃   • test_rate_limiting                                   ✓ Pass                               ┃
┃   • ... [View All 12 Tests]                                                                    ┃
┃                                                                                                ┃
┃ ✓ Integration Tests: 78% coverage (5 tests)                                                   ┃
┃   • test_reset_flow_end_to_end                           ✓ Pass                               ┃
┃   • test_expired_token_handling                          ✓ Pass                               ┃
┃   • test_email_service_integration                       ✓ Pass                               ┃
┃   • test_database_transaction_rollback                   ✓ Pass                               ┃
┃   • test_concurrent_reset_requests                       ⚠️ Flaky (pass 80%)                  ┃
┃                                                                                                ┃
┃ ✓ E2E Tests: 100% coverage (2 tests)                                                          ┃
┃   • test_complete_password_reset_flow                    ✓ Pass                               ┃
┃   • test_invalid_token_flow                              ✓ Pass                               ┃
┃                                                                                                ┃
┃ ⚠️ Coverage Gaps:                                                                              ┃
┃ • Concurrent reset requests (needs improvement - test flaky)                                   ┃
┃ • Rate limiting edge cases (IP-based vs email-based)                                           ┃
┃ • Email service timeout handling (78% coverage)                                                ┃
┃                                                              [Add Tests] [View Full Report]    ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ DEFECTS (1 open) ━━━━━━━━━━━━━━━━━                                          ┃
┃                                                                                                ┃
┃ ⚠️ DEFECT-42 (Medium): Reset email sometimes delayed by 5+ minutes                            ┃
┃    Opened: Nov 8, 2025 │ Assigned: Dev Team │ Origin: ST-38                                   ┃
┃    Root Cause: Email queue overload during peak hours                                          ┃
┃    [View Defect Details] [View Related Commits]                                                ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ IMPACTED FILES ━━━━━━━━━━━━━━━━━                                            ┃
┃                                                                                                ┃
┃ Backend:                                                                                       ┃
┃ • src/auth/password-reset.ts                             342 LOC │ Last: 3d ago (ST-38)       ┃
┃ • src/auth/token-generator.ts                            125 LOC │ Last: 8d ago (ST-35)       ┃
┃ • src/email/reset-email.ts                               98 LOC  │ Last: 12d ago (ST-31)      ┃
┃                                                                                                ┃
┃ Frontend:                                                                                      ┃
┃ • src/pages/reset-password.tsx                           245 LOC │ Last: 5d ago (ST-42)       ┃
┃ • src/components/PasswordResetForm.tsx                   198 LOC │ Last: 5d ago (ST-42)       ┃
┃                                                                                                ┃
┃ Tests:                                                                                         ┃
┃ • tests/unit/auth/reset-password.test.ts                 420 LOC                              ┃
┃ • tests/integration/auth/reset-flow.test.ts              285 LOC                              ┃
┃ • tests/e2e/auth-flows.spec.ts                           156 LOC                              ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ VERSION HISTORY ━━━━━━━━━━━━━━━━━                                          ┃
┃                                                                                                ┃
┃ v2 (Nov 5, 2025) - Added token expiration and rate limiting        [View Diff] [Restore]      ┃
┃ v1 (Oct 1, 2025) - Initial version                                 [View]                     ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ┃
┃ [✓ Link to ST-42] [Edit] [Create New Version] [Export] [View Full History] [Delete]          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Key Features & Interactions

### 1. Multi-Mode Search
- **Component Filter**: Find by component/layer tags
- **Semantic Search**: Natural language queries
- **Text Search**: Keyword matching
- **Tree View**: Browse by component hierarchy

### 2. Intelligent Filtering
- **Context-Aware**: Auto-selects components from current story
- **Relevance Ranking**: Highlights use cases matching multiple filters
- **Test Coverage Visibility**: See coverage at all test levels
- **Defect Awareness**: Show open defects per use case

### 3. Test Coverage Integration
- **Three Levels**: Unit, Integration, E2E coverage shown separately
- **Coverage Gaps**: Automatically identified untested scenarios
- **Test Links**: Direct links to test files
- **Coverage Trends**: Track coverage over time

### 4. Batch Operations
- **Multi-Select**: Select multiple use cases
- **Batch Link**: Link many use cases to story at once
- **Export**: Export filtered results

### 5. Version Control
- **Version History**: Track use case changes over time
- **Diff View**: See what changed between versions
- **Restore**: Revert to previous version

---

## Search Ranking Algorithm

```
score =
  0.5 × component_match_score +  // exact component match
  0.3 × semantic_similarity +     // semantic relevance (if using semantic search)
  0.1 × recency_score +          // recently modified
  0.1 × popularity_score         // often linked to stories
```

### Component Match Score
- Matches all selected components: 1.0 (HIGHLY RELEVANT)
- Matches some components: 0.5-0.9 (proportional)
- Matches none: 0.0

### Semantic Similarity
- Vector embedding cosine similarity (0.0 - 1.0)
- Uses OpenAI ada-002 or similar

---

## Design Principles

1. **Component-Centric**: Components are the primary organizational unit
2. **Test-Aware**: Always show test coverage status
3. **Context-Sensitive**: Auto-suggest based on current story context
4. **Progressive Disclosure**: Summary cards → Full details
5. **Semantic Understanding**: Natural language queries work

---

## Technical Implementation

### Semantic Search
- Use case content → vector embeddings
- Query → embedding
- Cosine similarity search (pgvector in PostgreSQL)
- Cache embeddings (regenerate only on updates)

### Full-Text Search
- PostgreSQL tsvector for keyword search
- Weighted: title (A) > summary (B) > content (C)
- Support stemming and synonyms

### Component Filtering
- Fast indexed lookups on component_id
- Support multi-select with AND/OR logic
- Hierarchical component navigation
