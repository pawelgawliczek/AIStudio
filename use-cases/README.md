# AI Studio / MCP Control Plane - Use Case Library

## Overview

This directory contains comprehensive use cases for the **AI Studio / MCP Control Plane** project - a unified control plane for managing AI agentic frameworks, project workflows, and effectiveness metrics.

## Project Vision

AI Studio serves as a single source of truth for:
- Managing AI agentic frameworks (Claude Code, Codex, etc.)
- Project planning and execution (Epics, Stories, Subtasks)
- Living documentation (Use Cases, Requirements)
- Code quality and architecture insights
- Framework effectiveness metrics and comparison
- Complete traceability from requirements → code → metrics

## Directory Structure

```
use-cases/
├── README.md                          # This file - index and navigation
├── pm/                                # Project Manager workflows
│   ├── UC-PM-001-create-project.md
│   ├── UC-PM-002-create-epic.md
│   ├── UC-PM-003-create-story.md
│   ├── UC-PM-004-assign-story-to-framework.md
│   ├── UC-PM-005-view-project-dashboard.md
│   └── UC-PM-006-create-release.md
├── ba/                                # Business Analyst workflows
│   ├── UC-BA-001-analyze-story-requirements.md
│   ├── UC-BA-002-create-use-case.md
│   ├── UC-BA-003-view-use-case-impact-analysis.md
│   └── UC-BA-004-search-use-case-library.md
├── architect/                         # Architect workflows
│   ├── UC-ARCH-001-assess-technical-complexity.md
│   ├── UC-ARCH-002-view-code-quality-dashboard.md
│   └── UC-ARCH-003-analyze-story-dependencies.md
├── developer/                         # Developer & Agent workflows
│   ├── UC-DEV-001-pull-assigned-stories.md
│   ├── UC-DEV-002-implement-story.md
│   └── UC-DEV-003-link-commit-to-story.md
├── qa/                                # QA & Testing workflows
│   ├── UC-QA-001-test-story-implementation.md
│   └── UC-QA-002-report-defect.md
├── metrics/                           # Metrics & Analytics
│   ├── UC-METRICS-001-view-framework-effectiveness.md
│   └── UC-METRICS-002-view-project-tracker.md
├── admin/                             # System Administration
│   ├── UC-ADMIN-001-bootstrap-project.md
│   └── UC-ADMIN-002-manage-agentic-frameworks.md
└── integration/                       # End-to-End workflows
    └── UC-INT-001-end-to-end-story-workflow.md
```

## Use Cases by Actor

### Project Manager (PM)
PMs manage projects, epics, stories, and track overall progress.

| ID | Use Case | Description |
|----|----------|-------------|
| UC-PM-001 | Create New Project | Initialize new project in AI Studio |
| UC-PM-002 | Create Epic | Define high-level initiatives |
| UC-PM-003 | Create Story | Create stories with complexity assessment |
| UC-PM-004 | Assign Story to Framework | Assign work to agentic frameworks |
| UC-PM-005 | View Project Dashboard | Monitor project health and metrics |
| UC-PM-006 | Create Release | Plan and manage releases |

### Business Analyst (BA)
BAs analyze requirements, maintain use case library, and ensure business alignment.

| ID | Use Case | Description |
|----|----------|-------------|
| UC-BA-001 | Analyze Story Requirements | Perform BA analysis, link use cases |
| UC-BA-002 | Create Use Case | Document business use cases |
| UC-BA-003 | View Use Case Impact Analysis | Track use case changes and impact |
| UC-BA-004 | Search Use Case Library | Find use cases with semantic search |

### Architect
Architects assess technical complexity, monitor code quality, and guide design decisions.

| ID | Use Case | Description |
|----|----------|-------------|
| UC-ARCH-001 | Assess Technical Complexity | Evaluate and score technical complexity |
| UC-ARCH-002 | View Code Quality Dashboard | Monitor code metrics and hotspots |
| UC-ARCH-003 | Analyze Story Dependencies | Optimize story grouping and sequencing |

### Developer / Agent
Developers (human or AI agents) implement stories and commit code.

| ID | Use Case | Description |
|----|----------|-------------|
| UC-DEV-001 | Pull Assigned Stories | Sync work via MCP, get assigned stories |
| UC-DEV-002 | Implement Story | Execute implementation with telemetry tracking |
| UC-DEV-003 | Link Commit to Story | Automatic/manual commit linking |

### QA / Tester
QA testers validate implementations and report defects.

| ID | Use Case | Description |
|----|----------|-------------|
| UC-QA-001 | Test Story Implementation | Execute testing and verify acceptance criteria |
| UC-QA-002 | Report Defect | Create and track defects with leakage metrics |

### Metrics & Analytics Users
PMs, Architects, and Stakeholders view dashboards and metrics.

| ID | Use Case | Description |
|----|----------|-------------|
| UC-METRICS-001 | View Framework Effectiveness | Compare agentic framework performance |
| UC-METRICS-002 | View Project Tracker | Real-time project status and story tracking |
| UC-METRICS-003 | View Agent Execution Details | Per-agent metrics with tokens/LOC, LOC/prompt, runtime analysis |

