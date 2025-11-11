# AI Studio Frontend Architecture Analysis

## Executive Summary

The AI Studio frontend is a **React 18 + TypeScript** application built with **Vite** as the build tool. It implements a modern, component-driven architecture with comprehensive state management, real-time updates via WebSocket, and a clean separation of concerns between presentation, business logic, and API integration layers.

**Total Lines of Code:** ~7,500 LOC  
**Total Source Files:** 41 TypeScript/TSX files  
**Architecture Pattern:** Feature-based with layered service architecture

---

## 1. Frontend Structure

### Directory Layout

```
/frontend/src/
├── components/          # Reusable UI components (12 files)
├── pages/              # Page-level components (12 files)
├── services/           # API integration layer (8 files)
├── context/            # React Context for state (2 files)
├── lib/                # Utilities and configurations (2 files)
├── types/              # Shared TypeScript types (1 file)
├── App.tsx             # Main routing component
├── main.tsx            # Application entry point
└── index.css           # Global styles (Tailwind)
```

### Detailed Component Organization

#### **Pages** (`/pages/` - 12 files)
These are full-page components that handle routing and page-level logic:

```
DashboardPage.tsx              # Home/Overview dashboard
ProjectsPage.tsx               # Project listing & management
StoryListPage.tsx              # Stories list with filters/pagination
StoryDetailPage.tsx            # Single story with subtasks
PlanningView.tsx               # Kanban board for story workflow
TimelineView.tsx               # Timeline/Roadmap visualization
UseCaseLibraryView.tsx         # Use case management & search
CodeQualityDashboard.tsx       # Code quality metrics
AgentPerformanceView.tsx       # AI agent performance metrics
TestCaseCoverageDashboard.tsx  # Test coverage by use case
ComponentCoverageView.tsx      # Test coverage by component
LoginPage.tsx                  # Authentication page
```

**Key Pattern:** Pages use React Router and fetch data via services + React Query

Example from `StoryListPage.tsx`:
- State: filter controls, pagination, loading states
- Data fetching: `storiesService.getAll(filters)` 
- Real-time updates: `useStoryEvents()` hook for WebSocket updates
- Rendering: List view with search, filters, and pagination

#### **Components** (`/components/` - 12 files)
Reusable, composable UI components:

```
Layout.tsx                     # Main app shell with navigation
KanbanBoard.tsx               # Drag-and-drop story board
KanbanColumn.tsx              # Individual column in Kanban
StoryCard.tsx                 # Card component with dnd-kit integration
StoryDetailDrawer.tsx         # Right-side drawer for story details
StoryFilters.tsx              # Filter controls component
UseCaseCard.tsx               # Use case display card
UseCaseDetailModal.tsx        # Modal for use case details & editing
UseCaseSearchBar.tsx          # Search with multiple modes
ProjectSelector.tsx           # Dropdown for project selection
Breadcrumbs.tsx               # Navigation breadcrumbs
ConnectionStatus.tsx          # WebSocket connection indicator
```

**Component Design Patterns:**

1. **Drag & Drop Integration:**
   - `StoryCard` uses `@dnd-kit/sortable` for dragging
   - `KanbanBoard` uses `@dnd-kit/core` for drop zones
   - CSS utilities from `@dnd-kit/utilities` for transforms

2. **Headless UI Components:**
   - `ProjectSelector`: `Listbox` + `Transition`
   - `UseCaseDetailModal`: `Dialog` + `Transition` + `Tab`
   - `StoryDetailDrawer`: `Dialog` + `Transition`
   - All with smooth animations and accessibility

3. **Icon Usage:**
   - `@heroicons/react` (24/outline variant)
   - Examples: `MagnifyingGlassIcon`, `PlusIcon`, `FunnelIcon`

4. **Styling Approach:**
   - **Tailwind CSS** for all styling
   - **clsx** for conditional class names
   - Consistent color scheme: indigo for primary actions

### Component Hierarchy Example

