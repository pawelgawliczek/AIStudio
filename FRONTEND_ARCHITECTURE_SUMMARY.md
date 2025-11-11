# Frontend Architecture - Quick Reference Guide

## Project Overview
- **Technology Stack:** React 18 + TypeScript + Vite
- **Total LOC:** ~7,500 lines
- **Total Files:** 41 TypeScript/TSX files
- **Build Tool:** Vite v5.0
- **Port:** 5173 (dev), proxied to :3000 for API

## Directory Structure

```
frontend/src/
├── components/      (12 files) → Reusable UI components
├── pages/          (12 files) → Page-level routing components
├── services/       (8 files)  → API integration layer
├── context/        (2 files)  → Global state (Auth, Project)
├── lib/            (2 files)  → HTTP clients & config
├── types/          (1 file)   → Shared TypeScript definitions
├── App.tsx                    → Router setup
├── main.tsx                   → Entry point with QueryClient
└── index.css                  → Tailwind CSS
```

## Quick Navigation

### Pages (12)
| Page | Purpose | Key Features |
|------|---------|--------------|
| DashboardPage | Home overview | Phase status display |
| ProjectsPage | Project management | CRUD operations |
| StoryListPage | Stories with filters | Search, pagination, filters |
| StoryDetailPage | Single story view | Subtasks, status workflow |
| PlanningView | Kanban board | Drag-and-drop workflow |
| TimelineView | Timeline/roadmap | Visualization |
| UseCaseLibraryView | Use case management | Semantic search, versions |
| CodeQualityDashboard | Code metrics | Project-level analytics |
| AgentPerformanceView | AI metrics | Agent performance tracking |
| TestCaseCoverageDashboard | Test coverage | Use case level |
| ComponentCoverageView | Component coverage | Component level |
| LoginPage | Authentication | Login/register |

### Components (12)
| Component | Purpose | Key Tech |
|-----------|---------|----------|
| Layout | App shell/nav | React Router Outlet |
| KanbanBoard | Drag-drop board | dnd-kit, DndContext |
| KanbanColumn | Column container | dnd-kit, DroppableZone |
| StoryCard | Draggable card | dnd-kit Sortable |
| StoryDetailDrawer | Right panel | Headless UI Dialog |
| UseCaseDetailModal | Modal view | Headless UI Dialog + Tab |
| ProjectSelector | Project dropdown | Headless UI Listbox |
| UseCaseSearchBar | Search UI | Multiple search modes |
| ConnectionStatus | WS indicator | WebSocket status |

### Services (8)
```
projects.service.ts        → CRUD: projects
stories.service.ts         → CRUD: stories, status updates
epics.service.ts           → CRUD: epics
subtasks.service.ts        → CRUD: subtasks
use-cases.service.ts       → CRUD + search (semantic/text/component)
test-cases.service.ts      → CRUD + coverage analysis
test-executions.service.ts → Report executions, statistics
auth.service.ts            → Login, register, token refresh
```

## State Management Strategy

### Layer 1: Server State (React Query)
```typescript
// Store API data with automatic caching
const { data: stories = [], isLoading } = useQuery({
  queryKey: ['stories', projectId],
  queryFn: () => storiesService.getAll({ projectId }),
  enabled: !!projectId,
});
```
**Benefits:** Caching, deduplication, stale data management, automatic refetching

### Layer 2: Global State (Context API)
```typescript
// AuthContext - user + auth methods
// ProjectContext - selected project + list, with localStorage persistence

export function useProject() { ... }  // Hook pattern for access
export function useAuth() { ... }
```

### Layer 3: Local UI State (useState)
```typescript
const [search, setSearch] = useState('');
const [isModalOpen, setIsModalOpen] = useState(false);
```

### Layer 4: Real-time State (WebSocket)
```typescript
useStoryEvents({
  onStoryCreated: (data) => { /* update UI */ },
  onStoryUpdated: (data) => { /* update UI */ },
  onStoryStatusChanged: (data) => { /* update UI */ },
});
```
**Room:** `project:${projectId}` for all project updates

## API Integration

### HTTP Clients
| Client | Location | Feature |
|--------|----------|---------|
| `lib/axios.ts` | Main instance | Token refresh on 401 |
| `api.client.ts` | Singleton pattern | Interceptors |

