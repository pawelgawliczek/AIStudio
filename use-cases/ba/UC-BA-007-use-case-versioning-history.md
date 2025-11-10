# UC-BA-007: Use Case Versioning and History Tracking

## Overview
Track complete history of use case changes with references to stories/epics/bugs that triggered modifications. Archive obsolete use cases while maintaining change history and traceability.

## Actor
BA, PM, Architect, Developer

## Preconditions
- User is authenticated
- Use case exists in the system
- User has permission to view/edit use cases

## Main Flow

### Viewing Use Case with History

1. User navigates to Use Case view and selects a use case (e.g., UC-AUTH-003)
2. System displays use case detail modal with **current active version** at top
3. System shows "Version History" section below current version

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ UC-AUTH-003: Password Reset Flow                                    [✕] [Edit]  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                  ┃
┃ Status: 🟢 Active │ Current Version: v3 │ Last Modified: Nov 10, 2025           ┃
┃ Component: 🏷️ Authentication, 🏷️ Email Service                                  ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ CURRENT VERSION (v3) ━━━━━━━━━━━━━━━━━                       ┃
┃                                                                                  ┃
┃ Modified By: BA Agent │ Modified Date: Nov 10, 2025 │ Changed by: ST-42        ┃
┃                                                                                  ┃
┃ Change Summary:                                                                  ┃
┃ • Added rate limiting requirement (max 3 reset requests per hour per email)     ┃
┃ • Updated token expiration from 30 min to 1 hour                                ┃
┃ • Added business rule for concurrent reset request handling                     ┃
┃                                                                                  ┃
┃ Main Success Scenario:                                                           ┃
┃ 1. User clicks "Forgot Password" link on login page                             ┃
┃ 2. System displays password reset request form                                  ┃
┃ 3. User enters email address                                                     ┃
┃ 4. System validates email exists in database                                     ┃
┃ 5. System checks rate limiting (max 3 requests/hour)         ← NEW (v3)         ┃
┃ 6. System generates unique, cryptographically secure reset token                ┃
┃ 7. System stores token with 1-hour expiration                ← CHANGED (v3: was 30min) │
┃ 8. System sends email with reset link containing token                          ┃
┃ 9. User receives email and clicks reset link                                    ┃
┃ 10. System validates token (not expired, not already used)                      ┃
┃ 11. System displays new password form                                           ┃
┃ 12. User enters new password (twice for confirmation)                           ┃
┃ 13. System validates password meets strength requirements                       ┃
┃ 14. System updates password, invalidates token                                  ┃
┃ 15. System displays success message                                             ┃
┃ 16. User redirected to login page                                               ┃
┃                                                                                  ┃
┃ Business Rules:                                                                  ┃
┃ • Reset token expires after 1 hour                           ← CHANGED (v3)     ┃
┃ • Token is single-use only                                                       ┃
┃ • Password must meet strength requirements                                      ┃
┃ • Rate limiting: Max 3 reset requests per email per hour     ← NEW (v3)         ┃
┃ • Security: Never reveal whether email exists in system                         ┃
┃                                                                                  ┃
┃ [View Full Use Case Details]                                                     ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ VERSION HISTORY (3 versions) ━━━━━━━━━━━━━━━━━               ┃
┃                                                                                  ┃
┃ ┌────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ v3 - Nov 10, 2025 (CURRENT) ✓                                             │  ┃
┃ │                                                                            │  ┃
┃ │ Modified by: BA Agent on Nov 10, 2025 at 14:35                            │  ┃
┃ │ Triggered by: Story ST-42 "Implement password reset flow"                 │  ┃
┃ │               (Epic: EP-3 User Authentication)                             │  ┃
┃ │                                                                            │  ┃
┃ │ Change Reason: "User reported security concern about token expiration     │  ┃
┃ │                being too short. Also added rate limiting to prevent abuse"│  ┃
┃ │                                                                            │  ┃
┃ │ Changes Made:                                                              │  ┃
┃ │ • ✏️ Modified: Token expiration extended from 30 min → 1 hour             │  ┃
┃ │ • ➕ Added: Rate limiting rule (max 3 requests per hour per email)        │  ┃
┃ │ • ➕ Added: Alternative flow 4b for rate limit exceeded                   │  ┃
┃ │ • ➕ Added: Business rule for concurrent reset requests                   │  ┃
┃ │                                                                            │  ┃
┃ │ Impact:                                                                    │  ┃
┃ │ • 3 existing tests need updates (token expiration tests)                  │  ┃
┃ │ • 2 new tests required (rate limiting)                                    │  ┃
┃ │ • Implementation estimate: +15K tokens                                    │  ┃
┃ │                                                                            │  ┃
┃ │ [View Full v3] [Compare v3 ↔ v2] [View ST-42]                             │  ┃
┃ └────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                  ┃
┃ ┌────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ v2 - Oct 28, 2025                                                          │  ┃
┃ │                                                                            │  ┃
┃ │ Modified by: Alice Chen (BA)                                              │  ┃
┃ │ Triggered by: Bug BUG-18 "Password reset fails for OAuth users"           │  ┃
┃ │               (Epic: EP-3 User Authentication)                             │  ┃
┃ │                                                                            │  ┃
┃ │ Change Reason: "OAuth users don't have passwords in our system, causing   │  ┃
┃ │                reset flow to fail. Added handling for this edge case"     │  ┃
┃ │                                                                            │  ┃
┃ │ Changes Made:                                                              │  ┃
┃ │ • ✏️ Modified: Step 4 - Validate email AND check if user has password     │  ┃
┃ │ • ➕ Added: Alternative flow 4c for OAuth-only users                      │  ┃
┃ │ • ➕ Added: Precondition: User has password-based account                 │  ┃
┃ │                                                                            │  ┃
┃ │ Impact:                                                                    │  ┃
┃ │ • Fixed production bug affecting 12% of users                             │  ┃
┃ │ • 1 new test required (OAuth user handling)                               │  ┃
┃ │                                                                            │  ┃
┃ │ [View Full v2] [Compare v2 ↔ v1] [Restore v2] [View BUG-18]              │  ┃
┃ └────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                  ┃
┃ ┌────────────────────────────────────────────────────────────────────────────┐  ┃
┃ │ v1 - Oct 1, 2025 (ORIGINAL)                                                │  ┃
┃ │                                                                            │  ┃
┃ │ Created by: Alice Chen (BA)                                               │  ┃
┃ │ Triggered by: Epic EP-3 "User Authentication"                             │  ┃
┃ │                                                                            │  ┃
┃ │ Initial Version: Basic password reset flow with email-based token         │  ┃
┃ │                                                                            │  ┃
┃ │ [View Full v1] [Restore v1]                                               │  ┃
┃ └────────────────────────────────────────────────────────────────────────────┘  ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ RELATED ITEMS ━━━━━━━━━━━━━━━━━                              ┃
┃                                                                                  ┃
┃ Stories/Bugs that Modified This Use Case:                                       ┃
┃ • ST-42: Implement password reset flow (v3 change) - In Progress               ┃
┃ • BUG-18: Password reset fails for OAuth users (v2 change) - Fixed             ┃
┃ • EP-3: User Authentication (v1 creation) - In Progress                         ┃
┃                                                                                  ┃
┃ Stories Currently Using This Use Case:                                          ┃
┃ • ST-42: Implement password reset flow - In Progress                            ┃
┃ • ST-135: Add MFA to password reset - Backlog                                   ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ┃
┃ [Create New Version] [Archive Use Case] [Export History] [Close]                ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Modifying Use Case (Creating New Version)

