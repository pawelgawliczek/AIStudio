# Frontend Architecture - Diagrams & Visual Reference

## 1. Application Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                         │
│  React Components + Tailwind CSS + Headless UI + Heroicons      │
│  (Layout, Pages, Components, Modals, Drawers, Cards)            │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                  STATE MANAGEMENT LAYER                          │
│  ┌──────────────┬──────────────┬────────────┬─────────────────┐ │
│  │  React Query │   Context    │  useState  │   WebSocket     │ │
│  │ (Server St.) │ (Global St.) │ (UI State) │ (Real-time)     │ │
│  └──────────────┴──────────────┴────────────┴─────────────────┘ │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                          │
│  Custom Hooks | React Router | Service Layer                    │
│  (useQuery, useMutation, useWebSocket, etc.)                    │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                   API INTEGRATION LAYER                          │
│  ┌─────────────────────┬──────────────────────────────────────┐ │
│  │  Axios HTTP Client  │  Socket.io WebSocket Client          │ │
│  │  (auth, interceptors)│  (real-time, presence, rooms)      │ │
│  └─────────────────────┴──────────────────────────────────────┘ │
│              ↓                                  ↓                 │
│  [Service Layer - 8 Services]      [WebSocket Service]          │
│  - projects.service.ts               - useWebSocket()            │
│  - stories.service.ts                - useStoryEvents()          │
│  - epics.service.ts                  - usePresenceEvents()       │
│  - subtasks.service.ts               - useEpicEvents()           │
│  - use-cases.service.ts              - useSubtaskEvents()        │
│  - test-cases.service.ts                                         │
│  - test-executions.service.ts                                    │
│  - auth.service.ts                                               │
└────────────────┬────────────────────────────────────────────────┘
                 │
         ┌───────┴──────────┐
         │                  │
    [Backend API]    [WebSocket Server]
    :3000/api        :3000 (socket.io)
```

## 2. Component Hierarchy & Data Flow

```
App (BrowserRouter + ProjectProvider)
│
├── Routes
│   ├── /login
│   │   └── LoginPage
│   │       └── auth.service.login()
│   │
│   └── / (Layout)
│       ├── Navigation
│       │   ├── Links (to pages)
│       │   ├── ProjectSelector (useProject)
│       │   │   └── ProjectContext
│       │   └── ConnectionStatus (useWebSocket)
│       │       └── WebSocket Connection
│       │
│       └── Outlet (Page Components)
│           ├── DashboardPage
│           ├── ProjectsPage
│           ├── StoryListPage
│           │   ├── storiesService.getAll(filters)
│           │   ├── React Query: useQuery
│           │   ├── useStoryEvents (WebSocket)
│           │   └── StoryCard (draggable)
│           │
│           ├── StoryDetailPage
│           │   ├── StoryDetailDrawer
│           │   ├── Subtask Management
│           │   └── Status Workflow
│           │
│           ├── PlanningView
│           │   ├── StoryFilters
│           │   ├── KanbanBoard
│           │   │   ├── KanbanColumn (×8)
│           │   │   │   └── StoryCard[] (dnd-kit)
│           │   │   └── DragOverlay
│           │   └── StoryDetailDrawer (on card click)
│           │
│           ├── UseCaseLibraryView
│           │   ├── UseCaseSearchBar
│           │   ├── UseCaseCard[]
│           │   └── UseCaseDetailModal (Headless UI)
│           │       ├── Tab: Content
│           │       ├── Tab: Versions
│           │       └── Tab: Links
│           │
│           ├── TimelineView
│           ├── CodeQualityDashboard
│           ├── AgentPerformanceView
│           ├── TestCaseCoverageDashboard
│           └── ComponentCoverageView
```

## 3. State Management Flow

```
                    ┌─────────────────────────────────┐
                    │   APPLICATION STATE             │
                    └─────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┬──────────────┐
              │               │               │              │
              ▼               ▼               ▼              ▼
        ┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────────┐
        │   React     │ │  Context     │ │  Component │ │  WebSocket   │
        │   Query     │ │  API         │ │  State     │ │  Messages    │
        │             │ │              │ │  (useState)│ │              │
        │ (Server)    │ │ Auth         │ │            │ │ (Real-time)  │
        │  Projects   │ │ ProjectCtx   │ │ UI toggles │ │  story:*     │
        │  Stories    │ │              │ │ Form data  │ │  epic:*      │
        │  Use Cases  │ │ Persistence: │ │ Modal open │ │  subtask:*   │
        │  Test Cases │ │ localStorage │ │ Filters    │ │  user-*      │
        │  Commits    │ │              │ │            │ │  typing      │
        │  Runs       │ │ Auto-select  │ │            │ │              │
        │             │ │ on logout    │ │            │ │  Room-based: │
        │ Caching:    │ │              │ │            │ │  project:*   │
        │ In-memory   │ │              │ │            │ │              │
        └─────────────┘ └──────────────┘ └────────────┘ └──────────────┘
              │               │               │              │
              │               │               │              │
        [useQuery]       [useAuth]      [useState]    [useWebSocket]
        [useMutation]    [useProject]   [Event]       [useStoryEvents]
        [useQueryClient] [Custom hooks]  [handlers]    [useEpicEvents]
                                                       [usePresenceEvents]