```
Layout (app shell)
├── Navigation (Links + ProjectSelector + ConnectionStatus)
├── Outlet (router pages)
│   └── StoryListPage
│       ├── Breadcrumbs
│       ├── StoryFilters (search, status, epic, complexity)
│       └── List of StoryCards
│           └── Each card clickable for details

PlanningView
├── StoryFilters
├── KanbanBoard
│   ├── KanbanColumn (×8 status columns)
│   │   └── StoryCard[] (draggable items)
│   └── DragOverlay (visual feedback during drag)
└── StoryDetailDrawer (opened on card click)
```

---

## 2. State Management

### Multi-Layer State Strategy

The frontend uses a **hybrid approach** combining:
1. **Server State** → React Query (data from API)
2. **UI State** → Local component state (UI interactions)
3. **Global State** → React Context (project selection, auth)
4. **Real-time State** → WebSocket (live updates)

### 2.1 React Query (@tanstack/react-query v5.17)

**Configuration** (`main.tsx`):
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,  // Prevent refetch on tab focus
      retry: 1,                     // Single retry on failure
    },
  },
});
```

**Usage Patterns in Pages:**

#### Pattern 1: Simple Queries
```typescript
// PlanningView.tsx
const { data: stories = [], isLoading: storiesLoading } = useQuery({
  queryKey: ['stories', projectId],
  queryFn: () => storiesApi.getAll({ projectId }).then(res => res.data),
  enabled: !!projectId,  // Conditional fetching
});
```

#### Pattern 2: Dependent Queries
```typescript
// PlanningView.tsx
const { data: storyCommits = [] } = useQuery({
  queryKey: ['commits', selectedStory?.id],
  queryFn: () => selectedStory ? commitsApi.getByStory(selectedStory.id) : [],
  enabled: !!selectedStory,  // Only fetch when story selected
});
```

#### Pattern 3: Mutations with Invalidation
```typescript
// UseCaseLibraryView.tsx
const deleteMutation = useMutation({
  mutationFn: (id: string) => useCasesService.delete(id),
  onSuccess: () => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['useCases'] });
    setIsDetailModalOpen(false);
  },
});
```

#### Pattern 4: Update Mutations
```typescript
// UseCaseDetailModal.tsx
const updateMutation = useMutation({
  mutationFn: (data: typeof editForm) =>
    useCasesService.update(useCase.id, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['useCases'] });
    queryClient.invalidateQueries({ queryKey: ['useCaseVersions', useCase.id] });
    setIsEditing(false);
  },
});
```

**Key Benefits Used:**
- Automatic caching and deduplication
- Built-in loading/error states
- Stale data management
- Cache invalidation strategies
- Dependent query handling

### 2.2 React Context API

**AuthContext** (`context/AuthContext.tsx`):
```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

// Custom hook pattern
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**ProjectContext** (`context/ProjectContext.tsx`):
```typescript
interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  isLoading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
}

// Features:
// - Loads projects on mount
// - Persists selection to localStorage
// - Auto-selects first project if none saved
// - Updates selection when projects refresh
```

**State Persistence Pattern:**
```typescript
const handleSetSelectedProject = (project: Project | null) => {
  setSelectedProject(project);
  if (project) {
    localStorage.setItem('selectedProjectId', project.id);
  } else {
    localStorage.removeItem('selectedProjectId');
  }
};
```

### 2.3 Local Component State

**Type:** Standard `useState` for UI-only state

**Examples:**
```typescript
// Filters and search
const [search, setSearch] = useState('');
const [statusFilter, setStatusFilter] = useState<StoryStatus | ''>('');
const [currentPage, setCurrentPage] = useState(1);

// UI controls
const [isModalOpen, setIsModalOpen] = useState(false);
const [isEditing, setIsEditing] = useState(false);
const [activeStory, setActiveStory] = useState<Story | null>(null);

// Form state
const [editForm, setEditForm] = useState({
  title: useCase.title,
  area: useCase.area || '',
  content: useCase.latestVersion?.content || '',
});
```

### 2.4 WebSocket Real-Time State

**Server State Synchronization** (`services/websocket.service.ts`):

**Connection Management:**
```typescript
class WebSocketService {
  private socket: Socket | null = null;
  private connected = false;

  connect(): Socket {
    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    // ... handlers
  }
}
```

**Event Hooks (Custom React Hooks):**