4. User clicks "Edit" or "Create New Version" on active use case
5. System displays edit mode with change tracking form:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ EDIT USE CASE: UC-AUTH-003 (Creating v4)                                        ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ CHANGE TRACKING ━━━━━━━━━━━━━━━━━                            ┃
┃                                                                                  ┃
┃ Triggered By: [Story/Epic/Bug Selector ▼]                                       ┃
┃ Selected: ST-156 "Add 2FA support to password reset"                            ┃
┃                                                                                  ┃
┃ Change Reason: (Required)                                                        ┃
┃ ┌──────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ Adding 2FA verification step to password reset flow for enhanced        │    ┃
┃ │ security. Users with 2FA enabled must verify via authenticator app      │    ┃
┃ │ before resetting password.                                               │    ┃
┃ └──────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                  ┃
┃ Change Type: (Select all that apply)                                             ┃
┃ ☐ Added new steps                                                                ┃
┃ ☐ Modified existing steps                                                        ┃
┃ ☐ Removed steps                                                                  ┃
┃ ☐ Added alternative flows                                                        ┃
┃ ☑ Added business rules                                                           ┃
┃ ☐ Modified preconditions/postconditions                                          ┃
┃ ☐ Changed components/layers                                                      ┃
┃ ☐ Security enhancement                                                           ┃
┃ ☐ Bug fix                                                                        ┃
┃ ☑ Feature addition                                                               ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ USE CASE EDITOR ━━━━━━━━━━━━━━━━━                            ┃
┃                                                                                  ┃
┃ [Full use case editing interface with track changes highlighting...]            ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ IMPACT ASSESSMENT ━━━━━━━━━━━━━━━━━                          ┃
┃                                                                                  ┃
┃ System auto-detects:                                                             ┃
┃ • 3 existing test cases may need updates                                        ┃
┃ • 2 stories currently using this use case:                                      ┃
┃   - ST-42 (In Progress) - May be affected                                       ┃
┃   - ST-135 (Backlog) - May need re-analysis                                     ┃
┃ • Estimated implementation impact: +25K tokens                                  ┃
┃                                                                                  ┃
┃ Notify affected teams? ☑ Yes  ☐ No                                              ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ┃
┃ [Cancel] [Save as Draft] [Publish New Version (v4)]                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

