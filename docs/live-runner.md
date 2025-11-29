# Story Runner - Comprehensive Implementation Plan

## Overview

**Feature Name:** Story Runner
**Purpose:** Live execution view for AI agent teams with interactive controls, chat, and artifact management
**Scope:** Full experience - Kanban, chat, artifacts, breakpoints, Docker isolation
**Approach:** Design-first (all screens designed before implementation)

---

## Architecture Summary

### Core Concept
Teams have configurable Kanban boards where columns map to agents. Stories flow through columns as agents execute. Users can set breakpoints, chat with executions, comment on artifacts, and upload supporting files.

### Execution Model
- **Claude Code Everywhere**: All AI interactions use Claude Code (Task tool spawning) - no direct API calls
- **Zero Extra Cost**: Users with Claude Code subscription pay nothing extra
- **Sibling Containers**: Backend manages runner containers as siblings via Docker socket (not DinD)
- **Worktree Isolation**: Each container only accesses its story's worktree

### Claude Code Integration (No API Costs)
Instead of calling Claude API directly for chat, we spawn Claude Code agents:
```
User Chat Message → Backend → Spawn Claude Code Agent (Task tool)
                           → Agent receives story context
                           → Agent responds via MCP callback
                           → Response streamed to user via WebSocket
```

---

## Text-Based GUI Designs