```typescript
// Hook 1: Story events
export function useStoryEvents(callbacks: {
  onStoryCreated?: (data: StoryCreatedEvent) => void;
  onStoryUpdated?: (data: StoryUpdatedEvent) => void;
  onStoryStatusChanged?: (data: StoryStatusChangedEvent) => void;
}) {
  const { socket } = useWebSocket();
  useEffect(() => {
    if (!socket) return;
    if (callbacks.onStoryCreated) {
      socket.on('story:created', callbacks.onStoryCreated);
    }
    // ... cleanup
  }, [socket, callbacks]);
}

// Hook 2: Presence events
export function usePresenceEvents(callbacks: {
  onUserJoined?: (data: UserJoinedEvent) => void;
  onUserLeft?: (data: UserLeftEvent) => void;
  onTyping?: (data: TypingEvent) => void;
}) {
  // Similar pattern
}
```

**Usage in Pages:**
```typescript
// StoryListPage.tsx
useStoryEvents({
  onStoryCreated: (data) => {
    if (data.story.projectId === projectId) {
      loadStories(); // Reload to maintain sort/filter
    }
  },
  onStoryUpdated: (data) => {
    setStories(prev => prev.map(s => 
      s.id === data.story.id ? data.story : s
    ));
  },
  onStoryStatusChanged: (data) => {
    setStories(prev => prev.map(s => 
      s.id === data.storyId ? { ...s, status: data.newStatus } : s
    ));
  },
});
```

**Room Management:**
```typescript
useEffect(() => {
  if (projectId && isConnected) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    joinRoom(`project:${projectId}`, user.id, user.name);
    return () => leaveRoom(`project:${projectId}`);
  }
}, [projectId, isConnected]);
```

### State Management Summary

| Layer | Technology | Use Case | Persistence |
|-------|-----------|----------|-------------|
| **Server** | React Query | API data, caching | In-memory |
| **Global** | Context API | Auth, project selection | localStorage |
| **Local UI** | useState | Form inputs, UI toggles | None |
| **Real-time** | WebSocket | Live updates, presence | None |

---

## 3. API Integration

### 3.1 HTTP Client Configuration

**Two Concurrent Implementations:**

#### Implementation 1: `lib/axios.ts` (Primary)
```typescript
const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: Add auth token
axiosInstance.interceptors.request.use((config) => {
  const token = authService.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Handle 401 + token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const newToken = await authService.refreshToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);
```

#### Implementation 2: `services/api.client.ts` (Singleton)
```typescript
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
    });
    
    // Interceptors setup
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient().getClient();
```

**Note:** Both exist - should consolidate to single approach

### 3.2 Service Layer Architecture

**Pattern:** Modular service objects with async methods

#### Core Service Template
```typescript
export const serviceService = {
  async getAll(filters?: FilterDto): Promise<T[]> {
    const response = await apiClient.get<T[]>('/endpoint', { params: filters });
    return response.data;
  },

  async getById(id: string): Promise<T> {
    const response = await apiClient.get<T>(`/endpoint/${id}`);
    return response.data;
  },

  async create(data: CreateDto): Promise<T> {
    const response = await apiClient.post<T>('/endpoint', data);
    return response.data;
  },

  async update(id: string, data: UpdateDto): Promise<T> {
    const response = await apiClient.patch<T>(`/endpoint/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/endpoint/${id}`);
  },
};
```

#### Services Implemented