6. User fills in change tracking information:
   - Selects story/epic/bug that triggered the change (required)
   - Enters change reason (required, minimum 20 characters)
   - Selects change types (at least one required)
   - Edits use case content

7. System tracks all changes:
   - Highlights modified sections in editor
   - Marks additions in green
   - Marks deletions in red
   - Tracks which steps were added/modified/removed

8. User clicks "Publish New Version (v4)"
9. System:
   - Creates new version v4 with timestamp
   - Links v4 to triggering story (ST-156)
   - Preserves v3 as historical version
   - Sets v4 as current active version
   - Logs change in activity log
   - Notifies affected teams if selected
   - Updates all stories linked to this use case with notification

10. System displays success confirmation:
    ```
    ✓ Use Case UC-AUTH-003 updated to v4

    • New version published and set as active
    • Previous version (v3) preserved in history
    • Linked to ST-156 "Add 2FA support to password reset"
    • 2 teams notified of change (Dev team, QA team)

    [View New Version] [Back to Use Case Library]
    ```

### Comparing Versions

11. User clicks "Compare v4 ↔ v3" from version history
12. System displays side-by-side diff view:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ COMPARE VERSIONS: UC-AUTH-003 v4 ↔ v3                                           ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                  ┃
┃ Comparison: v4 (Nov 12, 2025) vs v3 (Nov 10, 2025)                              ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ CHANGES SUMMARY ━━━━━━━━━━━━━━━━━                            ┃
┃                                                                                  ┃
┃ • 3 steps modified                                                               ┃
┃ • 2 alternative flows added                                                      ┃
┃ • 1 business rule added                                                          ┃
┃ • 1 precondition modified                                                        ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ SIDE-BY-SIDE DIFF ━━━━━━━━━━━━━━━━━                          ┃
┃                                                                                  ┃
┃ ┌─────────────────────────────────┬─────────────────────────────────────────┐   ┃
┃ │ v3 (Previous)                   │ v4 (Current)                            │   ┃
┃ ├─────────────────────────────────┼─────────────────────────────────────────┤   ┃
┃ │ Main Success Scenario:          │ Main Success Scenario:                  │   ┃
┃ │ ...                             │ ...                                     │   ┃
┃ │ 9. System validates token       │ 9. System validates token               │   ┃
┃ │ 10. System displays new         │ 10. System checks if user has 2FA   ⬅ NEW│   ┃
┃ │     password form               │ 11. IF 2FA enabled:                 ⬅ NEW│   ┃
┃ │                                 │     - System prompts for 2FA code   ⬅ NEW│   ┃
┃ │                                 │     - User enters 2FA code          ⬅ NEW│   ┃
┃ │                                 │     - System validates 2FA code     ⬅ NEW│   ┃
┃ │                                 │ 12. System displays new password form   │   ┃
┃ │ 11. User enters new password    │ 13. User enters new password            │   ┃
┃ │ ...                             │ ...                                     │   ┃
┃ │                                 │                                         │   ┃
┃ │ Business Rules:                 │ Business Rules:                         │   ┃
┃ │ • Reset token expires 1 hour    │ • Reset token expires 1 hour            │   ┃
┃ │ • Token is single-use only      │ • Token is single-use only              │   ┃
┃ │ • Rate limiting: Max 3/hour     │ • Rate limiting: Max 3/hour             │   ┃
┃ │                                 │ • 2FA required for users with 2FA   ⬅ NEW│   ┃
┃ │                                 │   enabled                           ⬅ NEW│   ┃
┃ └─────────────────────────────────┴─────────────────────────────────────────┘   ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ METADATA COMPARISON ━━━━━━━━━━━━━━━━━                        ┃
┃                                                                                  ┃
┃ v3: Modified by BA Agent | Triggered by ST-42 | Date: Nov 10, 2025              ┃
┃ v4: Modified by Alice Chen | Triggered by ST-156 | Date: Nov 12, 2025           ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ┃
┃ [Export Diff] [Restore v3] [Close]                                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Archiving Obsolete Use Case