### System Administrator
Admins bootstrap projects and configure frameworks.

| ID | Use Case | Description |
|----|----------|-------------|
| UC-ADMIN-001 | Bootstrap Project | One-command project setup with MCP integration |
| UC-ADMIN-002 | Manage Agentic Frameworks | Configure agents, workflows, and policies |

### Integration / End-to-End
Complete workflows spanning multiple actors.

| ID | Use Case | Description |
|----|----------|-------------|
| UC-INT-001 | End-to-End Story Workflow | Complete story lifecycle with automatic telemetry |

## Use Cases by Workflow Phase

### 1. Project Setup
1. **UC-ADMIN-001**: Bootstrap Project - One-command setup
2. **UC-ADMIN-002**: Manage Agentic Frameworks - Configure agent teams
3. **UC-PM-001**: Create New Project - Initialize project
4. **UC-PM-002**: Create Epic - Define initiatives

### 2. Planning
1. **UC-PM-003**: Create Story - Define work items with complexity
2. **UC-PM-004**: Assign Story to Framework - Route to agents
3. **UC-PM-006**: Create Release - Plan release scope

### 3. Analysis (BA Phase)
1. **UC-BA-001**: Analyze Story Requirements - BA analysis
2. **UC-BA-002**: Create Use Case - Document behavior
3. **UC-BA-004**: Search Use Case Library - Find existing use cases
4. **UC-BA-003**: View Use Case Impact Analysis - Track changes

### 4. Architecture (Architect Phase)
1. **UC-ARCH-001**: Assess Technical Complexity - Technical evaluation
2. **UC-ARCH-003**: Analyze Story Dependencies - Optimize grouping
3. **UC-ARCH-002**: View Code Quality Dashboard - Monitor quality

### 5. Implementation (Developer Phase)
1. **UC-DEV-001**: Pull Assigned Stories - Sync work via MCP
2. **UC-DEV-002**: Implement Story - Code implementation
3. **UC-DEV-003**: Link Commit to Story - Automatic traceability

### 6. Testing (QA Phase)
1. **UC-QA-001**: Test Story Implementation - Validate work
2. **UC-QA-002**: Report Defect - Track quality issues

### 7. Monitoring & Analytics
1. **UC-METRICS-002**: View Project Tracker - Track progress
2. **UC-METRICS-003**: View Agent Execution Details - Per-story and per-agent metrics
3. **UC-METRICS-001**: View Framework Effectiveness - Compare frameworks
4. **UC-PM-005**: View Project Dashboard - Monitor health

## Key Features Demonstrated

### Automatic Telemetry Collection
- **UC-INT-001** shows how all metrics are collected automatically
- **UC-DEV-002** demonstrates `log_run` calls for token tracking
- **UC-DEV-003** shows automatic commit linking via Git hooks
- **UC-METRICS-003** demonstrates comprehensive per-agent execution tracking

### Per-Agent Execution Metrics
- **UC-METRICS-003** tracks each agent execution separately (e.g., 3x Architect, 1x BA, 1x Developer)
- Automatic calculation of key metrics:
  - **tokens/LOC** - Token efficiency per line of code
  - **LOC/prompt** - Code generation efficiency
  - **runtime/LOC** - Time efficiency per line
  - **runtime/token** - Processing speed
- Views available at:
  - **Story level**: See all agent runs for a story
  - **Epic level**: Accumulated metrics across all stories
  - **Analytics level**: Compare framework effectiveness

### Framework Effectiveness Comparison
- **UC-METRICS-001** compares "Dev-only" vs "BA+Arch+Dev+QA" frameworks
- Metrics normalized by complexity band for fair comparison
- Tracks efficiency, quality, and cost metrics

### Living Documentation
- **UC-BA-002**: Create versioned use cases
- **UC-BA-003**: Track use case changes linked to stories and commits
- **UC-BA-001**: Automatic use case impact analysis

### Real-time Visibility
- **UC-METRICS-002**: Real-time project tracker with WebSocket updates
- **UC-PM-005**: Live dashboard with agent execution status
- **UC-INT-001**: End-to-end workflow with automatic updates

### Code Quality Monitoring
- **UC-ARCH-002**: Background workers analyze code automatically
- Hotspot detection, complexity tracking, test coverage
- No developer interruption - all background processing

### Complete Traceability
- Story → Subtask → Commit → Code → Use Case → Metrics
- **UC-DEV-003**: Commit linking via Git hooks
- **UC-BA-003**: Use case → file → commit mapping
- **UC-QA-002**: Defect → origin story linkage

## Default User Workflow

As described by the user, the typical workflow is:

1. **PM creates stories** via Web UI (UC-PM-003)
2. **PM assigns to framework** (UC-PM-004)
3. **User works via Claude Code CLI** or web interface
4. **User asks Claude Code to implement story** (UC-DEV-001, UC-DEV-002)
5. **All telemetry saved automatically** (UC-INT-001)
6. **View metrics in Agent Effectiveness tab** (UC-METRICS-001)
7. **View progress in Tracker tab** (UC-METRICS-002)