```
projects.service.ts
├── getAll() → Project[]
├── getById(id) → Project
├── create(data) → Project
├── update(id, data) → Project
└── delete(id) → void

stories.service.ts
├── getAll(filters) → PaginatedResponse<Story>
├── getById(id) → Story
├── create(data) → Story
├── update(id, data) → Story
├── updateStatus(id, status) → Story
├── assignFramework(id, frameworkId) → Story
└── delete(id) → void

epics.service.ts
├── getAll(filters) → Epic[]
├── getById(id) → Epic
├── create(data) → Epic
├── update(id, data) → Epic
└── delete(id) → void

subtasks.service.ts
├── getAll(filters) → Subtask[]
├── getById(id) → Subtask
├── create(data) → Subtask
├── update(id, data) → Subtask
└── delete(id) → void

use-cases.service.ts
├── getAll(params) → UseCase[]
├── getById(id) → UseCase
├── search(params) → UseCase[]  // semantic + text + component modes
├── create(data) → UseCase
├── update(id, data) → UseCase
├── delete(id) → void
├── getVersionHistory(id) → UseCaseVersion[]
├── linkToStory(useCaseId, storyId) → void
├── unlinkFromStory(useCaseId, storyId) → void
├── findRelated(id, limit?) → UseCase[]
└── regenerateEmbeddings(projectId) → void

test-cases.service.ts
├── create(data) → TestCase
├── findAll(params) → PaginatedResponse<TestCase>
├── findOne(id) → TestCase
├── update(id, data) → TestCase
├── delete(id) → void
├── getUseCaseCoverage(useCaseId) → UseCaseCoverage
├── getCoverageGaps(useCaseId) → CoverageGap[]
└── getComponentCoverage(projectId, component?) → ComponentCoverage[]

test-executions.service.ts
├── report(data) → TestExecution
├── getByTestCase(id) → TestExecution[]
├── getByStory(id) → TestExecution[]
└── getStatistics(testCaseId) → TestExecutionStatistics

auth.service.ts
├── login(credentials) → AuthResponse
├── register(data) → AuthResponse
├── logout() → void
├── refreshToken() → string | null
├── getCurrentUser() → User | null
├── getAccessToken() → string | null
└── getRefreshToken() → string | null
```

### 3.3 API Configuration

**Environment Variables:**
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
```

**Vite Dev Proxy:**
```typescript
// vite.config.ts
server: {
  port: 5173,
  host: true,
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
},
```

### 3.4 Type-Safe API Integration

**Type Definitions** (`types/index.ts` - 604 lines):

```typescript
// DTOs
export interface CreateStoryDto {
  projectId: string;
  epicId?: string;
  title: string;
  description?: string;
  type?: StoryType;
  businessComplexity?: number;
  technicalComplexity?: number;
  businessImpact?: number;
}