13. User determines use case is no longer relevant
14. User clicks "Archive Use Case" button
15. System displays archive confirmation dialog:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ARCHIVE USE CASE: UC-AUTH-003                                                    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                  ┃
┃ ⚠️ You are about to archive this use case                                       ┃
┃                                                                                  ┃
┃ Use Case: UC-AUTH-003 "Password Reset Flow"                                     ┃
┃ Current Version: v4                                                              ┃
┃ Linked Stories: 2 (ST-42 - Done, ST-135 - Backlog)                              ┃
┃                                                                                  ┃
┃ Archiving will:                                                                  ┃
┃ • Move use case to "Archived" status (still viewable)                           ┃
┃ • Preserve complete version history                                             ┃
┃ • Prevent new stories from linking to it                                        ┃
┃ • Notify teams currently using this use case                                    ┃
┃ • Add archive note to use case record                                           ┃
┃                                                                                  ┃
┃ Triggered By: [Story/Epic/Bug Selector ▼]                                       ┃
┃ Selected: ST-200 "Remove password auth, migrate to OAuth-only"                  ┃
┃                                                                                  ┃
┃ Archive Reason: (Required)                                                       ┃
┃ ┌──────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ Migrating to OAuth-only authentication. Password-based auth including    │    ┃
┃ │ password reset is being deprecated. Users will authenticate via Google   │    ┃
┃ │ and GitHub OAuth only. See ST-200 for migration plan.                    │    ┃
┃ └──────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                  ┃
┃ Recommended Replacement Use Case: (Optional)                                     ┃
┃ [UC-AUTH-015: OAuth Account Recovery ▼]                                         ┃
┃                                                                                  ┃
┃ Notify affected teams? ☑ Yes  ☐ No                                              ┃
┃ Teams to notify: Dev Team, QA Team                                              ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ┃
┃ [Cancel] [Confirm Archive]                                                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

16. User fills in:
    - Triggering story/epic/bug (required)
    - Archive reason (required, minimum 50 characters)
    - Recommended replacement use case (optional)
    - Notification preference

17. User clicks "Confirm Archive"
18. System:
    - Sets use case status to "Archived"
    - Records archive metadata (date, user, reason, triggering story)
    - Links to replacement use case if provided
    - Notifies affected teams
    - Preserves complete version history
    - Updates related stories with archive notification