**Note:** Both exist - should consolidate

### Service Pattern
```typescript
export const storiesService = {
  async getAll(filters): Promise<PaginatedResponse<Story>> { ... }
  async getById(id): Promise<Story> { ... }
  async create(data): Promise<Story> { ... }
  async update(id, data): Promise<Story> { ... }
  async delete(id): Promise<void> { ... }
}
```

### Auth Flow
```
1. Login via auth.service.login() → tokens + user stored in localStorage
2. Axios interceptor adds `Authorization: Bearer ${token}` to all requests
3. On 401: Attempt refresh via authService.refreshToken()
4. Redirect to /login on refresh failure
```

### Environment Variables
```bash
VITE_API_URL=http://localhost:3000/api    # HTTP base
VITE_WS_URL=http://localhost:3000         # WebSocket base
```

## Routing

### Route Structure
```
/login                              → LoginPage (public)
/dashboard                          → DashboardPage
/projects                           → ProjectsPage
/planning?projectId=X               → PlanningView
/timeline?projectId=X               → TimelineView
/use-cases?projectId=X              → UseCaseLibraryView
/projects/:projectId/stories        → StoryListPage
/projects/:projectId/stories/:storyId → StoryDetailPage
/code-quality/:projectId            → CodeQualityDashboard
/agent-performance/:projectId       → AgentPerformanceView
/test-coverage/use-case/:id         → TestCaseCoverageDashboard
/test-coverage/project/:projectId   → ComponentCoverageView
```

### Navigation Patterns
```typescript
// Link-based
<Link to="/dashboard">Home</Link>

// Programmatic
const navigate = useNavigate();
navigate(`/projects/${projectId}/stories/${storyId}`);

// URL params
const { projectId } = useParams();
const [searchParams] = useSearchParams();
const projectId = searchParams.get('projectId');
```

## UI & Styling

### Component Libraries
| Library | Use | Examples |
|---------|-----|----------|
| **Headless UI** | Unstyled accessible components | Dialog, Listbox, Tab, Transition |
| **Heroicons** | SVG icons | MagnifyingGlassIcon, PlusIcon, CheckIcon |
| **Tailwind CSS** | Utility-first styling | All layout & colors |
| **dnd-kit** | Drag & drop | Kanban board, story card movement |
| **clsx** | Conditional classes | Status colors, state-based styling |

### Styling Approach
```typescript
// Tailwind utilities
<div className="px-4 py-6 flex justify-between items-center">
  <h1 className="text-2xl font-bold text-gray-900">Title</h1>
</div>

// Conditional classes with clsx
import clsx from 'clsx';
<span className={clsx(
  'px-2 py-1 rounded text-xs font-medium',
  statusColors[story.status]
)}>
```

### Form Handling
- **No form library** - direct useState management
- Native HTML `<input>`, `<select>`, `<textarea>`
- Manual validation on submit

### Common UI Patterns
```typescript
// Status badge
<span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
  {status}
</span>

// Loading spinner
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>

// Empty state
{items.length === 0 && <p className="text-gray-500">No items found</p>}

// Pagination
{total > limit && (
  <div className="flex gap-2">
    <button disabled={page === 1}>Previous</button>
    <button disabled={page * limit >= total}>Next</button>
  </div>
)}
```

## Drag & Drop Pattern

### Setup (KanbanBoard.tsx)
```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
);

<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
  {/* Droppable columns */}
  <DragOverlay>
    {activeItem && <StoryCard story={activeItem} />}
  </DragOverlay>
</DndContext>
```

### Draggable Item (StoryCard.tsx)
```typescript
const { attributes, listeners, setNodeRef, transform, isDragging } = 
  useSortable({ id: story.id });

<div 
  ref={setNodeRef} 
  style={{ transform: CSS.Transform.toString(transform) }}
  {...attributes}
  {...listeners}
>
```

## WebSocket Integration

### Connection Lifecycle
```typescript
// Auto-connect via wsService singleton
const { socket, isConnected, joinRoom, leaveRoom } = useWebSocket();

// Join project room on load
useEffect(() => {
  if (projectId && isConnected) {
    joinRoom(`project:${projectId}`, userId, userName);
    return () => leaveRoom(`project:${projectId}`);
  }
}, [projectId, isConnected]);
```