// Filter/Search DTOs
export interface FilterStoryDto {
  projectId?: string;
  epicId?: string;
  status?: StoryStatus;
  type?: StoryType;
  search?: string;
  minTechnicalComplexity?: number;
  maxTechnicalComplexity?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Paginated Response
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// WebSocket Event Types
export interface StoryCreatedEvent {
  story: Story;
}

export interface StoryStatusChangedEvent {
  storyId: string;
  oldStatus: StoryStatus;
  newStatus: StoryStatus;
  story: Story;
}
```

### 3.5 WebSocket Integration

**Connection Lifecycle:**
```typescript
connect() → authenticated with token → join rooms → listen to events
↓
disconnect() → cleanup listeners → close socket
```

**Event Types:**
- `story:created`, `story:updated`, `story:status:changed`
- `epic:created`, `epic:updated`
- `subtask:created`, `subtask:updated`
- `user-joined`, `user-left`, `typing`

**Room-Based Architecture:**
```typescript
joinRoom(`project:${projectId}`, userId, userName)
// Subscribes to all updates for that project

emitTyping(entityId, entityType, userId, userName)
// Broadcasts user is editing entity
```

---

## 4. Routing Architecture

### 4.1 React Router v6 Setup

**Main Router** (`App.tsx`):
```typescript
<BrowserRouter>
  <ProjectProvider>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="planning" element={<PlanningView />} />
        <Route path="timeline" element={<TimelineView />} />
        <Route path="use-cases" element={<UseCaseLibraryView />} />
        <Route path="code-quality/:projectId" element={<CodeQualityDashboard />} />
        <Route path="agent-performance/:projectId" element={<AgentPerformanceView />} />
        <Route path="test-coverage/use-case/:useCaseId" element={<TestCaseCoverageDashboard />} />
        <Route path="test-coverage/project/:projectId" element={<ComponentCoverageView />} />
        <Route path="projects/:projectId/stories" element={<StoryListPage />} />
        <Route path="projects/:projectId/stories/:storyId" element={<StoryDetailPage />} />
      </Route>
    </Routes>
  </ProjectProvider>
</BrowserRouter>
```

### 4.2 Route Organization

**Route Categories:**

| Category | Routes | Purpose |
|----------|--------|---------|
| **Auth** | `/login` | Public, no layout |
| **Global** | `/dashboard`, `/projects`, `/use-cases` | Main navigation items |
| **Planning** | `/planning`, `/timeline` | Workflow visualization |
| **Metrics** | `/code-quality/:id`, `/agent-performance/:id`, `/test-coverage/*` | Analytics views |
| **Details** | `/projects/:id/stories/:id` | Nested detail routes |

### 4.3 Navigation Patterns

**Link-Based Navigation:**
```typescript
// Layout.tsx - Main navigation
<Link to="/dashboard">Dashboard</Link>
<Link to="/projects">Projects</Link>
<Link to={`/code-quality/${selectedProject}`}>Code Quality</Link>
```

**Programmatic Navigation:**
```typescript
// StoryListPage.tsx
const navigate = useNavigate();
navigate(`/projects/${projectId}/stories/new`);

// Using replace for auth flow
<Navigate to="/dashboard" replace />
```

**URL Params:**
```typescript
// StoryListPage.tsx
const { projectId } = useParams<{ projectId: string }>();

// UseCaseLibraryView.tsx
const [searchParams] = useSearchParams();
const projectId = searchParams.get('projectId') || '';
```

**Breadcrumb Component:**
```typescript
// Navigation context
<Breadcrumbs
  items={[
    { name: 'Stories', testId: 'breadcrumb-stories' },
  ]}
/>
```

---

## 5. UI Patterns & Component Patterns

### 5.1 Component Library: Headless UI

**Headless UI Usage:**

#### Listbox (Dropdown Select)
```typescript
// ProjectSelector.tsx
<Listbox value={selectedProject} onChange={setSelectedProject}>
  {({ open }) => (
    <>
      <Listbox.Button className="...">
        {selectedProject?.name || 'Select a project'}
      </Listbox.Button>
      <Transition show={open}>
        <Listbox.Options>
          <Listbox.Option key={id} value={project}>
            {project.name}
          </Listbox.Option>
        </Listbox.Options>
      </Transition>
    </>
  )}
</Listbox>
```

#### Dialog (Modal)
```typescript
// UseCaseDetailModal.tsx
<Dialog as="div" className="relative z-50" onClose={onClose}>
  <Transition.Child
    enter="ease-out duration-300"
    enterFrom="opacity-0"
    enterTo="opacity-100"
  >
    <div className="fixed inset-0 bg-black bg-opacity-25" />
  </Transition.Child>
  
  <Dialog.Panel className="...">
    <Dialog.Title>Title</Dialog.Title>
    {/* content */}
  </Dialog.Panel>
</Dialog>
```

#### Tab Group
```typescript
// UseCaseDetailModal.tsx
<Tab.Group>
  <Tab.List>
    <Tab>Content</Tab>
    <Tab>Versions</Tab>
    <Tab>Links</Tab>
  </Tab.List>
  <Tab.Panels>
    <Tab.Panel>...</Tab.Panel>
  </Tab.Panels>