19. Archived use case now displays with archived banner:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ⚠️ ARCHIVED USE CASE - Historical Reference Only                                ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                  ┃
┃ UC-AUTH-003: Password Reset Flow (Archived)                                     ┃
┃                                                                                  ┃
┃ Status: 🔴 Archived │ Archived Date: Nov 20, 2025 │ Final Version: v4            ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ ARCHIVE INFORMATION ━━━━━━━━━━━━━━━━━                        ┃
┃                                                                                  ┃
┃ Archived By: Alice Chen (BA)                                                    ┃
┃ Archived Date: Nov 20, 2025                                                      ┃
┃ Triggered By: ST-200 "Remove password auth, migrate to OAuth-only"              ┃
┃                (Epic: EP-12 OAuth Migration)                                     ┃
┃                                                                                  ┃
┃ Archive Reason:                                                                  ┃
┃ "Migrating to OAuth-only authentication. Password-based auth including          ┃
┃  password reset is being deprecated. Users will authenticate via Google         ┃
┃  and GitHub OAuth only. See ST-200 for migration plan."                         ┃
┃                                                                                  ┃
┃ Replacement Use Case:                                                            ┃
┃ → UC-AUTH-015: OAuth Account Recovery                        [View]              ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ VERSION HISTORY (4 versions) ━━━━━━━━━━━━━━━━━               ┃
┃                                                                                  ┃
┃ v4 - Nov 12, 2025 (FINAL VERSION)                                               ┃
┃ Modified by Alice Chen | Triggered by: ST-156                                   ┃
┃ [View Full v4] [Compare v4 ↔ v3]                                                ┃
┃                                                                                  ┃
┃ v3 - Nov 10, 2025                                                                ┃
┃ Modified by BA Agent | Triggered by: ST-42                                      ┃
┃ [View Full v3] [Compare v3 ↔ v2]                                                ┃
┃                                                                                  ┃
┃ v2 - Oct 28, 2025                                                                ┃
┃ Modified by Alice Chen | Triggered by: BUG-18                                   ┃
┃ [View Full v2] [Compare v2 ↔ v1]                                                ┃
┃                                                                                  ┃
┃ v1 - Oct 1, 2025 (ORIGINAL)                                                      ┃
┃ Created by Alice Chen | Triggered by: EP-3                                      ┃
┃ [View Full v1]                                                                   ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━ STORIES THAT USED THIS USE CASE ━━━━━━━━━━━━━━━━━           ┃
┃                                                                                  ┃
┃ • ST-42: Implement password reset flow - Done (used v3)                         ┃
┃ • ST-135: Add MFA to password reset - Cancelled (was backlog, used v4)          ┃
┃ • BUG-18: Password reset fails for OAuth users - Fixed (caused v2 update)       ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ┃
┃ [Restore from Archive] [Export Complete History] [Close]                        ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Viewing Archive History

20. User navigates to Use Case Library
21. User toggles "Show Archived" filter
22. System displays archived use cases with archive status indicator:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ USE CASE LIBRARY - 248 active + 15 archived                                     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                  ┃
┃ Filters: Status: [Active ▼] [☑ Show Archived]                                   ┃
┃                                                                                  ┃
┃ ┌──────────────────────────────────────────────────────────────────────────────┐ ┃
┃ │ 🔴 UC-AUTH-003: Password Reset Flow (Archived)                               │ ┃
┃ │                                                                              │ ┃
┃ │ Archived: Nov 20, 2025 | Reason: OAuth migration | Replaced by: UC-AUTH-015 │ ┃
┃ │ Final Version: v4 | Triggered by: ST-200                                     │ ┃
┃ │                                                                              │ ┃
┃ │ [View Details] [View History] [Restore]                                     │ ┃
┃ └──────────────────────────────────────────────────────────────────────────────┘ ┃
┃                                                                                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Restoring Archived Use Case

