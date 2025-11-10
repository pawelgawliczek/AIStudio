# Test Case View - Text-Based Design

> **Based on**: UC-QA-003 (Manage Test Case Coverage)
> **Primary Users**: QA, BA (creates test scenarios), Developer (implements tests)

---

## Screen Layout Overview

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ AI STUDIO - Test Case Management                                     👤 User ▼ ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📊 Dashboard │ 📋 Planning │ 📈 Metrics │ 🎯 Use Cases │ 🧪 Test Cases       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                 ┃
┃ Project: AI Studio MCP Control Plane                                           ┃
┃                                                                                 ┃
┃ ┌─ Views ───────────────────────────────────────────────────────────────────┐  ┃
┃ │ [Test Cases] [By Use Case] [By Component] [Coverage Report] [Test Runs]  │  ┃
┃ └────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                 ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Main View: Use Case Coverage Dashboard

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                                                ┃
┃ UC-AUTH-003: Password Reset Flow - Test Coverage                          [← Back to Use Case]┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ OVERALL COVERAGE ━━━━━━━━━━━━━━━━━                                         ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │                                                                                          │  ┃
┃ │ Overall Coverage: 85% ████████░░                                   ✓ MEETS TARGET (80%) │  ┃
┃ │                                                                                          │  ┃
┃ │ Total Test Cases: 6 (6 implemented, 0 pending)                                          │  ┃
┃ │                                                                                          │  ┃
┃ │ Coverage by Level:                                                                       │  ┃
┃ │ • Unit Tests:        92%  ████████████░   (3 tests)                                     │  ┃
┃ │ • Integration Tests: 78%  ███████░░░     (2 tests)                                      │  ┃
┃ │ • E2E Tests:        100%  ████████████   (1 test)                                       │  ┃
┃ │                                                                                          │  ┃
┃ │ Last Test Run: Nov 10, 14:35                                                            │  ┃
┃ │ Results: 6/6 passed ✓ │ 0 failed │ 0 skipped │ Duration: 2m 34s                         │  ┃
┃ │                                                                [Run Tests Now] [Schedule]│  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ UNIT TESTS (3 tests) ━━━━━━━━━━━━━━━━━                                     ┃
┃ Coverage: 92%  ████████████░                                                                  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ TC-AUTH-102: Validate reset token generation                                ✓ Implemented│  ┃
┃ │ Level: Unit │ Priority: High │ Status: Automated                                         │  ┃
┃ │                                                                                          │  ┃
┃ │ Test Scenario:                                                                           │  ┃
┃ │ System generates unique, cryptographically secure reset tokens with proper expiration.  │  ┃
┃ │                                                                                          │  ┃
┃ │ Test File: tests/unit/auth/token.test.ts:45-78                                          │  ┃
┃ │ Last Run: Nov 10, 14:30 │ Status: ✓ Pass │ Coverage: 95% │ Duration: 0.15s             │  ┃
┃ │                                                                                          │  ┃
┃ │ Assertions (8):                                                                          │  ┃
┃ │ ✓ Token is UUID v4 format                                                               │  ┃
┃ │ ✓ Token is 32 characters long                                                           │  ┃
┃ │ ✓ Token is unique (generated 1000 tokens, all unique)                                   │  ┃
┃ │ ✓ Expiration set to 1 hour from generation                                              │  ┃
┃ │ ✓ Token stored in database correctly                                                    │  ┃
┃ │ ✓ Token linked to correct user                                                          │  ┃
┃ │ ✓ Previous tokens invalidated                                                           │  ┃
┃ │ ✓ Rate limiting enforced (max 3 per hour)                                               │  ┃
┃ │                                                                                          │  ┃
┃ │ [View Test Code] [View Coverage Report] [Run Test] [Edit]                               │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ TC-AUTH-105: Expired token validation                                       ✓ Implemented│  ┃
┃ │ Level: Unit │ Priority: High │ Status: Automated                                         │  ┃
┃ │ Test File: tests/unit/auth/token-validation.test.ts:12-45                               │  ┃
┃ │ Last Run: Nov 10, 14:30 │ Status: ✓ Pass │ Coverage: 90% │ Duration: 0.12s             │  ┃
┃ │                                                                                          │  ┃
┃ │ Assertions (5):                                                                          │  ┃
┃ │ ✓ Expired tokens rejected with proper error message                                     │  ┃
┃ │ ✓ Expiration boundary tested (exactly 1 hour)                                           │  ┃
┃ │ ✓ Clock drift handled correctly                                                         │  ┃
┃ │ ✓ Error logged for security monitoring                                                  │  ┃
┃ │ ✓ User redirected to request new token                                                  │  ┃
┃ │                                                                                          │  ┃
┃ │ [View Test Code] [Run Test] [Edit]                                                      │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ TC-AUTH-106: Password strength validation                               ✓ Implemented   │  ┃
┃ │ Level: Unit │ Priority: Medium │ Status: Automated                                       │  ┃
┃ │ Test File: tests/unit/auth/password-validation.test.ts:8-52                             │  ┃
┃ │ Last Run: Nov 10, 14:30 │ Status: ✓ Pass │ Coverage: 92% │ Duration: 0.18s             │  ┃
┃ │                                                                                          │  ┃
┃ │ Assertions (12):                                                                         │  ┃
┃ │ ✓ Min 8 characters required                                                             │  ┃
┃ │ ✓ At least one uppercase letter required                                                │  ┃
┃ │ ✓ At least one lowercase letter required                                                │  ┃
┃ │ ✓ At least one number required                                                          │  ┃
┃ │ ✓ Special characters allowed                                                            │  ┃
┃ │ ✓ Common passwords rejected (e.g., "password123")                                       │  ┃
┃ │ ✓ Password confirmation mismatch detected                                               │  ┃
┃ │ ✓ Error messages are user-friendly                                                      │  ┃
┃ │ ... [View All 12 Assertions]                                                            │  ┃
┃ │                                                                                          │  ┃
┃ │ [View Test Code] [Run Test] [Edit]                                                      │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ INTEGRATION TESTS (2 tests) ━━━━━━━━━━━━━━━━━                              ┃
┃ Coverage: 78%  ██████████░░                                                                   ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ TC-AUTH-103: Send reset email                                           ✓ Implemented   │  ┃
┃ │ Level: Integration │ Priority: High │ Status: Automated                                  │  ┃
┃ │                                                                                          │  ┃
┃ │ Test Scenario:                                                                           │  ┃
┃ │ Email service correctly sends password reset email with valid reset link.               │  ┃
┃ │                                                                                          │  ┃
┃ │ Test File: tests/integration/auth/email-reset.test.ts:15-68                             │  ┃
┃ │ Last Run: Nov 10, 14:32 │ Status: ✓ Pass │ Coverage: 80% │ Duration: 1.45s             │  ┃
┃ │                                                                                          │  ┃
┃ │ Assertions (10):                                                                         │  ┃
┃ │ ✓ Email sent to correct recipient                                                       │  ┃
┃ │ ✓ Email contains valid reset link with token                                            │  ┃
┃ │ ✓ Email template rendered correctly                                                     │  ┃
┃ │ ✓ Email sent within 2 minutes (SLA)                                                     │  ┃
┃ │ ✓ Email provider API called with correct parameters                                     │  ┃
┃ │ ✓ Retry logic works if first attempt fails                                              │  ┃
┃ │ ✓ Email queue processed correctly                                                       │  ┃
┃ │ ✓ Confirmation logged in database                                                       │  ┃
┃ │ ✓ User receives email (verified via test email account)                                 │  ┃
┃ │ ✓ Link in email is clickable and valid                                                  │  ┃
┃ │                                                                                          │  ┃
┃ │ [View Test Code] [Run Test] [Edit]                                                      │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ TC-AUTH-104: Unknown email handling                                     ✓ Implemented   │  ┃
┃ │ Level: Integration │ Priority: Medium │ Status: Automated                                │  ┃
┃ │ Test File: tests/integration/auth/unknown-email.test.ts:8-35                            │  ┃
┃ │ Last Run: Nov 10, 14:32 │ Status: ✓ Pass │ Coverage: 76% │ Duration: 0.95s             │  ┃
┃ │                                                                                          │  ┃
┃ │ Assertions (6):                                                                          │  ┃
┃ │ ✓ Generic success message shown (security - don't reveal user existence)                │  ┃
┃ │ ✓ No email sent for unknown address                                                     │  ┃
┃ │ ✓ Attempt logged for security monitoring                                                │  ┃
┃ │ ✓ Rate limiting still applies                                                           │  ┃
┃ │ ✓ Response time same as valid email (timing attack prevention)                          │  ┃
┃ │ ✓ No database queries reveal user existence                                             │  ┃
┃ │                                                                                          │  ┃
┃ │ [View Test Code] [Run Test] [Edit]                                                      │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ E2E TESTS (1 test) ━━━━━━━━━━━━━━━━━                                       ┃
┃ Coverage: 100%  ████████████████████                                                          ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ TC-AUTH-101: Complete password reset flow                               ✓ Implemented   │  ┃
┃ │ Level: E2E │ Priority: High │ Status: Automated                                          │  ┃
┃ │                                                                                          │  ┃
┃ │ Test Scenario:                                                                           │  ┃
┃ │ User completes full password reset process from request to successful password change.  │  ┃
┃ │                                                                                          │  ┃
┃ │ Test File: tests/e2e/auth/password-reset.spec.ts:12-95                                  │  ┃
┃ │ Last Run: Nov 10, 14:35 │ Status: ✓ Pass │ Coverage: 100% │ Duration: 8.25s            │  ┃
┃ │                                                                                          │  ┃
┃ │ Test Steps (11):                                                                         │  ┃
┃ │ ✓ 1. Navigate to login page                                                             │  ┃
┃ │ ✓ 2. Click "Forgot Password" link                                                       │  ┃
┃ │ ✓ 3. Enter email: [email protected]                                                    │  ┃
┃ │ ✓ 4. Submit reset request                                                               │  ┃
┃ │ ✓ 5. Verify success message displayed                                                   │  ┃
┃ │ ✓ 6. Check test email inbox for reset link (via test email API)                         │  ┃
┃ │ ✓ 7. Click reset link in email                                                          │  ┃
┃ │ ✓ 8. Verify password reset page loaded                                                  │  ┃
┃ │ ✓ 9. Enter new password: "NewSecurePass123!"                                            │  ┃
┃ │ ✓ 10. Submit new password                                                               │  ┃
┃ │ ✓ 11. Verify success message and redirect to login                                      │  ┃
┃ │                                                                                          │  ┃
┃ │ Expected Results (all verified):                                                         │  ┃
┃ │ ✓ Reset email received within 2 minutes                                                 │  ┃
┃ │ ✓ Reset link is valid and opens password form                                           │  ┃
┃ │ ✓ Password is successfully updated in database                                          │  ┃
┃ │ ✓ User can login with new password                                                      │  ┃
┃ │ ✓ Old password no longer works                                                          │  ┃
┃ │ ✓ Reset token is invalidated after use                                                  │  ┃
┃ │                                                                                          │  ┃
┃ │ Screenshots: 11 screenshots captured during test                        [View Gallery]  │  ┃
┃ │ Video: test-recording.mp4 (8.2s)                                        [View Video]    │  ┃
┃ │                                                                                          │  ┃
┃ │ [View Test Code] [Run Test] [View Artifacts] [Edit]                                     │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ COVERAGE GAPS ━━━━━━━━━━━━━━━━━                                            ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ ⚠️ Areas not fully covered by tests:                                                     │  ┃
┃ │                                                                                          │  ┃
┃ │ • Concurrent reset requests                                              No test        │  ┃
┃ │   Scenario: User requests reset multiple times simultaneously                           │  ┃
┃ │   Risk: Database race condition, multiple emails sent                                   │  ┃
┃ │   Recommended: Add integration test                                                     │  ┃
┃ │   [Create Test Case]                                                                    │  ┃
┃ │                                                                                          │  ┃
┃ │ • Rate limiting on reset endpoint                                        No test        │  ┃
┃ │   Scenario: Attacker tries to spam reset requests                                       │  ┃
┃ │   Risk: Email bombing, service degradation                                              │  ┃
┃ │   Recommended: Add integration test                                                     │  ┃
┃ │   [Create Test Case]                                                                    │  ┃
┃ │                                                                                          │  ┃
┃ │ • Email service timeout handling                                         78% coverage   │  ┃
┃ │   Scenario: Email provider slow to respond or times out                                 │  ┃
┃ │   Risk: User experience degradation                                                     │  ┃
┃ │   Recommended: Improve integration test TC-AUTH-103                                     │  ┃
┃ │   [Improve Test]                                                                        │  ┃
┃ │                                                                                          │  ┃
┃ │ [Create Test Cases for All Gaps] [Export Gap Report]                                    │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ TEST EXECUTION SUMMARY ━━━━━━━━━━━━━━━━━                                   ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Last Full Test Run: Nov 10, 14:35                                                       │  ┃
┃ │ Triggered by: CI/CD Pipeline (commit ghi789)                                            │  ┃
┃ │                                                                                          │  ┃
┃ │ Results:                                                                                 │  ┃
┃ │ • Total Tests: 6                                                                         │  ┃
┃ │ • Passed: 6 ✓                                                                           │  ┃
┃ │ • Failed: 0                                                                              │  ┃
┃ │ • Skipped: 0                                                                             │  ┃
┃ │ • Duration: 2 minutes 34 seconds                                                         │  ┃
┃ │                                                                                          │  ┃
┃ │ Coverage Delta (vs previous run):                                                        │  ┃
┃ │ • Overall: 85% (no change)                                                               │  ┃
┃ │ • Unit: 92% (+2%)                                                                        │  ┃
┃ │ • Integration: 78% (no change)                                                           │  ┃
┃ │ • E2E: 100% (no change)                                                                  │  ┃
┃ │                                                                                          │  ┃
┃ │ [View Full Report] [View CI/CD Logs] [Run Tests Now]                                    │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Component-Level Coverage View

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                                                ┃
┃ AUTHENTICATION COMPONENT - TEST COVERAGE REPORT                                                ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ COMPONENT SUMMARY ━━━━━━━━━━━━━━━━━                                        ┃
┃                                                                                                ┃
┃ Total Use Cases: 12                                                                            ┃
┃ Fully Covered (>90%): 8  ████████░░░░  67%                                                    ┃
┃ Partially Covered:    3  ███░░░░░░░░░  25%                                                    ┃
┃ Not Covered:          1  ░░░░░░░░░░░░  8%                                                     ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ USE CASE COVERAGE BREAKDOWN ━━━━━━━━━━━━━━━━━                              ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ Use Case                    │ Overall │ Unit │ Integ│ E2E  │ Tests │ Status             │  ┃
┃ ├─────────────────────────────┼─────────┼──────┼──────┼──────┼───────┼────────────────────┤  ┃
┃ │ UC-AUTH-001: User Login     │ 96% ✓   │ 95%  │ 94%  │ 100% │ 14    │ [View] [Run Tests] │  ┃
┃ │   Unit: 8 tests             │ ████    │ ████ │ ████ │ █████│       │                    │  ┃
┃ │   Integration: 4 tests      │         │      │      │      │       │                    │  ┃
┃ │   E2E: 2 tests              │         │      │      │      │       │                    │  ┃
┃ ├─────────────────────────────┼─────────┼──────┼──────┼──────┼───────┼────────────────────┤  ┃
┃ │ UC-AUTH-003: Password Reset │ 85% ✓   │ 92%  │ 78%  │ 100% │ 6     │ [View] [Run Tests] │  ┃
┃ │   Unit: 3 tests             │ ████    │ ████ │ ███░ │ █████│       │                    │  ┃
┃ │   Integration: 2 tests      │         │      │      │      │       │                    │  ┃
┃ │   E2E: 1 test               │         │      │      │      │       │                    │  ┃
┃ ├─────────────────────────────┼─────────┼──────┼──────┼──────┼───────┼────────────────────┤  ┃
┃ │ UC-AUTH-004: Two-Factor Auth│ 92% ✓   │ 90%  │ 95%  │ 90%  │ 10    │ [View] [Run Tests] │  ┃
┃ │   Unit: 6 tests             │ ████    │ ████ │ ████ │ ████ │       │                    │  ┃
┃ │   Integration: 3 tests      │         │      │      │      │       │                    │  ┃
┃ │   E2E: 1 test               │         │      │      │      │       │                    │  ┃
┃ ├─────────────────────────────┼─────────┼──────┼──────┼──────┼───────┼────────────────────┤  ┃
┃ │ UC-AUTH-007: Session Mgmt   │ 68% ⚠️  │ 75%  │ 60%  │ 70%  │ 6     │ [View] [Add Tests] │  ┃
┃ │   Unit: 4 tests             │ ███░    │ ███░ │ ██░░ │ ███░ │       │                    │  ┃
┃ │   Integration: 2 tests      │         │      │      │      │       │                    │  ┃
┃ │   E2E: 0 tests ⚠️           │         │      │      │      │       │ ⚠️ Missing E2E     │  ┃
┃ ├─────────────────────────────┼─────────┼──────┼──────┼──────┼───────┼────────────────────┤  ┃
┃ │ UC-AUTH-012: Social Login   │ 0% ❌   │ 0%   │ 0%   │ 0%   │ 0     │ [Create Tests]     │  ┃
┃ │   No test cases defined     │ ░░░░    │ ░░░░ │ ░░░░ │ ░░░░ │       │ ⚠️ Critical Gap    │  ┃
┃ │   Recently implemented      │         │      │      │      │       │                    │  ┃
┃ └─────────────────────────────┴─────────┴──────┴──────┴──────┴───────┴────────────────────┘  ┃
┃                                                                                      [View All]┃
┃                                                                                                ┃
┃ Component Overall Coverage: 82%  ████████████████░░░░                                         ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ RECOMMENDATIONS ━━━━━━━━━━━━━━━━━                                          ┃
┃                                                                                                ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ 🎯 Priority Actions:                                                                     │  ┃
┃ │                                                                                          │  ┃
┃ │ 🔴 URGENT: Create test plan for UC-AUTH-012 (Social Login)                              │  ┃
┃ │    • Use case recently implemented but has 0% coverage                                   │  ┃
┃ │    • Recommend: 4 unit tests, 2 integration tests, 1 E2E test                            │  ┃
┃ │    [Auto-Generate Test Cases] [Create Manually]                                         │  ┃
┃ │                                                                                          │  ┃
┃ │ ⚠️  MEDIUM: Add E2E tests for UC-AUTH-007 (Session Management)                           │  ┃
┃ │    • Has unit and integration tests but missing E2E coverage                             │  ┃
┃ │    • Recommend: Add complete user session flow test                                      │  ┃
┃ │    [Create E2E Test]                                                                     │  ┃
┃ │                                                                                          │  ┃
┃ │ ℹ️  LOW: Improve integration coverage for UC-AUTH-003                                    │  ┃
┃ │    • Currently 78%, target is 80%                                                        │  ┃
┃ │    • Add tests for concurrent requests and rate limiting                                 │  ┃
┃ │    [View Gap Analysis]                                                                   │  ┃
┃ └──────────────────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Test Case Creation Wizard

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ CREATE TEST CASES FOR UC-AUTH-003: Password Reset Flow                               [✕]    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                                ┃
┃ Use Case Summary:                                                                              ┃
┃ User requests password reset via email. System sends reset link with time-limited token.      ┃
┃ User clicks link and sets new password.                                                        ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ AI-GENERATED TEST SCENARIOS ━━━━━━━━━━━━━━━━━                              ┃
┃                                                                                                ┃
┃ Based on use case main flow and alternative flows, we recommend these test scenarios:         ┃
┃                                                                                                ┃
┃ From Main Success Scenario:                                                                    ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ ☑ TC-AUTH-101: Complete password reset flow                                           │    ┃
┃ │   Level: [E2E ▼]  Priority: [High ▼]                                                  │    ┃
┃ │   Description: User completes full password reset process from request to success     │    ┃
┃ │                                                                                        │    ┃
┃ │   Auto-generated test steps (11 steps):                                               │    ┃
┃ │   1. Navigate to login page                                                            │    ┃
┃ │   2. Click "Forgot Password" link                                                      │    ┃
┃ │   3. Enter email address                                                               │    ┃
┃ │   ... (8 more steps)                                                [View All] [Edit]  │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ ☑ TC-AUTH-102: Validate reset token generation                                        │    ┃
┃ │   Level: [Unit ▼]  Priority: [High ▼]                                                 │    ┃
┃ │   Description: System generates unique, secure token with proper expiration           │    ┃
┃ │                                                                                        │    ┃
┃ │   Auto-generated assertions (6):                                                       │    ┃
┃ │   • Token is UUID v4 format                                                            │    ┃
┃ │   • Token is cryptographically secure                                                  │    ┃
┃ │   • Expiration set to 1 hour                                                           │    ┃
┃ │   ... (3 more assertions)                                           [View All] [Edit]  │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ ☑ TC-AUTH-103: Send reset email                                                       │    ┃
┃ │   Level: [Integration ▼]  Priority: [High ▼]                                          │    ┃
┃ │   Description: Email service sends reset link correctly                                │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ From Alternative Flow 4a (Email not found):                                                    ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ ☑ TC-AUTH-104: Unknown email handling                                                 │    ┃
┃ │   Level: [Integration ▼]  Priority: [Medium ▼]                                        │    ┃
┃ │   Description: System handles unknown email securely (don't reveal user existence)    │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ From Alternative Flow 9a (Token expired):                                                      ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ ☑ TC-AUTH-105: Expired token validation                                               │    ┃
┃ │   Level: [Unit ▼]  Priority: [High ▼]                                                 │    ┃
┃ │   Description: System rejects expired tokens with appropriate error message           │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ From Alternative Flow 12a (Weak password):                                                     ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ ☑ TC-AUTH-106: Password strength validation                                           │    ┃
┃ │   Level: [Unit ▼]  Priority: [Medium ▼]                                               │    ┃
┃ │   Description: System enforces password strength requirements                          │    ┃
┃ └────────────────────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                                ┃
┃ Additional edge cases (recommended):                                                           ┃
┃ ☐ TC-AUTH-107: Concurrent reset requests                        [Add]                         ┃
┃ ☐ TC-AUTH-108: Rate limiting enforcement                         [Add]                         ┃
┃ ☐ TC-AUTH-109: Email service timeout handling                    [Add]                         ┃
┃                                                                                                ┃
┃ [+ Add Custom Test Case]                                                                       ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ SUMMARY ━━━━━━━━━━━━━━━━━                                                  ┃
┃ Total Test Cases: 6 selected (9 recommended)                                                   ┃
┃ • Unit: 3                                                                                      ┃
┃ • Integration: 2                                                                               ┃
┃ • E2E: 1                                                                                       ┃
┃                                                                                                ┃
┃ Expected Coverage: ~85%                                                                        ┃
┃ Estimated Effort: 2-3 days (to implement all tests)                                            ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ┃
┃ [Cancel]  [Save as Draft]  [Create All Test Cases]                                            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Test Case Detail View

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ← Back to Coverage Dashboard                                                                  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                                ┃
┃ TC-AUTH-101: Complete password reset flow                                             [✕]    ┃
┃                                                                                                ┃
┃ Use Case: UC-AUTH-003 - Password Reset Flow                                                   ┃
┃ Component: Authentication                                                                      ┃
┃ Test Level: E2E                                                                                ┃
┃ Priority: High                                                                                 ┃
┃ Status: Implemented & Automated                                                                ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ TEST SCENARIO ━━━━━━━━━━━━━━━━━                                            ┃
┃                                                                                                ┃
┃ Description:                                                                                   ┃
┃ User completes full password reset process from request to successful password change.        ┃
┃ Validates complete user journey including email interaction.                                  ┃
┃                                                                                                ┃
┃ Preconditions:                                                                                 ┃
┃ • Test user exists in database: [email protected]                                          ┃
┃ • Test user old password is: "OldPass123"                                                     ┃
┃ • Test email service is configured and operational                                            ┃
┃ • Application is running at http://localhost:3000                                             ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ TEST STEPS ━━━━━━━━━━━━━━━━━                                               ┃
┃                                                                                                ┃
┃ 1. Navigate to login page                                                                      ┃
┃    Expected: Login page loads with "Forgot Password" link visible                             ┃
┃                                                                                                ┃
┃ 2. Click "Forgot Password" link                                                               ┃
┃    Expected: Password reset request page loads                                                ┃
┃                                                                                                ┃
┃ 3. Enter email: [email protected]                                                            ┃
┃    Expected: Email field accepts input                                                         ┃
┃                                                                                                ┃
┃ 4. Submit reset request                                                                        ┃
┃    Expected: Success message displayed: "If email exists, reset link sent"                    ┃
┃                                                                                                ┃
┃ 5. Check test email inbox for reset link (via test email API)                                 ┃
┃    Expected: Email received within 2 minutes with subject "Password Reset Request"            ┃
┃                                                                                                ┃
┃ 6. Extract reset link from email                                                              ┃
┃    Expected: Link format matches: http://localhost:3000/reset-password?token=...              ┃
┃                                                                                                ┃
┃ 7. Click reset link in email (navigate to URL)                                                ┃
┃    Expected: Password reset page loads with password input form                               ┃
┃                                                                                                ┃
┃ 8. Enter new password: "NewSecurePass123!"                                                    ┃
┃    Expected: Password field accepts input, strength indicator shows "Strong"                  ┃
┃                                                                                                ┃
┃ 9. Confirm new password: "NewSecurePass123!"                                                  ┃
┃    Expected: Confirmation field accepts input, passwords match                                ┃
┃                                                                                                ┃
┃ 10. Submit new password                                                                       ┃
┃     Expected: Success message displayed, redirect to login page                               ┃
┃                                                                                                ┃
┃ 11. Attempt login with old password "OldPass123"                                              ┃
┃     Expected: Login fails with "Invalid credentials" error                                    ┃
┃                                                                                                ┃
┃ 12. Attempt login with new password "NewSecurePass123!"                                       ┃
┃     Expected: Login succeeds, user redirected to dashboard                                    ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ EXPECTED RESULTS ━━━━━━━━━━━━━━━━━                                         ┃
┃                                                                                                ┃
┃ ✓ Reset email received within 2 minutes                                                       ┃
┃ ✓ Reset link is valid and opens password form                                                 ┃
┃ ✓ Password is successfully updated in database                                                ┃
┃ ✓ User can login with new password                                                            ┃
┃ ✓ Old password no longer works                                                                ┃
┃ ✓ Reset token is invalidated after use (reusing link shows error)                             ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ TEST DATA ━━━━━━━━━━━━━━━━━                                                ┃
┃                                                                                                ┃
┃ • Test Email: [email protected]                                                              ┃
┃ • Old Password: "OldPass123"                                                                   ┃
┃ • New Password: "NewSecurePass123!"                                                           ┃
┃ • Test Email Account: [email protected] (for receiving reset emails)                       ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ IMPLEMENTATION STATUS ━━━━━━━━━━━━━━━━━                                    ┃
┃                                                                                                ┃
┃ ✓ Implemented                                                                                  ┃
┃                                                                                                ┃
┃ Test File: tests/e2e/auth/password-reset.spec.ts:12-95                                        ┃
┃ Framework: Playwright                                                                          ┃
┃ Assigned To: QA Agent                                                                          ┃
┃ Created: Oct 15, 2025 │ Last Updated: Nov 10, 2025                                            ┃
┃                                                                                                ┃
┃ [View Test Code] [Edit Test] [Run Test Locally]                                               ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ EXECUTION HISTORY (Last 10 runs) ━━━━━━━━━━━━━━━━━                         ┃
┃                                                                                                ┃
┃ ┌────────────────────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ Date & Time         │ Status │ Duration │ Environment │ Triggered By        │ Logs   │    ┃
┃ ├─────────────────────┼────────┼──────────┼─────────────┼─────────────────────┼────────┤    ┃
┃ │ Nov 10, 14:35       │ ✓ Pass │ 8.25s    │ CI          │ commit ghi789       │ [View] │    ┃
┃ │ Nov 10, 10:22       │ ✓ Pass │ 8.18s    │ CI          │ commit def456       │ [View] │    ┃
┃ │ Nov 09, 16:45       │ ✓ Pass │ 8.32s    │ CI          │ commit abc123       │ [View] │    ┃
┃ │ Nov 09, 14:15       │ ⚠️ Flaky│ 12.45s   │ CI          │ commit xyz789       │ [View] │    ┃
┃ │   (retry passed)    │        │          │             │                     │        │    ┃
┃ │ Nov 08, 11:30       │ ✓ Pass │ 8.05s    │ CI          │ commit lmn456       │ [View] │    ┃
┃ │ Nov 07, 18:20       │ ✓ Pass │ 8.42s    │ Staging     │ Manual (Alice)      │ [View] │    ┃
┃ │ ... [View All]      │        │          │             │                     │        │    ┃
┃ └─────────────────────┴────────┴──────────┴─────────────┴─────────────────────┴────────┘    ┃
┃                                                                                                ┃
┃ Success Rate (Last 30 days): 98.5% (1 flaky, 0 failed)                                        ┃
┃ Average Duration: 8.2 seconds                                                                  ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━ TEST ARTIFACTS ━━━━━━━━━━━━━━━━━                                           ┃
┃                                                                                                ┃
┃ From Last Run (Nov 10, 14:35):                                                                 ┃
┃ • Screenshots: 12 screenshots captured at each step                      [View Gallery]       ┃
┃ • Video Recording: test-recording.mp4 (8.2s, 2.4 MB)                     [Play Video]         ┃
┃ • Console Logs: console-output.txt (42 KB)                               [Download]           ┃
┃ • Network Traffic: network-log.har (156 KB)                              [Download]           ┃
┃                                                                                                ┃
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ┃
┃ [Edit Test] [Run Test Now] [View in IDE] [Delete] [Clone] [Export]                            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Key Features & Interactions

### 1. Three-Level Coverage Tracking
- **Unit Tests**: Function-level testing
- **Integration Tests**: Service interaction testing
- **E2E Tests**: Complete user journey testing
- Each level tracked separately with aggregated coverage

### 2. AI-Powered Test Generation
- **Auto-Generate**: Create test cases from use case flows
- **Smart Scenarios**: Cover main flow and alternative flows
- **Editable**: Human review and refinement

### 3. Coverage Gap Identification
- **Automatic Detection**: System identifies untested scenarios
- **Risk Assessment**: Prioritize gaps by risk level
- **Actionable**: Direct links to create missing tests

### 4. CI/CD Integration
- **Automatic Reporting**: Tests report results to platform
- **Coverage Tracking**: Real-time coverage updates
- **Trend Analysis**: Track coverage over time

### 5. Test Execution History
- **Full History**: All test runs logged
- **Artifacts**: Screenshots, videos, logs
- **Flaky Detection**: Identify unstable tests

---

## Data Collection Flow

```
Test Case Created
      ↓
  Linked to Use Case
      ↓
  Test Implemented in Codebase
      ↓
  @test-case metadata in test file
      ↓
  CI/CD runs tests
      ↓
  Coverage report generated
      ↓
  MCP: report_test_execution
      ↓
  Dashboard updates:
  • Test execution status
  • Coverage percentage
  • Pass/fail status
  • Duration
      ↓
  Use case coverage recalculated
      ↓
  Component coverage aggregated
```

---

## Design Principles

1. **Use Case-Centric**: All tests linked to use cases
2. **Three-Level Visibility**: Unit, Integration, E2E clearly separated
3. **Gap-Driven**: Proactively identify and fill coverage gaps
4. **Automated**: CI/CD automatically updates coverage
5. **Actionable**: Every metric leads to an action

---

## Coverage Calculation

```
Use Case Overall Coverage =
  (0.3 × Unit Coverage) +
  (0.3 × Integration Coverage) +
  (0.4 × E2E Coverage)

Component Overall Coverage =
  Average of all use case coverages in component

Weighted by priority:
  Critical use cases count more
```

---

## CI/CD Integration Example

```yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: npm test -- --coverage

- name: Report to AI Studio
  run: |
    # Parse test results (JUnit XML, etc.)
    for test in $(parse_test_results); do
      curl -X POST $MCP_SERVER/report_test_execution \
        -H "Content-Type: application/json" \
        -d '{
          "test_case_key": "'$test_key'",
          "status": "'$test_status'",
          "coverage_percentage": '$coverage',
          "duration_ms": '$duration',
          "commit_hash": "'$GITHUB_SHA'",
          "ci_run_id": "'$GITHUB_RUN_ID'"
        }'
    done
```

---

## Test Metadata in Code

```typescript
// tests/e2e/auth/password-reset.spec.ts
// @test-case TC-AUTH-101
// @use-case UC-AUTH-003
// @priority high
// @level e2e

describe('TC-AUTH-101: Complete password reset flow', () => {
  test('should allow user to reset password via email', async ({ page }) => {
    // Test implementation...
  });
});
```

This metadata enables automatic linking of test execution results to test cases and use cases.