See **UC-INT-001** for the complete end-to-end workflow.

## Web UI Dashboards

### Agent Effectiveness Tab
- URL: https://studio.example.com/ → Agent Effectiveness
- Use Case: **UC-METRICS-001**
- Purpose: Compare framework performance
- Note: User wants to improve styling (likes Claude's style more than Codex)

### Tracker Tab
- URL: https://studio.example.com/ → Tracker
- Use Case: **UC-METRICS-002**
- Purpose: Project management and story tracking
- Note: User wants better implementation with improved UI/UX

## MCP Tools Referenced

Key MCP tools used across use cases:

| Tool | Used In | Purpose |
|------|---------|---------|
| `bootstrap_project` | UC-ADMIN-001 | One-command project setup |
| `get_changes` | UC-DEV-001 | Delta sync for stories |
| `list_stories` | UC-PM-*, UC-DEV-001 | Query stories |
| `create_story` | UC-PM-003 | Create new story |
| `update_story` | UC-PM-*, UC-DEV-*, UC-QA-* | Update story status/fields |
| `log_run` | UC-DEV-002, UC-INT-001 | Record agent execution metrics |
| `link_commit` | UC-DEV-003 | Link commits to stories |
| `report_defect` | UC-QA-002 | Create defect with leakage tracking |
| `get_architect_insights` | UC-ARCH-001, UC-ARCH-002 | Code quality metrics |
| `get_framework_metrics` | UC-METRICS-001 | Framework effectiveness data |
| `create_use_case` | UC-BA-002 | Create use case documentation |
| `get_impacted_tests` | UC-QA-001 | Find relevant tests |

## Data Model Summary

Key entities referenced in use cases:

- **projects** - Top-level container
- **epics** - High-level initiatives
- **stories** - Vertical slices of work
- **subtasks** - Smallest executable units
- **use_cases** - Business behavior documentation
- **use_case_versions** - Versioned use case content
- **commits** - Code commits linked to stories
- **defects** - Bugs with origin and discovery tracking
- **agents** - AI agent definitions
- **agent_frameworks** - Compositions of agents
- **runs** - Execution telemetry records
- **releases** - Grouped stories for deployment

See `req.md` Section 20 for complete schema.

## Metrics & KPIs Tracked

### Efficiency Metrics
- Token usage per story
- Token per LOC
- Story cycle time
- Prompt iterations
- Parallelization efficiency

### Quality Metrics
- Defects per story
- Defect leakage rate
- Code churn percentage
- Test coverage
- Code complexity delta

### Cost Metrics
- Cost per story
- Cost per accepted LOC
- Rework cost
- Framework overhead ratio

See **UC-METRICS-001** for complete metric definitions.

## How to Use This Library

### For Developers Implementing Features
1. Find the relevant use case(s) for your feature
2. Read the main flow and alternative flows
3. Check business rules and acceptance criteria
4. Reference related use cases for context
5. Use technical implementation notes

### For Product Managers
1. Use UC-PM-* for planning workflows
2. Reference UC-METRICS-* for tracking capabilities
3. UC-INT-001 shows complete story lifecycle

### For Business Analysts
1. UC-BA-* documents show use case management
2. UC-BA-003 demonstrates traceability
3. Use as templates for creating actual use cases

### For Architects
1. UC-ARCH-* shows architecture workflows
2. UC-ARCH-002 demonstrates code quality monitoring
3. Reference for designing metrics collection

### For QA Engineers
1. UC-QA-* defines testing workflows
2. Shows integration with defect tracking
3. Demonstrates test coverage requirements

## Related Documentation

- **Requirements**: See `req.md` in project root for complete specification
- **Data Model**: `req.md` Section 20 - Database schema
- **MCP Tool API**: `req.md` Section 21 - MCP tool definitions
- **Metrics KPIs**: `req.md` Section 16 - Framework effectiveness KPIs

## Contributing New Use Cases

When adding new use cases, follow the template structure:
1. Actor (who performs this)
2. Preconditions (what must be true before)
3. Main Flow (numbered steps)
4. Postconditions (what is true after)
5. Alternative Flows (variations and errors)
6. Business Rules (constraints and policies)
7. Related Use Cases (links to other UCs)
8. Acceptance Criteria (testable conditions)

## Status & Version

- **Status**: Initial draft for MVP implementation
- **Version**: 1.0
- **Last Updated**: 2025-11-10
- **Author**: Business Analyst (Claude)
- **Project**: AI Studio / MCP Control Plane

## Next Steps

1. Review use cases with stakeholders
2. Prioritize for MVP implementation
3. Create detailed technical designs based on use cases
4. Implement MCP tools referenced
5. Build Web UI dashboards (Agent Effectiveness, Tracker)
6. Implement background metrics collection
7. Create CLI and Claude Code integration

---

For questions or clarifications, refer to the project requirements in `req.md` or contact the project team.