23. User clicks "Restore from Archive" on archived use case
24. System displays restoration confirmation:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ RESTORE USE CASE FROM ARCHIVE                                                    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                                  ┃
┃ Use Case: UC-AUTH-003 "Password Reset Flow"                                     ┃
┃ Archived: Nov 20, 2025 (30 days ago)                                            ┃
┃                                                                                  ┃
┃ Restoring will:                                                                  ┃
┃ • Set status back to "Active"                                                    ┃
┃ • Allow new stories to link to it                                               ┃
┃ • Preserve complete history including archive record                            ┃
┃ • Notify teams of restoration                                                    ┃
┃                                                                                  ┃
┃ Triggered By: [Story/Epic/Bug Selector ▼]                                       ┃
┃ Selected: ST-250 "Re-add password auth for enterprise customers"                ┃
┃                                                                                  ┃
┃ Restoration Reason: (Required)                                                   ┃
┃ ┌──────────────────────────────────────────────────────────────────────────┐    ┃
┃ │ Enterprise customers require password-based auth option. Re-enabling     │    ┃
┃ │ password reset functionality alongside OAuth. See ST-250 for details.    │    ┃
┃ └──────────────────────────────────────────────────────────────────────────┘    ┃
┃                                                                                  ┃
┃ Restore as: ● New version (v5) ○ Restore v4 as-is                               ┃
┃                                                                                  ┃
┃ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ┃
┃ [Cancel] [Confirm Restore]                                                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

25. User confirms restoration
26. System:
    - Sets status to "Active"
    - Creates restoration record in history
    - Links restoration to triggering story (ST-250)
    - Optionally creates new version if selected
    - Notifies teams
    - Logs restoration event

## Postconditions
- Complete audit trail of all use case changes exists
- Every version is linked to the story/epic/bug that triggered it
- Archived use cases remain viewable with full history
- Teams are notified of significant changes
- Version comparisons clearly show what changed and why

## Alternative Flows

### 4a. Quick edit without version tracking
- At step 4, user makes minor typo fix or formatting change
- User selects "Minor Edit (no new version)"
- System updates current version in-place
- Logs edit in activity log but doesn't create new version
- Use for: typo fixes, formatting, clarifications that don't change meaning

### 8a. Draft version before publishing
- At step 8, user clicks "Save as Draft"
- System saves work in progress without creating official version
- Draft visible only to creator
- Can be edited multiple times before publishing
- Other users still see current active version
- Useful for: complex changes requiring review, multi-day edits

### 13a. Soft delete instead of archive
- At step 13, user needs to remove use case completely (rare)
- User has admin permission to delete
- System displays delete confirmation with stricter warnings
- Deletion moves to "Deleted" status (still recoverable by admin)
- Complete history preserved
- Use sparingly - archive is preferred

### 20a. View change timeline
- User clicks "View Timeline" on use case
- System displays visual timeline of all changes:
  ```
  Nov 20, 2025  ━━━ 🔴 Archived (ST-200: OAuth migration)
                │
  Nov 12, 2025  ━━━ v4 Created (ST-156: Add 2FA support)
                │
  Nov 10, 2025  ━━━ v3 Created (ST-42: Implement password reset)
                │
  Oct 28, 2025  ━━━ v2 Created (BUG-18: OAuth user fix)
                │
  Oct 1, 2025   ━━━ v1 Created (EP-3: User Authentication)
  ```
- Each event clickable to view details
- Shows relationship between stories and use case evolution

### 11a. Bulk compare multiple versions
- User selects 3+ versions to compare
- System shows matrix view:
  - Rows: Use case sections (preconditions, main flow, business rules, etc.)
  - Columns: Selected versions
  - Cells: Content with change highlights
- Useful for: understanding evolution over time, identifying patterns

## Business Rules

### Versioning Rules
- New version created when content materially changes
- Minor edits (typos, formatting) don't create new version
- Each version must have:
  - Triggering story/epic/bug (required)
  - Change reason (min 20 chars)
  - At least one change type selected
  - Timestamp and author
- Maximum 100 versions per use case (unlikely to reach)