</Tab.Group>
```

### 5.2 Styling: Tailwind CSS

**Configuration:**
```javascript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50, 100, 200, ..., 950 }
      }
    }
  }
}
```

**Global Styles:**
```css
/* index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  color-scheme: light dark;
}
```

**Utility Classes Pattern:**
```tsx
// Spacing
<div className="px-4 py-6 sm:px-6">

// Flexbox layouts
<div className="flex justify-between items-center">

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

// Colors
<span className="bg-indigo-600 text-white">
<span className="bg-green-100 text-green-800">

// Transitions
<button className="hover:shadow-md transition-shadow">

// States
<button className="disabled:opacity-50">
```

**Conditional Classes:**
```typescript
import clsx from 'clsx';

<span className={clsx(
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
  STATUS_COLORS[story.status]
)}>
```

### 5.3 Form Handling

**Strategy:** `useState` + HTML `<input>` / `<select>` / `<textarea>`

**Example: Story Filters**
```typescript
// StoryListPage.tsx
const [search, setSearch] = useState('');
const [statusFilter, setStatusFilter] = useState<StoryStatus | ''>('');
const [minComplexity, setMinComplexity] = useState<number | ''>('');

return (
  <>
    {/* Search input */}
    <input
      type="text"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
    />
    
    {/* Select dropdown */}
    <select
      value={statusFilter}
      onChange={(e) => setStatusFilter(e.target.value)}
    >
      <option value="">All statuses</option>
      <option value="planning">Planning</option>
    </select>
    
    {/* Range filter */}
    <select
      value={minComplexity}
      onChange={(e) => setMinComplexity(e.target.value ? Number(e.target.value) : '')}
    >
      <option value="">Any</option>
      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  </>
);
```

**Example: Inline Editing Form**
```typescript
// UseCaseDetailModal.tsx
const [editForm, setEditForm] = useState({
  title: useCase.title,
  area: useCase.area || '',
  content: useCase.latestVersion?.content || '',
});

const handleSave = async () => {
  await updateMutation.mutateAsync(editForm);
};
```

**Note:** No form library (no react-hook-form) - direct state management

### 5.4 Drag & Drop: @dnd-kit

**Pattern: Kanban Board**

```typescript
// KanbanBoard.tsx
export function KanbanBoard({ stories, onStoryClick, onStatusChange }) {
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const storyId = active.id as string;
    const newStatus = over?.id as StoryStatus;
    
    if (story && story.status !== newStatus) {
      onStatusChange(storyId, newStatus);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4">
        {columns.map(({ status, title }) => (
          <KanbanColumn key={status} status={status}>
            {stories[status].map(story => (
              <StoryCard key={story.id} story={story} />
            ))}
          </KanbanColumn>
        ))}
      </div>
      
      <DragOverlay>
        {activeStory && <StoryCard story={activeStory} />}
      </DragOverlay>
    </DndContext>
  );
}
```

**StoryCard Integration:**
```typescript
// StoryCard.tsx
export function StoryCard({ story, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition } = 
    useSortable({ id: story.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* Card content */}
    </div>
  );
}
```

### 5.5 Icon System: Heroicons

**Installation & Usage:**
```typescript
import {
  MagnifyingGlassIcon,
  PlusIcon,
  FunnelIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
<PlusIcon className="h-5 w-5 mr-2" />
```

**Size Convention:** `h-4 w-4` (small), `h-5 w-5` (medium), `h-6 w-6` (large)

### 5.6 UI Component Patterns

#### Status Badge
```typescript
const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-800',
  analysis: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
};

<span className={clsx(
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
  STATUS_COLORS[story.status]
)}>
  {story.status}
</span>
```

#### Loading State
```typescript
{isLoading ? (
  <div className="text-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
  </div>
) : (
  // content
)}
```

#### Empty State
```typescript
{stories.length === 0 ? (
  <div className="text-center py-12">
    <p className="text-gray-500">No stories found</p>
  </div>
) : (
  // content
)}
```

#### Pagination
```typescript
{total > limit && (
  <div className="mt-6 flex justify-between items-center">
    <div className="text-sm text-gray-700">
      Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, total)} of {total}
    </div>
    <div className="flex gap-2">
      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
        Previous
      </button>
      <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage * limit >= total}>
        Next
      </button>
    </div>
  </div>
)}
```

---

## 6. Build & Development Setup

### 6.1 Vite Configuration
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@aistudio/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### 6.2 TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@aistudio/shared": ["../shared/src"]
    }
  }
}
```

### 6.3 NPM Scripts
```json
{
  "dev": "vite",                      // Start dev server on :5173
  "build": "tsc && vite build",       // Type check + build
  "preview": "vite preview",          // Preview production build
  "lint": "eslint . --ext ts,tsx ...", // Lint TS files
  "test": "vitest",                   // Run tests
  "test:coverage": "vitest --coverage" // Coverage report
}
```

### 6.4 Dependencies

**Core:**
- `react@18.2.0` - UI library
- `react-dom@18.2.0` - DOM rendering
- `react-router-dom@6.21.3` - Routing