### Event Listeners
```typescript
// Story events
useStoryEvents({
  onStoryCreated: (e) => { },
  onStoryUpdated: (e) => { },
  onStoryStatusChanged: (e) => { },
});

// Presence events
usePresenceEvents({
  onUserJoined: (e) => { },
  onUserLeft: (e) => { },
  onTyping: (e) => { },
});

// Epic & Subtask events (similar pattern)
```

## Build & Development

### Dev Server
```bash
npm run dev              # Vite @ :5173, API proxied to :3000
```

### Build & Type Check
```bash
npm run build            # tsc + vite build → dist/
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint with strict rules
npm run test             # Vitest
npm run test:coverage    # Vitest with coverage
```

### Vite Config Highlights
```typescript
// API proxy for dev
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
},

// Path aliases
alias: {
  '@': './src',
  '@aistudio/shared': '../shared/src',
}
```

## TypeScript Configuration
```json
{
  "target": "ES2020",
  "lib": ["ES2020", "DOM", "DOM.Iterable"],
  "module": "ESNext",
  "jsx": "react-jsx",
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

## Dependencies Summary

```json
{
  "core": {
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-router-dom": "6.21.3"
  },
  "state": {
    "@tanstack/react-query": "5.17.19",
    "zustand": "4.5.0"
  },
  "ui": {
    "@headlessui/react": "1.7.18",
    "@heroicons/react": "2.1.1",
    "tailwindcss": "3.4.1",
    "clsx": "2.1.0"
  },
  "interactions": {
    "@dnd-kit/core": "6.3.1",
    "@dnd-kit/sortable": "10.0.0",
    "socket.io-client": "4.6.1"
  },
  "api": {
    "axios": "1.6.5"
  },
  "utilities": {
    "date-fns": "3.2.0",
    "react-markdown": "10.1.0",
    "recharts": "2.15.4"
  }
}
```

## Key Architectural Strengths
1. ✅ Clean separation: presentation, business, data layers
2. ✅ Hybrid state management: appropriate for each use case
3. ✅ Type-safe: strict TypeScript with service interfaces
4. ✅ Real-time ready: WebSocket + React Query sync
5. ✅ Accessible: Headless UI + ARIA labels
6. ✅ Performant: React Query caching, lazy loading
7. ✅ Developer experience: Vite hot reload, clear patterns

## Areas for Improvement
1. ❌ Duplicate axios clients (consolidate)
2. ❌ No form library (consider react-hook-form for complex forms)
3. ❌ No error boundaries
4. ❌ No loading skeletons (UX improvement)
5. ❌ Limited testing infrastructure (add Vitest setup)
6. ❌ Manual form validation (add zod/schema validation)
7. ❌ No analytics tracking

## Common Development Tasks

### Add New Page
1. Create file in `/pages/PageName.tsx`
2. Add route in `App.tsx`
3. Add navigation link in `Layout.tsx`
4. Use services for data fetching
5. Use React Query for caching

### Add New Service
1. Create `services/entity.service.ts`
2. Follow service template with CRUD methods
3. Use `apiClient` for HTTP calls
4. Export as singleton (const export)
5. Add types to `types/index.ts`

### Add New Component
1. Create `components/ComponentName.tsx`
2. Accept props with TypeScript interfaces
3. Use Headless UI if needed (dialogs, dropdowns)
4. Style with Tailwind + clsx
5. Export as named export

### Fetch Data in Page
```typescript
// React Query pattern
const { data, isLoading, error } = useQuery({
  queryKey: ['entity', params],
  queryFn: () => entityService.getAll(params),
  enabled: !!projectId,
});

// Real-time updates
useEntityEvents({
  onCreated: (data) => { queryClient.invalidateQueries(...) },
});
```

---

## File Location Map

**Need to:** | **Look in:**
---|---
Find page routes | `App.tsx`
Add navigation link | `Layout.tsx`
Create API service | `services/entity.service.ts`
Define types | `types/index.ts`
Add global state | `context/EntityContext.tsx`
Configure HTTP | `lib/axios.ts` or `services/api.client.ts`
Configure WebSocket | `services/websocket.service.ts`
Add component | `components/ComponentName.tsx`
Style anything | Tailwind classes in component
Configure build | `vite.config.ts`
Configure types | `tsconfig.json`

