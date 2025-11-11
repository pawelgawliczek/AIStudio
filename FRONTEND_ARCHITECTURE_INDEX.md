# Frontend Architecture Documentation Index

## Overview

This documentation set provides a comprehensive analysis of the AI Studio frontend architecture, covering all aspects of the React 18 + TypeScript + Vite application.

**Total Documentation:** 2,409 lines across 3 detailed documents  
**Codebase Analyzed:** ~7,500 LOC across 41 TypeScript/TSX files  
**Creation Date:** 2025-11-11

---

## Document Guide

### 1. **FRONTEND_ARCHITECTURE.md** (1,248 lines - COMPREHENSIVE)
The complete architectural analysis with in-depth coverage.

**Contains:**
- Executive Summary
- Detailed Frontend Structure (pages, components, hierarchy)
- Complete State Management Strategy (React Query, Context, useState, WebSocket)
- Full API Integration Architecture (HTTP clients, services, type definitions)
- React Router Setup & Organization
- UI Patterns & Component Library Details
- Build & Development Setup
- Architectural Decisions & Trade-offs
- Comparison of competing implementations
- Areas for improvement

**Best for:** Deep understanding, implementation details, pattern references

**Key Sections:**
- Pages overview (12 page components detailed)
- Components overview (12 reusable components)
- State management layers with code examples
- Service layer pattern with all 8 services listed
- WebSocket integration lifecycle
- Build configuration (Vite, TypeScript, NPM scripts)

---

### 2. **FRONTEND_ARCHITECTURE_SUMMARY.md** (445 lines - QUICK REFERENCE)
Fast lookup guide for developers getting started or needing quick info.

**Contains:**
- Project Overview (Tech stack, LOC, files)
- Directory Structure
- Quick Navigation Tables (pages, components, services)
- State Management Strategy (all 4 layers explained)
- API Integration (HTTP clients, services, auth flow)
- Routing Reference (all routes listed)
- UI & Styling Quick Guide
- Drag & Drop Pattern
- WebSocket Integration
- Build & Development Commands
- Dependencies Summary
- Strengths & Improvement Areas
- Common Development Tasks (how-to guide)
- File Location Map (where to find things)

**Best for:** Quick lookup, onboarding, common tasks, cheat sheet

**Perfect for:**
- New developer onboarding
- "Where do I add X?" questions
- Common commands and patterns
- Quick reference while coding

---

### 3. **FRONTEND_ARCHITECTURE_DIAGRAMS.md** (716 lines - VISUAL REFERENCE)
ASCII diagrams and visual representations of architecture flows.

**Contains:**
1. Application Architecture Layers (4-layer system visualization)
2. Component Hierarchy & Data Flow (tree structure)
3. State Management Flow (visual state layers)
4. API Service Architecture (with interceptor flow)
5. React Query Data Lifecycle (caching flow diagram)
6. WebSocket Connection & Room Architecture (connection flow)
7. Drag & Drop Data Flow (dnd-kit implementation flow)
8. Routing Architecture (route tree with nesting)
9. State & Props Flow Example (StoryListPage detailed flow)

**Best for:** Visual learners, understanding data flow, presentations

**Perfect for:**
- Understanding component interactions
- Seeing data flow at a glance
- API request/response lifecycle
- WebSocket event handling
- State management visualization

---

## How to Use These Documents

### Scenario 1: New Developer Onboarding
**Read in order:**
1. Start with `FRONTEND_ARCHITECTURE_SUMMARY.md` - Quick overview
2. Look at relevant diagrams in `FRONTEND_ARCHITECTURE_DIAGRAMS.md`
3. Reference specific sections in `FRONTEND_ARCHITECTURE.md` as needed

### Scenario 2: Adding a New Feature
**Process:**
1. Check `FRONTEND_ARCHITECTURE_SUMMARY.md` → "Common Development Tasks"
2. Find examples in `FRONTEND_ARCHITECTURE.md` → relevant section
3. Use `FRONTEND_ARCHITECTURE_DIAGRAMS.md` for data flow understanding