```

## 4. API Service Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER PATTERN                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  export const entityService = {                                 │
│    async getAll(filters?) → Promise<Entity[]>                   │
│    async getById(id) → Promise<Entity>                           │
│    async create(data) → Promise<Entity>                          │
│    async update(id, data) → Promise<Entity>                      │
│    async delete(id) → Promise<void>                              │
│    [optional: specialized methods]                              │
│  }                                                               │
│                                                                  │
│  Usage in React Components:                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ const { data } = useQuery({                             │   │
│  │   queryKey: ['entity', params],                         │   │
│  │   queryFn: () => entityService.getAll(params),          │   │
│  │ });                                                      │   │
│  │                                                          │   │
│  │ const { mutate } = useMutation({                        │   │
│  │   mutationFn: (data) => entityService.create(data),    │   │
│  │   onSuccess: () => queryClient.invalidateQueries(...)   │   │
│  │ });                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                   HTTP CLIENT INTERCEPTORS                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  REQUEST FLOW:                                                  │
│  ┌──────────┐       ┌─────────────┐       ┌─────────────┐      │
│  │ Component│──────▶│ Service     │──────▶│ Axios       │      │
│  │ (useQuery)       │ (getAll)    │       │ Instance    │      │
│  └──────────┘       └─────────────┘       └──────┬──────┘      │
│                                                   │              │
│                                    ┌──────────────▼───────────┐ │
│                                    │ Request Interceptor      │ │
│                                    │ + add auth token         │ │
│                                    │ Authorization: Bearer... │ │
│                                    └──────────────┬───────────┘ │
│                                                   │              │
│  RESPONSE FLOW:                                  │              │
│  ┌──────────┐       ┌──────────┐       ┌────────▼────────────┐│
│  │ Component│◀──────│ Cache    │◀──────│ Response Handler    ││
│  │ (update) │ React │ (React   │       │ 200-299:  OK        ││
│  └──────────┘ Query │ Query)   │       │ 401:      Refresh   ││
│                     └──────────┘       │          token      ││
│                                        │ 4xx-5xx:  Reject    ││
│                                        └─────────────────────┘│
│                                                                  │
│  [lib/axios.ts] ← Primary HTTP configuration                    │
│  [api.client.ts] ← Backup singleton (should consolidate)        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 5. React Query Data Lifecycle

```
             ┌─────────────────────────────────────────┐
             │    useQuery Hook Initialized            │
             │    queryKey: ['stories', projectId]     │
             │    queryFn: () => storiesService.getAll │
             └────────────┬────────────────────────────┘
                          │
           ┌──────────────▼──────────────┐
           │   Is data cached?           │
           ├──────────────┬──────────────┤
           │              │              │
        YES (STALE)    YES (FRESH)     NO
           │              │              │
           │              ▼              │
           │         ┌─────────────┐    │
           │         │ Return from │    │
           │         │ Cache       │    │
           │         │ status:     │    │
           │         │ success     │    │
           │         └─────────────┘    │
           │                            │
           ▼                            ▼
    ┌─────────────┐            ┌─────────────────┐
    │ Refetch from│            │ Fetch from API  │
    │ API         │            │ (isLoading: true)
    │ (in bg)     │            │ [abort if 401:  │
    │ Return old  │            │  retry refresh] │
    │ data        │            └────────┬────────┘
    └──────┬──────┘                     │
           │          ┌──────────────────┘
           │          │
           │          ▼
           │    ┌──────────────────┐
           │    │ Data returned    │
           │    │ (from fetch)     │
           │    │ status: success  │
           │    │ [auto invalidate │
           │    │  on mutations]   │
           │    └────────┬─────────┘
           │             │
           └──────┬──────┘
                  │
           ┌──────▼──────────┐
           │ Component State │
           │ Updated         │
           │ Re-render       │
           └─────────────────┘
           
  Key Features:
  - Automatic refetch on invalidation
  - Stale time management
  - Background refetch handling
  - Error retry logic (retry: 1)
  - Caching (5min default)
  - Deduplication (same queryKey = same request)