**State Management:**
- `@tanstack/react-query@5.17.19` - Server state
- `zustand@4.5.0` - Client state (if used)

**UI Components:**
- `@headlessui/react@1.7.18` - Unstyled accessible components
- `@heroicons/react@2.1.1` - Icon library
- `tailwindcss@3.4.1` - Utility CSS
- `clsx@2.1.0` - Conditional classes

**Drag & Drop:**
- `@dnd-kit/core@6.3.1` - Core DnD context
- `@dnd-kit/sortable@10.0.0` - Sortable preset
- `@dnd-kit/utilities@3.2.2` - Utilities

**Real-time:**
- `socket.io-client@4.6.1` - WebSocket client

**API:**
- `axios@1.6.5` - HTTP client

**Forms & Validation:**
- `react-hook-form@7.49.3` - Form state (if used)
- `zod@3.22.4` - Schema validation

**Utilities:**
- `date-fns@3.2.0` - Date formatting
- `react-markdown@10.1.0` - Markdown rendering
- `recharts@2.15.4` - Charts library

---

## 7. Key Architectural Decisions

### 1. **Hybrid State Management**
- React Query for server state (API data)
- Context for global UI state (auth, project)
- Local useState for component state
- WebSocket for real-time updates

**Benefit:** Clear separation of concerns, optimal performance

### 2. **Service Layer Pattern**
- Centralized API logic in services
- Consistent error handling
- Type-safe requests/responses
- Easy to mock for testing

### 3. **Page-Based Organization**
- Top-level page components handle routing
- Services for data fetching
- Smaller reusable components
- Clean component hierarchy

### 4. **Headless UI + Tailwind**
- Unstyled components for full control
- Utility-first CSS
- Consistent design system
- Fast development

### 5. **WebSocket for Real-time**
- Room-based subscriptions
- Event-driven updates
- Presence awareness (typing, users online)
- Fallback with React Query refetches

### 6. **dnd-kit for Drag & Drop**
- Modern, headless DnD library
- Keyboard accessible
- Mobile-friendly
- Customizable collision detection

---

## 8. Comparison: Two API Client Implementations

| Feature | `lib/axios.ts` | `api.client.ts` |
|---------|---|---|
| **Type** | Direct instance | Singleton class |
| **Token Refresh** | Automatic + retry | Manual 401 handling |
| **Error Handling** | Response interceptor | Response interceptor |
| **Initialization** | Immediate | Lazy (on first call) |
| **Status** | Primary (used more) | Secondary (fallback?) |

**Recommendation:** Consolidate to single implementation

---

## 9. Missing/Future Improvements

1. **Form Library:** Consider `react-hook-form` + `zod` for complex forms
2. **State Management:** Consider `zustand` for complex global state
3. **API Client Consolidation:** Merge axios instances
4. **Error Boundaries:** Add React error boundaries
5. **Testing:** Vitest setup for component/hook testing
6. **Accessibility:** More ARIA labels
7. **Loading Skeletons:** Better UX during loading
8. **Cache Strategy:** More granular React Query invalidation
9. **Build Optimization:** Code splitting by route
10. **Analytics:** Event tracking setup

---

## Summary Table

| Aspect | Technology | Pattern | Files |
|--------|-----------|---------|-------|
| **Routing** | React Router v6 | Nested routes | App.tsx |
| **Components** | React 18 + TSX | Functional + hooks | 12 in /components |
| **Pages** | React + Router | Page components | 12 in /pages |
| **Server State** | React Query | Queries + mutations | Used in 5+ pages |
| **Global State** | Context API | Auth + ProjectContext | 2 files |
| **Real-time** | Socket.io | Event hooks | websocket.service.ts |
| **HTTP** | Axios | Service layer | 8 services |
| **Styling** | Tailwind CSS | Utility classes | tailwind.config.js |
| **UI Library** | Headless UI | Unstyled components | Layout, modals, dropdowns |
| **Icons** | Heroicons | SVG icons | Throughout |
| **DnD** | dnd-kit | Kanban board | KanbanBoard component |
| **Build** | Vite | ESM bundler | vite.config.ts |
| **Types** | TypeScript | Strict mode | types/index.ts |