### Scenario 3: Deep Architecture Understanding
**Read:**
1. `FRONTEND_ARCHITECTURE.md` thoroughly
2. Reference diagrams for visual understanding
3. Use summary for quick lookups while coding

### Scenario 4: Finding Specific Information
**Use the Quick Reference:**
- "Where is X located?" → `FRONTEND_ARCHITECTURE_SUMMARY.md` File Location Map
- "How do I do X?" → `FRONTEND_ARCHITECTURE_SUMMARY.md` Common Tasks
- "What is X?" → `FRONTEND_ARCHITECTURE.md` (search for term)
- "How does X flow?" → `FRONTEND_ARCHITECTURE_DIAGRAMS.md`

---

## Quick Facts

### Tech Stack
- **Framework:** React 18.2.0
- **Language:** TypeScript (strict mode)
- **Build Tool:** Vite 5.0
- **State:** React Query 5.17 + Context API
- **UI:** Headless UI + Tailwind CSS + Heroicons
- **Routing:** React Router v6
- **Real-time:** Socket.io v4.6
- **Drag & Drop:** dnd-kit v6
- **HTTP:** Axios 1.6

### Structure Summary
```
41 files total:
├── 12 pages     (routing & page logic)
├── 12 components (reusable UI)
├── 8 services   (API layer)
├── 2 context    (global state)
├── 2 utilities  (HTTP, config)
├── 1 types      (shared types)
├── 1 router     (App.tsx)
├── 1 entry      (main.tsx)
└── 2 styles     (CSS config)
```

### State Management
| Layer | Tech | Purpose | Persistence |
|-------|------|---------|-------------|
| Server | React Query | API caching | In-memory |
| Global | Context API | Auth, projects | localStorage |
| UI | useState | Forms, toggles | None |
| Real-time | WebSocket | Live updates | None |

### Routes (12 total)
- 1 public: `/login`
- 11 protected under `/`
- Mix of query params and route params
- Nested routes with Layout wrapper

### Services (8 total)
- `projects.service.ts` - CRUD projects
- `stories.service.ts` - CRUD stories + status
- `epics.service.ts` - CRUD epics
- `subtasks.service.ts` - CRUD subtasks
- `use-cases.service.ts` - CRUD + semantic search
- `test-cases.service.ts` - CRUD + coverage
- `test-executions.service.ts` - Report executions
- `auth.service.ts` - Authentication

---

## Key Architecture Patterns

### 1. Service Layer
```typescript
export const entityService = {
  async getAll(filters): Promise<Entity[]> { },
  async getById(id): Promise<Entity> { },
  async create(data): Promise<Entity> { },
  async update(id, data): Promise<Entity> { },
  async delete(id): Promise<void> { },
}
```

### 2. React Query Usage
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['entity', params],
  queryFn: () => entityService.getAll(params),
  enabled: !!projectId,
});
```

### 3. Context Provider
```typescript
const { user, login, logout } = useAuth();
const { projects, selectedProject, setSelectedProject } = useProject();
```

### 4. WebSocket Events
```typescript
useStoryEvents({
  onStoryCreated: (data) => { },
  onStoryUpdated: (data) => { },
  onStoryStatusChanged: (data) => { },
});
```

### 5. Drag & Drop
```typescript
<DndContext onDragEnd={handleDragEnd}>
  <KanbanColumn>
    <StoryCard key={id} story={story} />
  </KanbanColumn>
  <DragOverlay>{activeStory && <StoryCard />}</DragOverlay>