```

## 6. WebSocket Connection & Room Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                 WebSocket Connection Lifecycle                  │
└────────────────────────────────────────────────────────────────┘

CONNECT PHASE:
┌─────────────────────────────────────────────────────────────┐
│ Application Start                                           │
│ ↓                                                           │
│ wsService.connect()                                         │
│   ├─ Create Socket.io instance                             │
│   ├─ Auth with accessToken                                 │
│   ├─ Set reconnection: true, attempts: 5                   │
│   └─ Listen for connect/disconnect events                  │
│                                                             │
│ Layout / PlanningView component mounts                      │
│ ↓                                                           │
│ useWebSocket() hook                                         │
│   └─ Set isConnected state                                 │
│                                                             │
│ useEffect for room management                              │
│ ↓                                                           │
│ joinRoom(`project:${projectId}`, userId, userName)         │
│   └─ Subscribe to all project updates                      │
│                                                             │
│ useStoryEvents({ callbacks })                              │
│ ↓                                                           │
│ Listen to events:                                           │
│   ├─ story:created                                         │
│   ├─ story:updated                                         │
│   └─ story:status:changed                                  │
│                                                             │
│ ✓ Connection Ready                                          │
└─────────────────────────────────────────────────────────────┘

ACTIVE PHASE:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Server Emits Event                                         │
│  (another user updates story)                               │
│                 ↓                                            │
│  WebSocket Message Received                                 │
│  (story:status:changed)                                     │
│                 ↓                                            │
│  Event Listener Triggered                                   │
│  (callback in useStoryEvents)                               │
│                 ↓                                            │
│  Update Component State                                     │
│  - setStories([...updated])  OR                             │
│  - queryClient.invalidateQueries()                          │
│                 ↓                                            │
│  Component Re-renders                                       │
│  UI Shows New Data                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘

DISCONNECT PHASE:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│ Component Unmounts                                          │
│ ↓                                                           │
│ useEffect cleanup                                           │
│   └─ leaveRoom(`project:${projectId}`)                    │
│       (unsubscribe from project room)                      │
│                                                             │
│ Component Cleanup                                          │
│ ↓                                                           │
│ Off listeners:                                              │
│   ├─ socket.off('story:created')                           │
│   ├─ socket.off('story:updated')                           │
│   └─ socket.off('story:status:changed')                    │
│                                                             │
│ Network Failure / Browser Tab Close                         │
│ ↓                                                           │
│ Auto-reconnect (5 attempts, 1s delay)                       │
│ On success: resume listeners                                │
│ On failure: show ConnectionStatus indicator                │
│                                                             │
└─────────────────────────────────────────────────────────────┘

ROOM SUBSCRIPTIONS:
┌──────────────────────────────────────────────────────────────┐
│ Room: project:${projectId}                                   │
│ ├─ All story changes in project                              │
│ ├─ All epic changes in project                               │
│ ├─ All subtask changes in project                            │
│ ├─ User presence (joined, left, typing)                      │
│ └─ Broadcasts on every update                                │
│                                                              │
│ Benefits:                                                    │
│ ├─ Real-time collaboration                                   │
│ ├─ Instant UI updates across users                           │
│ ├─ Presence awareness (who's editing)                        │
│ └─ Typing indicators                                         │
└──────────────────────────────────────────────────────────────┘
```

## 7. Drag & Drop Data Flow (Kanban Board)