### Archive Rules
- Only "Active" use cases can be archived
- Archived use cases cannot be linked to new stories
- Existing story links preserved (read-only)
- Archive requires:
  - Triggering story/epic/bug
  - Archive reason (min 50 chars)
  - Optional replacement use case
- Archived use cases remain searchable
- Can be restored at any time with reason

### History Retention
- All versions preserved indefinitely
- No automatic deletion of old versions
- Archive records never deleted
- Complete audit trail maintained

### Notifications
- Teams notified when:
  - Use case they're using is modified (optional, default: yes)
  - Use case they're using is archived (required)
  - Archived use case is restored (required)
- Notification includes:
  - What changed
  - Why (change reason)
  - Triggering story link
  - Impact assessment

## Technical Implementation

### Data Model
```sql
use_case_versions (
  id SERIAL PRIMARY KEY,
  use_case_id INT REFERENCES use_cases(id),
  version_number INT,
  content JSONB,              -- Full use case content
  created_at TIMESTAMP,
  created_by INT REFERENCES users(id),
  triggered_by_item_id INT,   -- Story/Epic/Bug ID
  triggered_by_item_type VARCHAR, -- 'story', 'epic', 'bug'
  change_reason TEXT,
  change_types JSONB,         -- Array of change type flags
  status VARCHAR              -- 'active', 'archived', 'draft'
)

use_case_archive_records (
  id SERIAL PRIMARY KEY,
  use_case_id INT REFERENCES use_cases(id),
  archived_at TIMESTAMP,
  archived_by INT REFERENCES users(id),
  triggered_by_item_id INT,
  triggered_by_item_type VARCHAR,
  archive_reason TEXT,
  replacement_use_case_id INT REFERENCES use_cases(id),
  restored_at TIMESTAMP NULL,
  restored_by INT NULL,
  restoration_reason TEXT NULL
)
```

### Version Comparison
- Use diff library (e.g., `google-diff-match-patch`, `jsdiff`)
- Store diffs for efficient comparison
- Generate diffs on-demand for any two versions
- Highlight changes with color coding

### MCP Tools
- `create_use_case_version(use_case_id, content, triggered_by, change_reason, change_types)`
- `archive_use_case(use_case_id, triggered_by, archive_reason, replacement_id)`
- `restore_use_case(use_case_id, triggered_by, restoration_reason, create_new_version)`
- `get_use_case_history(use_case_id)`
- `compare_use_case_versions(use_case_id, version1, version2)`

## Related Use Cases
- UC-BA-001: Analyze Story Requirements (creates/updates use cases)
- UC-BA-004: Search Use Case Library (search includes archived)
- UC-PM-003: Create Story (can link to use cases)
- UC-PM-007: JIRA-like Planning View (shows linked use cases)

## Acceptance Criteria
- ✓ Use case detail view shows current version and complete history
- ✓ Version history displays all versions with metadata:
  - Version number, date, author
  - Triggering story/epic/bug with link
  - Change reason
  - Change types
- ✓ Creating new version requires:
  - Triggering item selection
  - Change reason (min 20 chars)
  - At least one change type
- ✓ Version comparison shows side-by-side diff with highlights
- ✓ Archive functionality requires:
  - Triggering item
  - Archive reason (min 50 chars)
  - Confirmation dialog
- ✓ Archived use cases display with clear archived status banner
- ✓ Archived use cases show:
  - Archive date, author, reason
  - Triggering item link
  - Optional replacement use case
  - Complete version history
  - List of stories that used it
- ✓ Restore functionality works with:
  - Triggering item
  - Restoration reason
  - Option to create new version or restore as-is
- ✓ Use case library can filter by archived status
- ✓ Teams are notified of changes/archive/restore events
- ✓ All version history is preserved indefinitely
- ✓ Timeline view shows visual representation of changes
- ✓ Change tracking highlights modifications in editor
- ✓ Impact assessment identifies affected stories and tests
- ✓ Search includes archived use cases (with clear indication)
- ✓ Version restore creates new version with restoration metadata