</DndContext>
```

---

## Strengths of Current Architecture

1. ✅ **Clean Layering** - Clear separation between UI, logic, and API
2. ✅ **Type Safety** - Strict TypeScript throughout
3. ✅ **Real-time Ready** - WebSocket + React Query sync
4. ✅ **Component Reusability** - Well-designed component hierarchy
5. ✅ **State Management** - Appropriate strategy for each layer
6. ✅ **Developer Experience** - Clear patterns, good conventions
7. ✅ **Accessible** - Headless UI ensures accessibility
8. ✅ **Performance** - Query caching, lazy loading, code splitting ready

---

## Areas for Improvement

1. ❌ **Duplicate Clients** - Two axios instances (consolidate to one)
2. ❌ **Form Library** - No react-hook-form (needed for complex forms)
3. ❌ **Validation** - No schema validation (add zod)
4. ❌ **Error Handling** - No error boundaries
5. ❌ **Loading UX** - No skeleton loaders
6. ❌ **Testing** - Limited test setup (add Vitest)
7. ❌ **Analytics** - No event tracking

---

## Document Statistics

| Document | Lines | Focus | Audience |
|----------|-------|-------|----------|
| COMPREHENSIVE | 1,248 | Complete architecture | Architects, leads |
| SUMMARY | 445 | Quick reference | Developers, teams |
| DIAGRAMS | 716 | Visual flows | Visual learners |
| **TOTAL** | **2,409** | Full coverage | Everyone |

---

## Navigation Quick Links

### By Topic
- **Getting Started** → SUMMARY.md
- **Component Design** → COMPREHENSIVE.md § 1
- **State Management** → COMPREHENSIVE.md § 2 + DIAGRAMS.md § 3
- **API Integration** → COMPREHENSIVE.md § 3 + DIAGRAMS.md § 4
- **Real-time Features** → COMPREHENSIVE.md § 2.4 + DIAGRAMS.md § 6
- **Routing** → COMPREHENSIVE.md § 4 + DIAGRAMS.md § 8
- **UI Patterns** → COMPREHENSIVE.md § 5 + DIAGRAMS.md § 7
- **Development Setup** → COMPREHENSIVE.md § 6 + SUMMARY.md

### By Task
- **Add Page** → SUMMARY.md "Common Development Tasks"
- **Add Service** → SUMMARY.md "Common Development Tasks"
- **Add Component** → SUMMARY.md "Common Development Tasks"
- **Fetch Data** → SUMMARY.md "State Management Strategy"
- **Update WebSocket** → COMPREHENSIVE.md § 2.4 + DIAGRAMS.md § 6
- **Build/Deploy** → COMPREHENSIVE.md § 6 + SUMMARY.md

### By Role
- **Frontend Developer** → SUMMARY.md (primary) + COMPREHENSIVE.md (reference)
- **Tech Lead** → COMPREHENSIVE.md (primary) + DIAGRAMS.md (discussions)
- **Architect** → COMPREHENSIVE.md + DIAGRAMS.md
- **New Team Member** → SUMMARY.md → DIAGRAMS.md → COMPREHENSIVE.md

---

## Version & Maintenance

**Documentation Version:** 1.0  
**Based on Codebase State:** Sprint 5-6 implementation (Nov 2025)  
**Last Updated:** 2025-11-11

**Maintain by:**
- Update when major architectural changes occur
- Keep task examples current
- Update dependency versions as they change
- Add new patterns as they're introduced

---

## Questions & Guidance

**"I need to understand X"**
1. Check SUMMARY.md File Location Map
2. Look up in COMPREHENSIVE.md index
3. Review DIAGRAMS.md for visual flow

**"How do I implement X?"**
1. Find similar example in COMPREHENSIVE.md
2. Check SUMMARY.md Common Development Tasks
3. Reference code patterns in diagnostics

**"Why is it done this way?"**
→ COMPREHENSIVE.md § 7 "Key Architectural Decisions"

**"What's the performance impact?"**
→ COMPREHENSIVE.md § 2.1 "React Query" or § 2.4 "WebSocket"

---

**Happy coding! Use these documents as a reference throughout your development journey.**