```
┌──────────────────────────────────────────────────────────────────┐
│                  DRAG & DROP FLOW (dnd-kit)                      │
└──────────────────────────────────────────────────────────────────┘

1. SETUP (KanbanBoard.tsx)
   ┌─────────────────────────────────────────┐
   │ <DndContext>                            │
   │   sensors={useSensors(PointerSensor)}   │
   │   collisionDetection={closestCorners}   │
   │   onDragStart={handleDragStart}         │
   │   onDragEnd={handleDragEnd}             │
   │                                         │
   │   ┌───────────────────────────────────┐ │
   │   │ COLUMNS (Status: backlog...done)  │ │
   │   │ ┌─────────────────────────────┐   │ │
   │   │ │ KanbanColumn (droppable)    │   │ │
   │   │ │ ┌────────────────────────┐  │   │ │
   │   │ │ │ StoryCard (draggable)  │  │   │ │
   │   │ │ │ - useSortable()        │  │   │ │
   │   │ │ │ - attributes           │  │   │ │
   │   │ │ │ - listeners            │  │   │ │
   │   │ │ │ - transform (CSS)      │  │   │ │
   │   │ │ └────────────────────────┘  │   │ │
   │   │ │ ┌────────────────────────┐  │   │ │
   │   │ │ │ StoryCard              │  │   │ │
   │   │ │ └────────────────────────┘  │   │ │
   │   │ └─────────────────────────────┘   │ │
   │   │ ┌─────────────────────────────┐   │ │
   │   │ │ KanbanColumn (Review)       │   │ │
   │   │ │ [stale, ready to drop]      │   │ │
   │   │ └─────────────────────────────┘   │ │
   │   └───────────────────────────────────┘ │
   │                                         │
   │   <DragOverlay>                         │
   │     {activeStory && <StoryCard/>}       │
   │   </DragOverlay>                        │
   │ </DndContext>                           │
   └─────────────────────────────────────────┘

2. USER INTERACTION
   Mouse/Touch ──▶ PointerSensor ──▶ Activation Distance 8px?
                                      │
                          ┌───────────┴──────────────┐
                        NO│                          │YES
                          │                          ▼
                      Continue                  Drag Start
                                               ├─ setActiveStory(story)
                                               ├─ Visual feedback (rotate)
                                               └─ Apply transform

3. DRAG PHASE
   ┌────────────────────────────────────────┐
   │ dragging = true                        │
   │ ├─ Opacity: 0.5                        │
   │ ├─ Cursor: move                        │
   │ ├─ Transform: translate(x, y)          │
   │ └─ useDraggable state: isDragging=true│
   │                                        │
   │ Collision Detection (closestCorners)   │
   │ ├─ Check which column is closest       │
   │ ├─ Update over.id to new status        │
   │ └─ Highlight drop zone                 │
   └────────────────────────────────────────┘

4. DROP PHASE
   handleDragEnd() called
   ├─ Get active.id (storyId)
   ├─ Get over.id (newStatus)
   ├─ Check if status changed
   └─ IF YES:
       └─ onStatusChange(storyId, newStatus)
           └─ storiesApi.updateStatus()
               ├─ React Query: useMutation
               └─ Server: PATCH /stories/${id}/status
                   └─ WebSocket broadcasts: story:status:changed
                       ├─ All users see update instantly
                       └─ UI state syncs across clients

5. COMPLETION
   ┌──────────────────────────────────────┐
   │ Story Status Updated                 │
   │ ├─ Component: isDragging = false      │
   │ ├─ activeStory = null                 │
   │ ├─ Transform reset                    │
   │ ├─ Opacity: 1.0                       │
   │ └─ Card in new column                 │
   │                                       │
   │ Data Synced:                          │
   │ ├─ React Query cache updated          │
   │ ├─ WebSocket broadcast received       │
   │ ├─ Other users see update             │
   │ └─ Optimistic update + server sync    │
   └──────────────────────────────────────┘
```

## 8. Routing Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                   REACT ROUTER STRUCTURE                       │
└────────────────────────────────────────────────────────────────┘