### 1. Story Runner Hub (`/story-runner`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VibeStudio                                    [Projects ▾] [👤 User ▾]     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ STORY RUNNER ──────────────────────────────────────────────────────────┐│
│  │                                                                         ││
│  │  Select a story to run through your agent pipeline                      ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │ 🔍 Search stories...                              [Filter ▾]    │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  │                                                                         ││
│  │  READY TO RUN                                                           ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │ ST-156  Add dark mode toggle              │ Software Dev Team    │ ││
│  │  │ ────────────────────────────────────────────────────────────────── ││
│  │  │ Status: analysis │ Priority: high │ Assigned: Claude Agent       │ ││
│  │  │                                                        [▶ RUN]   │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │ ST-158  Fix login validation bug          │ Bug Squad            │ ││
│  │  │ ────────────────────────────────────────────────────────────────── ││
│  │  │ Status: planning │ Priority: critical │ Assigned: —              │ ││
│  │  │                                                        [▶ RUN]   │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  │                                                                         ││
│  │  CURRENTLY RUNNING                                                      ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │ ST-152  User authentication refactor      │ 🟢 Running            │ ││
│  │  │ ────────────────────────────────────────────────────────────────── ││
│  │  │ Agent: Architect │ Progress: ████████░░ 75% │ 12m 34s            │ ││
│  │  │                                              [View] [⏸ Pause]    │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  │                                                                         ││
│  │  PAUSED AT BREAKPOINT                                                   ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │ ST-149  API rate limiting                 │ 🟡 Paused             │ ││
│  │  │ ────────────────────────────────────────────────────────────────── ││
│  │  │ Waiting: After Architect │ Paused: 5m ago                        │ ││
│  │  │                                      [View] [▶ Resume] [⏭ Skip]  │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Run Configuration Modal (Before Starting)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ┌─ RUN ST-156: Add dark mode toggle ────────────────────────────────[X]─┐ │
│   │                                                                       │ │
│   │  TEAM                                                                 │ │
│   │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│   │  │ Software Development Team                                    ▾  │ │ │
│   │  └─────────────────────────────────────────────────────────────────┘ │ │
│   │                                                                       │ │
│   │  RUN MODE                                                             │ │
│   │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│   │  │ ○ Full Auto      Run through all agents without stopping        │ │ │
│   │  │ ● With Breaks    Pause at configured breakpoints                │ │ │
│   │  │ ○ Step-by-Step   Pause after each agent for review              │ │ │
│   │  └─────────────────────────────────────────────────────────────────┘ │ │
│   │                                                                       │ │
│   │  BREAKPOINTS (pause after)                                            │ │
│   │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│   │  │ □ Explorer       Explore codebase and gather context            │ │ │
│   │  │ ☑ Analyst        Analyze requirements and acceptance criteria   │ │ │
│   │  │ ☑ Architect      Design technical approach and file changes     │ │ │
│   │  │ □ Designer       Create UI/UX specifications                    │ │ │
│   │  │ □ Implementer    Write the actual code changes                  │ │ │
│   │  │ □ Reviewer       Review code quality and suggest fixes          │ │ │
│   │  └─────────────────────────────────────────────────────────────────┘ │ │
│   │                                                                       │ │
│   │  CONTAINER RESOURCES                                                  │ │
│   │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│   │  │ ○ Light    1 CPU, 2GB RAM, 30 min timeout                       │ │ │
│   │  │ ● Medium   2 CPU, 4GB RAM, 60 min timeout                       │ │ │
│   │  │ ○ Heavy    4 CPU, 8GB RAM, 120 min timeout                      │ │ │
│   │  │ ○ Custom   [2] CPU  [4] GB RAM  [60] min timeout                │ │ │
│   │  └─────────────────────────────────────────────────────────────────┘ │ │
│   │                                                                       │ │
│   │  ┌──────────────┐  ┌──────────────────────────────────────────────┐ │ │
│   │  │    Cancel    │  │              ▶ Start Execution               │ │ │
│   │  └──────────────┘  └──────────────────────────────────────────────┘ │ │
│   │                                                                       │ │
│   └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Main Execution View (`/story-runner/:storyKey/run/:runId`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VibeStudio  ›  Story Runner  ›  ST-156                 [👤 User ▾]         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ ST-156: Add dark mode toggle ───────────────────────────────────────┐  │
│  │  Team: Software Dev │ Running: 8m 23s │ Progress: ████░░░░ 50%       │  │
│  │                                          [⏸ Pause] [⏹ Stop] [⚙]     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─ KANBAN BOARD ────────────────────┐ ┌─ EXECUTION PANEL ───────────────┐ │
│  │                                   │ │                                 │ │
│  │ EXPLORER   ANALYST   ARCHITECT   │ │  [Artifacts] [Chat] [Logs]      │ │
│  │ ────────   ────────  ──────────  │ │  ─────────────────────────────  │ │
│  │                                   │ │                                 │ │
│  │ ┌───────┐                        │ │  ARTIFACTS                      │ │
│  │ │ ✓     │  ┌───────┐             │ │                                 │ │
│  │ │ Done  │  │ ✓     │  ┌───────┐  │ │  ┌─────────────────────────────┐│ │
│  │ │ 2m 15s│  │ Done  │  │ ●●●   │  │ │  │ 📄 architect_analysis.md   ││ │
│  │ └───────┘  │ 4m 32s│  │ Running│  │ │  │ ─────────────────────────  ││ │
│  │            └───────┘  │ 1m 36s│  │ │  │ Created: 2 min ago         ││ │
│  │                       │  45%  │  │ │  │ Size: 4.2 KB               ││ │
│  │                       └───────┘  │ │  │                             ││ │
│  │                                   │ │  │ ## Architecture Analysis   ││ │
│  │ DESIGNER  IMPLEMENTER  REVIEWER  │ │  │                             ││ │
│  │ ────────  ──────────   ────────  │ │  │ ### Current State          ││ │
│  │                                   │ │  │ The application uses...    ││ │
│  │ ┌───────┐  ┌───────┐  ┌───────┐  │ │  │                             ││ │
│  │ │   ○   │  │   ○   │  │   ○   │  │ │  │ ### Proposed Changes       ││ │
│  │ │Pending│  │Pending│  │Pending│  │ │  │ 1. Add ThemeProvider   [+] ││ │
│  │ │  🔴   │  │       │  │       │  │ │  │ 2. Create useTheme hook    ││ │
│  │ │BREAK  │  │       │  │       │  │ │  │ 3. Update color refs       ││ │
│  │ └───────┘  └───────┘  └───────┘  │ │  │                             ││ │
│  │                                   │ │  └─────────────────────────────┘│ │
│  │ ─────────────────────────────────│ │                                 │ │
│  │ ⚙ Configure Columns              │ │  ┌─────────────────────────────┐│ │
│  └───────────────────────────────────┘ │  │ 📊 explorer_context.json   ││ │
│                                         │  │ Created: 8 min ago | 12 KB ││ │
│                                         │  └─────────────────────────────┘│ │
│                                         │                                 │ │
│                                         └─────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4. Paused at Breakpoint View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  VibeStudio  ›  Story Runner  ›  ST-156                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ ST-156: Add dark mode toggle ───────────────────────────────────────┐  │
│  │  Team: Software Dev │ 🟡 PAUSED │ After: Architect │ Waiting: 2m 15s │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                                                                         ││
│  │  ⏸ PAUSED AT BREAKPOINT                                                 ││
│  │  ───────────────────────────────────────────────────────────────────── ││
│  │                                                                         ││
│  │  The execution is paused after the ARCHITECT agent.                    ││
│  │  Review the artifacts below and decide how to proceed.                 ││
│  │                                                                         ││
│  │  COMPLETED AGENTS                        PENDING AGENTS                 ││
│  │  ┌────────────────────────┐             ┌────────────────────────┐     ││
│  │  │ ✓ Explorer    2m 15s  │             │ ○ Designer    (next)   │     ││
│  │  │ ✓ Analyst     4m 32s  │             │ ○ Implementer          │     ││
│  │  │ ✓ Architect   3m 45s  │             │ ○ Reviewer             │     ││
│  │  └────────────────────────┘             └────────────────────────┘     ││
│  │                                                                         ││
│  │  ACTIONS                                                                ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │  [▶ Continue]     Resume to next breakpoint (Designer)           │ ││
│  │  │  [⏭ Skip Next]    Skip Designer, continue to Implementer          │ ││
│  │  │  [🏃 Run to End]   Skip all remaining breakpoints                  │ ││
│  │  │  [⏹ Stop]         Cancel execution                                │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│  ┌─ ARTIFACTS FROM ARCHITECT ───────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  📄 architect_analysis.md                            [View] [Comment] │  │
│  │  📊 file_changes.json                                [View] [Comment] │  │
│  │  📋 implementation_plan.md                           [View] [Comment] │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5. Artifact Viewer with Line Comments

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ architect_analysis.md ─────────────────────────────────────────────[X]─┐│
│  │                                                                         ││
│  │  Type: Report │ Size: 4.2 KB │ Agent: Architect │ 3 comments           ││
│  │  ─────────────────────────────────────────────────────────────────────  ││
│  │                                                                         ││
│  │     │ ## Architecture Analysis                                         ││
│  │     │                                                                   ││
│  │   1 │ ### Current State                                                ││
│  │   2 │ The application currently uses React 18 with TailwindCSS for    ││
│  │   3 │ styling. Theme management is handled through CSS classes.       ││
│  │     │                                                                   ││
│  │   4 │ ### Proposed Changes                                             ││
│  │   5 │ 1. **Add ThemeProvider wrapper** - Wrap App in context          ││
│  │   6 │ 2. **Create useTheme hook** - Expose toggle and current theme   ││
│  │     │   ┌─────────────────────────────────────────────────────────┐   ││
│  │     │   │ 💬 @pawel - 2 min ago                                   │   ││
│  │     │   │ Should we use CSS variables instead of Tailwind's       │   ││
│  │     │   │ dark: prefix? This would be more flexible.              │   ││
│  │     │   │                                                          │   ││
│  │     │   │ ☑ Influence next agent                                  │   ││
│  │     │   │                                        [Reply] [Resolve] │   ││
│  │     │   └─────────────────────────────────────────────────────────┘   ││
│  │   7 │ 3. **Update color references** - Replace hardcoded colors       ││
│  │   8 │ 4. **Add toggle in Settings** - User preference persistence     ││
│  │     │                                                           [+]   ││
│  │   9 │                                                                  ││
│  │  10 │ ### File Changes                                                 ││
│  │  11 │ - `frontend/src/context/ThemeContext.tsx` (new)                 ││
│  │  12 │ - `frontend/src/hooks/useTheme.ts` (new)                        ││
│  │  13 │ - `frontend/src/components/Layout.tsx` (modify)                 ││
│  │  14 │ - `frontend/src/pages/SettingsPage.tsx` (modify)                ││
│  │     │                                                                   ││
│  │  ─────────────────────────────────────────────────────────────────────  ││
│  │  COMMENTS (3)                                                          ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │ Line 6: CSS variables suggestion (unresolved) ☑ influence       │   ││
│  │  │ Line 11: Confirm context location (resolved)                    │   ││
│  │  │ General: Consider accessibility (unresolved) ☑ influence        │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  │                                                                         ││
│  │  ┌────────────────────────┐  ┌────────────────────────────────────┐    ││
│  │  │      Download          │  │       💬 Open Chat About This      │    ││
│  │  └────────────────────────┘  └────────────────────────────────────┘    ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6. Chat Panel (Claude Code Powered)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ CHAT: ST-156 ────────────────────────────────────────────────────────┐ │
│  │                                                                        │ │
│  │  Context: Architect phase │ Agent: Claude Code │ 1,245 tokens         │ │
│  │  ────────────────────────────────────────────────────────────────────  │ │
│  │                                                                        │ │
│  │  ┌───────────────────────────────────────────────────────────────┐    │ │
│  │  │ 🤖 SYSTEM                                           10:23 AM  │    │ │
│  │  │ ──────────────────────────────────────────────────────────────│    │ │
│  │  │ Chat session started. Context loaded:                         │    │ │
│  │  │ • Story: ST-156 - Add dark mode toggle                        │    │ │
│  │  │ • Current phase: After Architect                              │    │ │
│  │  │ • Artifacts: 3 files available                                │    │ │
│  │  │ • Comments: 2 unresolved (will influence next agent)          │    │ │
│  │  └───────────────────────────────────────────────────────────────┘    │ │
│  │                                                                        │ │
│  │  ┌───────────────────────────────────────────────────────────────┐    │ │
│  │  │ 👤 YOU                                              10:24 AM  │    │ │
│  │  │ ──────────────────────────────────────────────────────────────│    │ │
│  │  │ I noticed the architect suggested using Tailwind's dark:      │    │ │
│  │  │ prefix. But I think CSS variables would be better for         │    │ │
│  │  │ theming. Can you explain the trade-offs?                      │    │ │
│  │  └───────────────────────────────────────────────────────────────┘    │ │
│  │                                                                        │ │
│  │  ┌───────────────────────────────────────────────────────────────┐    │ │
│  │  │ 🤖 CLAUDE CODE                                      10:24 AM  │    │ │
│  │  │ ──────────────────────────────────────────────────────────────│    │ │
│  │  │ Great question! Here are the trade-offs:                      │    │ │
│  │  │                                                                │    │ │
│  │  │ **Tailwind dark: prefix**                                     │    │ │
│  │  │ ✅ Zero runtime overhead (compile-time)                       │    │ │
│  │  │ ✅ Excellent IDE support and autocomplete                     │    │ │
│  │  │ ❌ Verbose: every color needs `dark:` variant                 │    │ │
│  │  │                                                                │    │ │
│  │  │ **CSS Variables**                                              │    │ │
│  │  │ ✅ Single source of truth for colors                          │    │ │
│  │  │ ✅ Easy to add more themes later                              │    │ │
│  │  │ ❌ Slight runtime overhead (minimal)                          │    │ │
│  │  │                                                                │    │ │
│  │  │ Given your existing codebase uses Tailwind heavily, I'd       │    │ │
│  │  │ recommend a **hybrid approach**: CSS variables for semantic   │    │ │
│  │  │ colors (--bg-primary, --text-primary) with Tailwind utility   │    │ │
│  │  │ classes referencing them.                                      │    │ │
│  │  └───────────────────────────────────────────────────────────────┘    │ │
│  │                                                                        │ │
│  │  ────────────────────────────────────────────────────────────────────  │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │ 📎 │ Type your message...                            [Send ➤] │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  💡 This chat uses your Claude Code subscription - no extra cost      │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7. Kanban Configuration Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ CONFIGURE KANBAN: Software Dev Team ─────────────────────────────[X]─┐ │
│  │                                                                        │ │
│  │  Drag to reorder columns. Each column represents an agent stage.      │ │
│  │  ────────────────────────────────────────────────────────────────────  │ │
│  │                                                                        │ │
│  │  COLUMNS                                                               │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │ ⠿ │ ☑ │ Explorer      │ 🟢 │ ○ Default Break │ [Edit] [🗑]     │  │ │
│  │  │ ⠿ │ ☑ │ Analyst       │ 🔵 │ ○ Default Break │ [Edit] [🗑]     │  │ │
│  │  │ ⠿ │ ☑ │ Architect     │ 🟣 │ ● Default Break │ [Edit] [🗑]     │  │ │
│  │  │ ⠿ │ ☑ │ Designer      │ 🟡 │ ● Default Break │ [Edit] [🗑]     │  │ │
│  │  │ ⠿ │ ☑ │ Implementer   │ 🟠 │ ○ Default Break │ [Edit] [🗑]     │  │ │
│  │  │ ⠿ │ ☑ │ Reviewer      │ 🔴 │ ○ Default Break │ [Edit] [🗑]     │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  [+ Add Column]                                                        │ │
│  │                                                                        │ │
│  │  ────────────────────────────────────────────────────────────────────  │ │
│  │                                                                        │ │
│  │  COLUMN SETTINGS                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │ Editing: Architect                                              │  │ │
│  │  │                                                                  │  │ │
│  │  │ Name:  [Architect                                ]               │  │ │
│  │  │ Color: [🟣 Purple ▾]                                             │  │ │
│  │  │ Agent: [Architect Agent ▾]                                       │  │ │
│  │  │                                                                  │  │ │
│  │  │ ☑ Default breakpoint (pause after this column)                  │  │ │
│  │  │ □ Skip by default (agent can be skipped)                        │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                        │ │
│  │  ┌──────────────┐  ┌──────────────────────────────────────────────┐   │ │
│  │  │    Cancel    │  │              💾 Save Configuration           │   │ │
│  │  └──────────────┘  └──────────────────────────────────────────────┘   │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8. File Upload Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ ATTACHMENTS: ST-156 ──────────────────────────────────────────────[X]─┐│
│  │                                                                         ││
│  │  Upload files to provide context for agents (designs, screenshots, etc) ││
│  │  ─────────────────────────────────────────────────────────────────────  ││
│  │                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │                                                                  │   ││
│  │  │                    ┌──────────────────┐                         │   ││
│  │  │                    │   📁 ⬆          │                         │   ││
│  │  │                    │   Drop files    │                         │   ││
│  │  │                    │   or click to   │                         │   ││
│  │  │                    │   browse        │                         │   ││
│  │  │                    └──────────────────┘                         │   ││
│  │  │                                                                  │   ││
│  │  │  Supports: PNG, JPG, PDF, MD, TXT, JSON (max 10MB)              │   ││
│  │  │                                                                  │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  │                                                                         ││
│  │  UPLOADED (3)                                                           ││
│  │  ┌─────────────────────────────────────────────────────────────────┐   ││
│  │  │  🖼 figma-mockup.png        │ 245 KB │ Design    │ [👁] [🗑]    │   ││
│  │  │  📄 requirements.pdf        │ 1.2 MB │ Reference │ [👁] [🗑]    │   ││
│  │  │  📋 acceptance-criteria.md  │ 4 KB   │ Reference │ [👁] [🗑]    │   ││
│  │  └─────────────────────────────────────────────────────────────────┘   ││
│  │                                                                         ││
│  │  💡 Uploaded files are automatically included in agent context         ││
│  │                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9. Container Status Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─ CONTAINER: ST-156 ─────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  STATUS: 🟢 Running │ ID: abc123def │ Image: runner:latest          │   │
│  │  ────────────────────────────────────────────────────────────────── │   │
│  │                                                                      │   │
│  │  RESOURCES                                                           │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  CPU:     ████████░░░░░░░░░░░░  42% of 2 cores              │    │   │
│  │  │  Memory:  ██████░░░░░░░░░░░░░░  1.2 GB / 4 GB               │    │   │
│  │  │  Uptime:  12m 34s                                            │    │   │
│  │  │  Timeout: 47m 26s remaining                                  │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │  WORKTREE                                                            │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  Path: /opt/stack/worktrees/st-156-dark-mode                │    │   │
│  │  │  Branch: feature/st-156-dark-mode                           │    │   │
│  │  │  Files modified: 4                                          │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │  LOGS (live)                                                         │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ 10:35:12 │ [INFO] Starting architect agent...               │    │   │
│  │  │ 10:35:13 │ [INFO] Loading story context from MCP            │    │   │
│  │  │ 10:35:15 │ [INFO] Analyzing codebase structure...           │    │   │
│  │  │ 10:35:42 │ [INFO] Found 12 relevant files                   │    │   │
│  │  │ 10:36:01 │ [INFO] Generating architecture analysis...       │    │   │
│  │  │ 10:36:45 │ [INFO] Storing artifact: architect_analysis.md   │    │   │
│  │  │ ▌                                                            │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │   │
│  │  │  ⏸ Pause     │  │  ⏹ Stop      │  │  📥 Download Logs        │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10. Mobile View (Responsive)

```
┌────────────────────────────┐
│ VibeStudio      [≡] [👤]   │
├────────────────────────────┤
│                            │
│ ST-156: Dark mode toggle   │
│ 🟢 Running │ 50% │ 8m 23s  │
│                            │
│ ┌────────────────────────┐ │
│ │ [Board] [Chat] [Files] │ │
│ └────────────────────────┘ │
│                            │
│ ARCHITECT                  │
│ ┌────────────────────────┐ │
│ │ ●●● Running            │ │
│ │ 1m 36s │ 45%           │ │
│ │ ████████░░░░░░░░       │ │
│ └────────────────────────┘ │
│                            │
│ COMPLETED                  │
│ ┌────────────────────────┐ │
│ │ ✓ Explorer    2m 15s   │ │
│ │ ✓ Analyst     4m 32s   │ │
│ └────────────────────────┘ │
│                            │
│ PENDING                    │
│ ┌────────────────────────┐ │
│ │ ○ Designer   🔴 BREAK  │ │
│ │ ○ Implementer          │ │
│ │ ○ Reviewer             │ │
│ └────────────────────────┘ │
│                            │
│ ┌────────────────────────┐ │
│ │ [⏸ Pause]   [⏹ Stop]  │ │
│ └────────────────────────┘ │
│                            │
└────────────────────────────┘
```

---

## Database Schema (7 New Models)

### 1. KanbanConfig
Team-specific kanban configuration with ordered columns mapped to agents.
```prisma
model KanbanConfig {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  workflowId  String   @unique @map("workflow_id") @db.Uuid
  name        String
  columns     Json     // [{id, name, color, order, componentIds[], isBreakpoint}]
  defaultBreakpoints String[] @map("default_breakpoints")

  workflow    Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  @@map("kanban_configs")
}
```

### 2. RunnerBreakpoint
Per-run breakpoint configuration.
```prisma
model RunnerBreakpoint {
  id            String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  workflowRunId String   @map("workflow_run_id") @db.Uuid
  componentId   String   @map("component_id") @db.Uuid
  position      String   @default("after") // "before" | "after"
  status        String   @default("active") // active, triggered, skipped

  workflowRun   WorkflowRun @relation(...)
  component     Component   @relation(...)
  @@map("runner_breakpoints")
}
```

### 3. ChatSession
Web chat session powered by Claude Code (no API costs).
```prisma
model ChatSession {
  id            String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  workflowRunId String   @map("workflow_run_id") @db.Uuid
  storyId       String?  @map("story_id") @db.Uuid
  status        String   @default("active")
  // No modelId - uses Claude Code subscription (Task tool spawning)
  messageCount  Int      @default(0)
  tokensUsed    Int      @default(0) // Tracked from Claude Code /context

  messages      ChatMessage[]
  @@map("chat_sessions")
}
```

**Claude Code Chat Implementation:**
- User sends message via WebSocket
- Backend spawns Claude Code agent with Task tool
- Agent receives: story context, artifacts, comments, chat history
- Agent response captured via MCP callback (record_chat_response)
- Response streamed to user via WebSocket
- Zero additional API costs for users with Claude Code subscription

### 4. ChatMessage
```prisma
model ChatMessage {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  sessionId   String   @map("session_id") @db.Uuid
  role        String   // user, assistant, system
  content     String   @db.Text
  attachments Json?

  session     ChatSession @relation(...)
  @@map("chat_messages")
}
```

### 5. ArtifactComment
Line-level comments on artifacts.
```prisma
model ArtifactComment {
  id              String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  componentRunId  String   @map("component_run_id") @db.Uuid
  artifactIndex   Int      @map("artifact_index")
  lineStart       Int?     @map("line_start")
  lineEnd         Int?     @map("line_end")
  content         String   @db.Text
  resolved        Boolean  @default(false)
  parentId        String?  @map("parent_id") @db.Uuid
  influenceNextRun Boolean @default(false)

  componentRun    ComponentRun @relation(...)
  replies         ArtifactComment[] @relation("CommentThread")
  @@map("artifact_comments")
}
```

### 6. StoryAttachment
User-uploaded files.
```prisma
model StoryAttachment {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  storyId     String   @map("story_id") @db.Uuid
  fileName    String   @map("file_name")
  fileType    String   @map("file_type")
  fileSize    Int      @map("file_size")
  s3Key       String   @map("s3_key")
  category    String   @default("general")

  story       Story    @relation(...)
  @@map("story_attachments")
}
```

### 7. StoryRunner
Docker container tracking.
```prisma
model StoryRunner {
  id            String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  storyId       String   @map("story_id") @db.Uuid
  workflowRunId String?  @map("workflow_run_id") @db.Uuid
  containerId   String?  @map("container_id")
  containerName String   @map("container_name")
  worktreePath  String   @map("worktree_path")
  status        String   @default("pending") // pending, provisioning, running, paused, completed, failed
  cpuLimit      Float?
  memoryLimitMb Int?
  timeoutMinutes Int     @default(60)

  violations    SecurityViolation[]
  @@map("story_runners")
}
```

### WorkflowRun Extensions
```prisma
// Add to existing WorkflowRun
runMode         String?   // "continuous" | "breakpoint" | "step"
isPaused        Boolean   @default(false)
pausedAt        DateTime?
pauseReason     String?   // "breakpoint" | "manual" | "error"
currentColumn   String?   // Kanban column ID
```

---

## API Endpoints

### Kanban Configuration
```
GET/POST/PUT  /api/workflows/:id/kanban-config
POST/PUT/DEL  /api/workflows/:id/kanban-config/columns/:columnId
```

### Execution Control
```
POST  /api/workflow-runs/:id/pause
POST  /api/workflow-runs/:id/resume
POST  /api/workflow-runs/:id/step
POST  /api/workflow-runs/:id/run-to-end
GET/POST/DEL  /api/workflow-runs/:id/breakpoints
```

### Chat Sessions
```
GET/POST  /api/workflow-runs/:id/chat-sessions
GET       /api/chat-sessions/:id/messages
POST      /api/chat-sessions/:id/messages
POST      /api/chat-sessions/:id/messages/stream (SSE)
```

### Artifact Comments
```
GET/POST  /api/component-runs/:id/artifacts/:index/comments
PUT/DEL   /api/artifact-comments/:id
POST      /api/artifact-comments/:id/resolve
POST      /api/artifact-comments/:id/reply
```

### Story Attachments
```
GET/POST  /api/stories/:id/attachments
GET/DEL   /api/stories/:id/attachments/:id
POST      /api/stories/:id/attachments/presign
```

### Container Management
```
GET   /api/workflow-runs/:id/container
POST  /api/workflow-runs/:id/container/start
POST  /api/workflow-runs/:id/container/stop
GET   /api/workflow-runs/:id/container/logs (SSE)
```

---

## MCP Tools (New)

### Execution Control
- `set_breakpoint` / `clear_breakpoint`
- `pause_workflow_run` / `resume_workflow_run`
- `step_workflow_run`

### Chat
- `create_chat_session`
- `send_chat_message`
- `get_chat_context`

### Artifacts
- `add_artifact_comment`
- `resolve_artifact_comment`

### Files
- `upload_story_attachment`
- `list_story_attachments`

### Container
- `start_runner_container`
- `stop_runner_container`
- `get_container_logs`

---

## WebSocket Events (New)

```typescript
// Execution Control
'workflow:paused'
'workflow:resumed'
'workflow:breakpoint:hit'
'workflow:step:completed'

// Chat
'chat:session:created'
'chat:message:received'
'chat:message:streaming'

// Artifacts
'artifact:comment:added'
'artifact:comment:resolved'

// Container
'container:status:changed'
'container:logs:new'
```

---

## Frontend Structure

### New Routes
```
/story-runner                     - Hub page
/story-runner/:storyKey          - Story execution
/story-runner/:storyKey/run/:id  - Active run with chat
/teams/:id/kanban-config         - Kanban configuration
```

### Component Hierarchy
```
StoryRunnerPage/
├── StoryRunnerHeader (story/team selectors, start button)
├── StoryRunnerLayout/
│   ├── KanbanPanel (40% width)
│   │   ├── StoryRunnerKanban
│   │   │   └── KanbanColumn → StoryRunnerCard
│   │   ├── RuntimeControls (pause/resume/step)
│   │   └── KanbanColumnConfigModal
│   └── ExecutionPanel (60% width)
│       ├── ArtifactViewerWithComments
│       │   ├── CodeViewer with syntax highlighting
│       │   ├── LineCommentOverlay
│       │   └── CommentThread
│       ├── ExecutionChat
│       │   ├── ChatMessageList
│       │   └── ChatInput with file upload
│       └── ExecutionLog (collapsible)
└── StoryRunnerContext (provider)
```

### State Management
- React Query for server state
- Context for shared execution state
- WebSocket hook for real-time updates

---

## Docker Runner Architecture

### Sibling Container Pattern
Backend manages runners via Docker socket mount (`/var/run/docker.sock:/var/run/docker.sock:ro`).

### Dockerfile.runner
```dockerfile
FROM node:18-alpine
RUN adduser -u 10001 -S runner -G runner
RUN npm install -g @anthropic-ai/claude-code
COPY scripts/runner-entrypoint.sh /usr/local/bin/
WORKDIR /sandbox/worktree
USER runner
ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/runner-entrypoint.sh"]
```

### Security Measures
1. Read-only root filesystem
2. Capability dropping (keep only CHOWN, DAC_OVERRIDE, SETUID, SETGID)
3. Seccomp profile (whitelist syscalls)
4. Resource limits (CPU, memory, PIDs)
5. Network isolation (aistudio-network only)
6. Volume mounts:
   - Worktree: read-write (only this story's directory)
   - node_modules: read-only (shared)
   - Transcripts: write (for metrics collection)

---

## Implementation Phases (Core First Strategy)

### 🚀 Release 1: Kanban + Execution Control (Weeks 1-4)

**Epic 1.1: Core Infrastructure (Week 1)**
1. Database migrations: KanbanConfig, RunnerBreakpoint, WorkflowRun extensions
2. KanbanConfig CRUD API & service
3. Basic StoryRunnerPage skeleton with routing
4. WebSocket event infrastructure (pause/resume/breakpoint events)

**Epic 1.2: Execution Control (Week 2)**
1. Breakpoint model, API, and MCP tools
2. Pause/Resume/Step controls integration
3. RuntimeControls component
4. WorkflowRun state management (isPaused, runMode, etc.)

**Epic 1.3: Configurable Kanban (Weeks 3-4)**
1. StoryRunnerKanban with dnd-kit (columns = agents)
2. StoryRunnerCard with status animations
3. KanbanColumnConfigModal for team config
4. Real-time column updates via WebSocket
5. BreakpointConfig pre-run UI

**🎯 Release 1 Deliverable:** Users can execute stories through configurable Kanban, set breakpoints, pause/resume execution

---

### 💬 Release 2: Chat + Artifacts (Weeks 5-7)

**Epic 2.1: Chat Interface (Week 5)**
1. ChatSession & ChatMessage models + migrations
2. Chat API with team-configurable model selection
3. ExecutionChat component with SSE streaming
4. Context assembly (story, artifacts, previous outputs)

**Epic 2.2: Artifact Viewer & Comments (Week 6)**
1. ArtifactComment model & API
2. ArtifactViewerWithComments component
3. LineCommentOverlay with gutter icons
4. CommentThread with replies
5. Auto-inject "influence next run" comments into agent context

**Epic 2.3: File Uploads (Week 7)**
1. StoryAttachment model & S3 integration
2. ArtifactUploader with drag-drop
3. AttachmentGallery display
4. Presigned URL generation

**🎯 Release 2 Deliverable:** Chat with running executions, comment on artifacts (auto-injected), upload supporting files

---

### 🐳 Release 3: Docker Runner (Weeks 8-10)

**Epic 3.1: Container Infrastructure (Week 8)**
1. Dockerfile.runner creation
2. DockerService for sibling container management
3. StoryRunner model & migrations
4. Container resource limit presets (light/medium/heavy/custom)

**Epic 3.2: Security & Monitoring (Week 9)**
1. Seccomp profile & capability configuration
2. SecurityMonitorService for violation detection
3. SecurityViolation logging & notifications
4. Container log streaming via WebSocket

**Epic 3.3: Integration (Week 10)**
1. Integration with execute_story_with_team (containerized: true)
2. Worktree volume mounting with isolation
3. Metrics collection from containerized runs
4. Container lifecycle management UI

**🎯 Release 3 Deliverable:** Secure isolated Docker execution per story, resource management, security monitoring

---

## Critical Files to Modify

### Backend
| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | Add 7 new models, extend WorkflowRun |
| `backend/src/websocket/websocket.gateway.ts` | Add 12+ new events |
| `backend/src/mcp/servers/execution/index.ts` | Register new MCP tools |
| `docker-compose.yml` | Add Docker socket mount to backend |

### Frontend
| File | Changes |
|------|---------|
| `frontend/src/App.tsx` | Add /story-runner routes |
| `frontend/src/components/Layout.tsx` | Add navigation item |
| `frontend/src/hooks/useWorkflowWebSocket.ts` | Pattern for new hook |
| `frontend/src/components/KanbanBoard.tsx` | Pattern for dnd-kit |
| `frontend/src/components/execution/ArtifactViewer.tsx` | Base for enhancement |

### New Files
```
backend/src/story-runner/
  story-runner.module.ts
  kanban-config.service.ts
  breakpoint.service.ts
  execution-control.service.ts
  chat-session.service.ts
  artifact-comment.service.ts
  story-attachment.service.ts
  runner-container.service.ts

frontend/src/pages/
  StoryRunnerPage.tsx

frontend/src/components/story-runner/
  StoryRunnerKanban.tsx
  StoryRunnerCard.tsx
  RuntimeControls.tsx
  BreakpointConfig.tsx
  ExecutionChat.tsx
  ArtifactViewerWithComments.tsx
  ArtifactUploader.tsx
  KanbanColumnConfigModal.tsx
```

---

## Key Decisions

1. **Chat Model Selection**: Team configurable - default model set per team, users can override per session

2. **Comment → Agent Flow**: Auto-inject - comments marked "influence next run" automatically appear in agent context (seamless UX)

3. **Container Limits**: Configurable per-story and per-team defaults
   - Light preset: 1 CPU, 2GB RAM, 30 min timeout
   - Medium preset: 2 CPU, 4GB RAM, 60 min timeout
   - Heavy preset: 4 CPU, 8GB RAM, 120 min timeout

4. **Release Strategy**: Core First (incremental releases)
   - **Release 1** (Weeks 1-4): Kanban + Breakpoints + Basic Execution Control
   - **Release 2** (Weeks 5-7): Chat + Artifacts + Comments
   - **Release 3** (Weeks 8-10): Docker Runner + Security

---

## Dependencies

- **S3 Setup**: Required for Epic 6 (file uploads)
- **Claude API Key**: Required for Epic 4 (chat)
- **Docker Socket Access**: Required for Epic 7 (containers)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Docker security vulnerabilities | Seccomp + capability dropping + read-only mounts |
| Chat token costs | Token limit per session, configurable by admin |
| WebSocket scalability | Throttling (1s), room-based subscriptions |
| Schema migration complexity | Incremental migrations per epic, backward compatible |