<BrowserRouter>
  <ProjectProvider>  ← Global project state
    <Routes>
      
      ┌─────────────────────────────────┐
      │ PUBLIC ROUTES (no Layout)       │
      └─────────────────────────────────┘
      
      <Route path="/login">
        └─ <LoginPage />
           ├─ Form: email, password
           ├─ Submit: auth.service.login()
           ├─ Store: tokens in localStorage
           └─ Redirect: to /dashboard
      
      ┌─────────────────────────────────┐
      │ PROTECTED ROUTES (with Layout)  │
      └─────────────────────────────────┘
      
      <Route path="/" element={<Layout />}>
        ├─ Navigation bar (top)
        ├─ ProjectSelector
        ├─ ConnectionStatus
        │
        ├─ <Outlet />  ← Child routes render here
        │
        ├──────────────────────────────────────┐
        │ CHILD ROUTES                         │
        ├──────────────────────────────────────┤
        │
        ├─ / (index)
        │  └─ <Navigate to="/dashboard" />
        │
        ├─ /dashboard
        │  └─ <DashboardPage />
        │     └─ Static overview
        │
        ├─ /projects
        │  └─ <ProjectsPage />
        │     ├─ List projects
        │     └─ CRUD operations
        │
        ├─ /planning
        │  └─ <PlanningView />  ← Uses searchParams for projectId
        │     ├─ KanbanBoard (drag-drop)
        │     ├─ Filters
        │     └─ Detail drawer
        │
        ├─ /timeline
        │  └─ <TimelineView />
        │     └─ Timeline visualization
        │
        ├─ /use-cases
        │  └─ <UseCaseLibraryView />  ← Multiple search modes
        │     ├─ Semantic search
        │     ├─ Text search
        │     ├─ Component search
        │     └─ Detail modal
        │
        ├─ /code-quality/:projectId
        │  └─ <CodeQualityDashboard />
        │     └─ Project-level metrics
        │
        ├─ /agent-performance/:projectId
        │  └─ <AgentPerformanceView />
        │     └─ Agent metrics
        │
        ├─ /test-coverage/use-case/:useCaseId
        │  └─ <TestCaseCoverageDashboard />
        │     └─ Use case coverage
        │
        ├─ /test-coverage/project/:projectId
        │  └─ <ComponentCoverageView />
        │     └─ Component coverage
        │
        ├─ /projects/:projectId/stories
        │  └─ <StoryListPage />
        │     ├─ Uses useParams: { projectId }
        │     ├─ Search & filters
        │     ├─ Pagination
        │     ├─ Story list
        │     └─ Click to detail
        │
        └─ /projects/:projectId/stories/:storyId
           └─ <StoryDetailPage />
              ├─ Uses useParams: { projectId, storyId }
              ├─ Single story view
              ├─ Subtask management
              └─ Status workflow

PARAMETER PATTERNS:
┌──────────────────────────────────────────────────────────────┐
│ Route Params (in URL path):                                  │
│ ├─ /projects/:projectId/stories/:storyId                    │
│ │  └─ const { projectId, storyId } = useParams()            │
│ │                                                            │
│ ├─ /code-quality/:projectId                                 │
│ │  └─ const { projectId } = useParams()                     │
│ │                                                            │
│ └─ /test-coverage/use-case/:useCaseId                       │
│    └─ const { useCaseId } = useParams()                     │
│                                                              │
│ Query Params (in URL search):                               │
│ ├─ /planning?projectId=abc123                               │
│ │  └─ const [params] = useSearchParams()                    │
│ │     const projectId = params.get('projectId')            │
│ │                                                            │
│ └─ /use-cases?projectId=abc123&area=payment                │
│    └─ Extract multiple query params                         │
└──────────────────────────────────────────────────────────────┘

NAVIGATION METHODS:
┌──────────────────────────────────────────────────────────────┐
│ 1. Link Component                                            │
│    <Link to="/dashboard">Home</Link>                         │
│    <Link to={`/projects/${id}/stories`}>Stories</Link>       │
│                                                              │
│ 2. useNavigate Hook                                         │
│    const navigate = useNavigate();                           │
│    navigate('/dashboard');                                   │
│    navigate(`/projects/${id}/stories/${storyId}`);           │
│    navigate(`/planning?projectId=${projectId}`);            │
│                                                              │
│ 3. Navigate Component                                       │
│    <Navigate to="/dashboard" replace />                      │
│    (Used for conditional redirects)                          │
└──────────────────────────────────────────────────────────────┘
```

## 9. State & Props Flow Example (StoryListPage)

```
┌─────────────────────────────────────────────────────────────┐
│              StoryListPage STATE & PROPS FLOW                │
└─────────────────────────────────────────────────────────────┘

INPUTS:
├─ Route Params: projectId
├─ Context: useProject() → selectedProject
└─ URL Query: none (uses route params)

LOCAL STATE (useState):
├─ search: string
├─ statusFilter: StoryStatus | ''
├─ epicFilter: string
├─ minComplexity: number | ''
├─ maxComplexity: number | ''
├─ sortBy: string ('createdAt')
├─ sortOrder: 'asc' | 'desc'
└─ currentPage: number

SERVER STATE (React Query):
├─ stories: useQuery({
│  ├─ queryKey: ['stories', projectId, ...]
│  ├─ queryFn: () => storiesService.getAll({ ...filters })
│  ├─ return: PaginatedResponse<Story>
│  └─ provides: data, isLoading, error
│
└─ epics: useQuery({
   ├─ queryKey: ['epics', projectId]
   ├─ queryFn: () => epicsService.getAll({ projectId })
   └─ provides: epics list for dropdown

REAL-TIME STATE (WebSocket):
├─ useStoryEvents({
│  ├─ onStoryCreated: (data) ⟶ reload stories
│  ├─ onStoryUpdated: (data) ⟶ update story in list
│  └─ onStoryStatusChanged: (data) ⟶ update story status
│
└─ isConnected: boolean (from useWebSocket)

COMPUTED STATE:
├─ hasFilters: boolean (derived from filter state)
├─ filteredStories: Story[] (based on React Query data)
└─ totalPages: number (from paginated response)

HANDLERS:
├─ handleSearch(): void
│  ├─ Set currentPage = 1
│  └─ Call loadStories()
│
├─ handleClearFilters(): void
│  ├─ Reset all filter state
│  └─ Call loadStories()
│
├─ handleStatusChange(storyId, status): void
│  └─ Call storiesService.updateStatus()
│
└─ pagination handlers (next/prev page)

RENDER:
├─ Breadcrumbs
├─ Header (title + create button)
├─ Filter controls
│  ├─ Search input
│  ├─ Status dropdown
│  ├─ Epic dropdown
│  ├─ Complexity filter
│  └─ Sort dropdown
│
├─ Loading state
│  └─ Spinner
│
├─ Empty state
│  └─ "No stories found"
│
├─ Story list
│  ├─ StoryCard[]
│  │  ├─ Props: story, onClick
│  │  ├─ Click: open detail drawer or navigate
│  │  └─ Shows: key, status, epic, complexity, subtasks
│  │
│  └─ Each card is Link to detail page
│
└─ Pagination controls
   ├─ Info: "Showing X to Y of Z"
   ├─ Previous button (disabled if page === 1)
   └─ Next button (disabled if at end)

DATA FLOW ON UPDATE:
┌──────────────────────────────────────────────────────┐
│ User changes status filter                           │
│ ↓                                                    │
│ setStatusFilter(value)  ← state update               │
│ ↓                                                    │
│ useEffect dependency triggers                       │
│ ↓                                                    │
│ loadStories() called                                 │
│ ↓                                                    │
│ storiesService.getAll(filters)                       │
│ ↓                                                    │
│ React Query: fetch updated data                      │
│ ↓                                                    │
│ Cache: store in memory                               │
│ ↓                                                    │
│ Re-render: stories prop updates                      │
│ ↓                                                    │
│ Component receives new data                          │
│ ├─ data: updated stories[]                          │
│ ├─ isLoading: false                                 │
│ └─ error: null                                       │
│ ↓                                                    │
│ Render updated story list                            │
│                                                      │
│ IF WebSocket event arrives simultaneously:          │
│ ├─ onStoryUpdated event triggers                    │
│ ├─ Update local state immediately                   │
│ ├─ React Query cache invalidates                    │
│ └─ Data stays in sync                               │
└──────────────────────────────────────────────────────┘
```

---

These diagrams provide a visual understanding of how the frontend architecture works at different levels - from component hierarchy to data flow to WebSocket synchronization.

