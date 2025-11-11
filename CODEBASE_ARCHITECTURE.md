# Codebase Architecture Summary

## Project Overview
**Application**: Vibe Studio (formerly AI Studio) - Project planning and management system with AI agent integration
**Tech Stack**:
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router
- **Backend**: NestJS, TypeScript, PostgreSQL with Prisma ORM
- **Real-time**: Socket.io for WebSocket communication
- **Drag-and-Drop**: @dnd-kit library (Core, Sortable, Utilities)
- **State Management**: React Query (@tanstack/react-query), Zustand
- **UI Components**: Headless UI, Hero Icons

---

## 1. CURRENT EPIC, STORY, AND BUG COMPONENTS

### Data Models (Prisma Schema)

#### Epic Model
```typescript
model Epic {
  id: String              // UUID
  projectId: String       // FK to Project
  key: String            // e.g., "EP-1" (unique per project)
  title: String
  description: String?
  status: EpicStatus     // planning, in_progress, done, archived
  priority: Int          // 0+ (used for sorting)
  createdAt: DateTime
  updatedAt: DateTime
  
  // Relations
  stories: Story[]       // 1-to-many
  commits: Commit[]      // 1-to-many
}

enum EpicStatus {
  planning
  in_progress
  done
  archived
}
```

#### Story Model
```typescript
model Story {
  id: String
  projectId: String
  epicId: String?        // Optional FK to Epic
  key: String            // e.g., "ST-1" (unique per project)
  type: StoryType        // feature, bug, defect, chore, spike
  title: String
  description: String?
  status: StoryStatus    // 10 statuses including backlog, planning, implementation, etc.
  
  // Complexity Metrics
  businessImpact: Int?         // 1-5 priority/impact rating
  businessComplexity: Int?     // 1-5 scale
  technicalComplexity: Int?    // 1-5 scale
  estimatedTokenCost: Int?     // For AI estimation
  
  // Relations
  assignedFrameworkId: String?  // FK to AgentFramework
  createdById: String          // FK to User
  subtasks: Subtask[]
  useCaseLinks: StoryUseCaseLink[]
  commits: Commit[]
  runs: Run[]
  testExecutions: TestExecution[]
  defect: Defect?              // 1-to-1 optional
  releaseItems: ReleaseItem[]
}

enum StoryType {
  feature
  bug
  defect
  chore
  spike
}

enum StoryStatus {
  backlog
  planning
  analysis
  architecture
  design
  implementation
  review
  qa
  done
  blocked
}
```

#### Subtask Model
```typescript
model Subtask {
  id: String
  storyId: String              // FK to Story
  key: String?                 // Optional, within story scope
  title: String
  description: String?
  
  // Classification
  layer: LayerType?            // frontend, backend, infra, test, other
  component: String?           // Component/module name
  assigneeType: AssigneeType   // agent or human
  assigneeId: String?          // FK (flexible - agent or user)
  
  status: SubtaskStatus        // todo, in_progress, done, blocked
  createdAt: DateTime
  updatedAt: DateTime
  
  // Relations
  story: Story
  runs: Run[]
}

enum SubtaskStatus {
  todo
  in_progress
  done
  blocked
}

enum LayerType {
  frontend
  backend
  infra
  test
  other
}

enum AssigneeType {
  human
  agent
}
```

#### Defect Model (Bug-specific)
```typescript
model Defect {
  storyId: String              // PK + FK to Story
  originStoryId: String?       // Which story introduced this defect
  originStage: OriginStage?    // Where defect originated (dev, arch, ba, unknown)
  discoveryStage: DiscoveryStage  // When found (unit_test, integration_test, qa, uat, production)
  severity: DefectSeverity     // low, medium, high, critical
  
  story: Story
}

enum DefectSeverity {
  low
  medium
  high
  critical
}
```

### Frontend Components

#### Pages
- **PlanningView.tsx** - Main Kanban-based planning board
- **StoryListPage.tsx** - Table/list view of stories
- **StoryDetailPage.tsx** - Full story detail view
- **DashboardPage.tsx** - Overview and metrics

#### Components
- **KanbanBoard.tsx** - Drag-and-drop board component (8 columns for each status)
- **KanbanColumn.tsx** - Individual status column with drop zone
- **StoryCard.tsx** - Card component for each story in Kanban
- **StoryFilters.tsx** - Filter UI (Epic, Status, Type, Search)
- **StoryDetailDrawer.tsx** - Right-side panel showing full story details
- **Breadcrumbs.tsx** - Navigation breadcrumbs
- **ProjectSelector.tsx** - Project selection dropdown
- **ConnectionStatus.tsx** - Real-time connection indicator

---

## 2. PLANNING VIEW IMPLEMENTATION

### PlanningView.tsx Architecture

**Location**: `/home/user/AIStudio/frontend/src/pages/PlanningView.tsx`

#### State Management
- Uses React Query for server state (`useQuery`, `useMutation`)
- Local state for filters and UI (`useState`)
- Real-time updates via WebSocket hooks

#### Key Features

1. **Data Fetching**
   ```typescript
   // Stories with optional filters
   useQuery({
     queryKey: ['stories', projectId],
     queryFn: () => storiesApi.getAll({ projectId })
   })
   
   // Epics for filtering dropdown
   useQuery({
     queryKey: ['epics', projectId],
     queryFn: () => epicsApi.getAll(projectId)
   })
   ```

2. **Filtering Pipeline**
   - Epic filter (all vs specific epic)
   - Status filter (10 story statuses)
   - Type filter (feature, bug, defect, chore, spike)
   - Full-text search (title, key, description)
   - All filters combined via useMemo for efficient re-rendering

3. **Real-time Updates**
   - WebSocket connection to project room
   - Broadcasts on story creation, updates, status changes
   - Auto-invalidates React Query cache on events
   - Updates selected story in drawer if affected

4. **Status Management**
   - Mutation for `updateStatus(storyId, newStatus)`
   - Enforces workflow state machine (validated on backend)
   - Backend prevents invalid transitions (except for admins)

#### Layout Structure
```
┌─ Header (title, live indicator, story count)
├─ Filters (Epic, Status, Type, Search)
├─ Kanban Board
│  ├─ Column: Backlog
│  ├─ Column: Planning
│  ├─ Column: Analysis
│  ├─ Column: Architecture
│  ├─ Column: Design (not in KanbanBoard yet)
│  ├─ Column: Implementation
│  ├─ Column: Review
│  ├─ Column: QA
│  └─ Column: Done
└─ Story Detail Drawer (right panel)
```

---

## 3. DATA MODELS FOR EPICS, STORIES, BUGS, AND SUBTASKS

### Full Data Type Definitions (Frontend)

**File**: `/home/user/AIStudio/frontend/src/types/index.ts`

#### Epic Interface
```typescript
interface Epic {
  id: string;
  key: string;
  projectId: string;
  title: string;
  description?: string;
  priority: number;
  status: EpicStatus;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string };
  _count?: { stories: number; commits: number };
  stories?: Story[];
}
```

#### Story Interface
```typescript
interface Story {
  id: string;
  key: string;
  projectId: string;
  epicId?: string;
  title: string;
  description?: string;
  status: StoryStatus;
  type: StoryType;
  businessComplexity?: number;
  technicalComplexity?: number;
  businessImpact?: number;
  assignedFrameworkId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  project?: { id: string; name: string };
  epic?: { id: string; key: string; title: string };
  assignedFramework?: { id: string; name: string };
  subtasks?: Subtask[];
  _count?: { subtasks: number; commits: number; runs: number };
}
```

#### Subtask Interface
```typescript
interface Subtask {
  id: string;
  storyId: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  layer?: SubtaskLayer;
  component?: string;
  assigneeType?: AssigneeType;
  assignedAgentId?: string;
  createdAt: string;
  updatedAt: string;
  story?: { id: string; key: string; title: string; projectId?: string };
}
```

### DTO (Data Transfer Objects)

```typescript
// Create/Update DTOs for API requests
interface CreateStoryDto {
  projectId: string;
  epicId?: string;
  title: string;
  description?: string;
  type?: StoryType;
  businessComplexity?: number;
  technicalComplexity?: number;
  businessImpact?: number;
}

interface UpdateStoryStatusDto {
  status: StoryStatus;
}

interface FilterStoryDto {
  projectId?: string;
  epicId?: string;
  status?: StoryStatus;
  type?: StoryType;
  assignedFrameworkId?: string;
  search?: string;
  minTechnicalComplexity?: number;
  maxTechnicalComplexity?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
```

### Backend Services

**Stories Service** (`/backend/src/stories/stories.service.ts`):
- Story key generation (e.g., ST-1, ST-2)
- Workflow state machine validation
- Complexity validation before implementation
- Filtering with pagination
- Epic verification before story creation
- Framework assignment

**Epics Service** (`/backend/src/epics/epics.service.ts`):
- Epic key generation (e.g., EP-1, EP-2)
- Filtering by project and status
- Prevent deletion of epics with stories
- Priority-based ordering

**Subtasks Service** (`/backend/src/subtasks/subtasks.service.ts`):
- CRUD operations for subtasks
- Layer and component classification
- Assignee type (agent vs human)
- Status tracking

---

## 4. FILTERING AND SORTING IMPLEMENTATION

### Frontend Filtering

**Component**: `StoryFilters.tsx`

Features:
- **Epic Filter**: Dropdown with all project epics
- **Status Filter**: All 10 story statuses
- **Type Filter**: 5 story types (feature, bug, tech_debt, spike)
- **Search**: Full-text search on title, key, description

**Implementation** (in PlanningView.tsx):
```typescript
const filteredStories = useMemo(() => {
  let filtered = [...stories];
  
  if (selectedEpic !== 'all')
    filtered = filtered.filter(s => s.epicId === selectedEpic);
  
  if (selectedStatus !== 'all')
    filtered = filtered.filter(s => s.status === selectedStatus);
  
  if (selectedType !== 'all')
    filtered = filtered.filter(s => s.type === selectedType);
  
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(s =>
      s.key.toLowerCase().includes(query) ||
      s.title.toLowerCase().includes(query) ||
      s.description?.toLowerCase().includes(query)
    );
  }
  
  return filtered;
}, [stories, selectedEpic, selectedStatus, selectedType, searchQuery]);
```

### Backend Filtering

**Stories Service** uses Prisma's where clause:
```typescript
const where: Prisma.StoryWhereInput = {};
if (projectId) where.projectId = projectId;
if (epicId) where.epicId = epicId;
if (status) where.status = status;
if (type) where.type = type;
if (assignedFrameworkId) where.assignedFrameworkId = assignedFrameworkId;

// Technical complexity range
if (minTechnicalComplexity !== undefined || maxTechnicalComplexity !== undefined) {
  where.technicalComplexity = {};
  if (minTechnicalComplexity !== undefined)
    where.technicalComplexity.gte = minTechnicalComplexity;
  if (maxTechnicalComplexity !== undefined)
    where.technicalComplexity.lte = maxTechnicalComplexity;
}

// Search
if (search) {
  where.OR = [
    { title: { contains: search, mode: 'insensitive' } },
    { description: { contains: search, mode: 'insensitive' } },
  ];
}
```

### Sorting Implementation

**Backend Sorting**:
```typescript
const [sortBy = 'createdAt', sortOrder = 'desc'] = filterDto;

const stories = await this.prisma.story.findMany({
  where,
  orderBy: { [sortBy]: sortOrder },  // Dynamic sorting
  skip: (page - 1) * limit,
  take: limit,
});
```

**Epic Sorting**:
```typescript
const epics = await this.prisma.epic.findMany({
  where,
  orderBy: [
    { priority: 'desc' },        // Primary sort by priority
    { createdAt: 'desc' }        // Secondary sort by creation date
  ],
});
```

**Subtask Sorting**:
```typescript
const subtasks = await this.prisma.subtask.findMany({
  where,
  orderBy: { createdAt: 'asc' }  // Natural order by creation
});
```

---

## 5. DRAG-AND-DROP FUNCTIONALITY

### Library: @dnd-kit

**Package Dependencies**:
```json
"@dnd-kit/core": "^6.3.1",
"@dnd-kit/sortable": "^10.0.0",
"@dnd-kit/utilities": "^3.2.2"
```

### Implementation Architecture

#### KanbanBoard.tsx
**Purpose**: Main drag-and-drop context provider

```typescript
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';

export function KanbanBoard({ stories, onStoryClick, onStatusChange }) {
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // 8px drag distance before activation
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const story = stories.find(s => s.id === event.active.id);
    setActiveStory(story || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const storyId = active.id as string;
    const newStatus = over.id as StoryStatus;

    const story = stories.find(s => s.id === storyId);
    if (story && story.status !== newStatus) {
      onStatusChange(storyId, newStatus);  // Call mutation
    }

    setActiveStory(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}  // Algorithm for drop detection
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(({ status, title }) => (
          <KanbanColumn
            key={status}
            status={status}
            title={title}
            stories={storiesByStatus[status]}
            onStoryClick={onStoryClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeStory ? (
          <div className="rotate-3">  {/* Visual feedback - rotate on drag */}
            <StoryCard story={activeStory} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

#### KanbanColumn.tsx
**Purpose**: Drop zone for each status

```typescript
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

export function KanbanColumn({ status, title, stories, onStoryClick }) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,  // Column ID used in drag-end handler
  });

  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px]">
      {/* Header */}
      <div className="px-4 py-3 rounded-t-lg border-2">
        <h3>{title}</h3>
        <span>{stories.length}</span>
      </div>

      {/* Droppable Zone */}
      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 p-2 rounded-b-lg border-2 min-h-[200px] transition-all',
          isOver && 'ring-2 ring-accent ring-offset-2'  // Visual feedback
        )}
      >
        <SortableContext
          items={stories.map(s => s.id)}
          strategy={verticalListSortingStrategy}  // Vertical drag ordering
        >
          <div className="space-y-2">
            {stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                onClick={onStoryClick}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
```

#### StoryCard.tsx
**Purpose**: Draggable item

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function StoryCard({ story, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: story.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(story)}
      className={clsx(
        'bg-card border border-border rounded-lg shadow-md p-4 mb-2 cursor-pointer',
        'hover:shadow-lg hover:scale-[1.02] transition-all',
        'select-none'
      )}
    >
      {/* Card content */}
    </div>
  );
}
```

### Drag-and-Drop Features

1. **Activation**: 8px pointer movement required to start drag
2. **Collision Detection**: `closestCorners` algorithm finds nearest drop zone
3. **Visual Feedback**: 
   - Active story rotates 3 degrees (rotate-3)
   - Column highlights when hovering over drop zone
   - Card opacity reduces while dragging
   - Hover scale increases on non-dragging cards
4. **Status Update**: Auto-calls `updateStatus` mutation on successful drop
5. **Sorting**: Vertical list sorting strategy within columns

---

## 6. PRIORITY MANAGEMENT

### Priority Fields in Data Models

#### Epic Priority
```typescript
// In Epic model
priority: Int  // 0+ scale, higher = higher priority
```

**Sorting**: Epics sorted by `priority DESC`, then `createdAt DESC`

#### Story Business Impact
```typescript
// In Story model
businessImpact?: number  // Represents priority/importance (1-5 scale typically)
```

**Visual Display**: 
- Star rating: `'★'.repeat(Math.min(businessImpact || 3, 5))`
- Shows as yellow stars on story cards

#### Story Complexity Metrics
```typescript
// In Story model
businessComplexity?: number     // 1-5 scale - business-side complexity
technicalComplexity?: number    // 1-5 scale - technical implementation complexity
```

**Usage**: 
- Displayed in detail drawer
- Used for filtering (min/max technical complexity)
- Required fields for moving to implementation status

### Priority Display

**StoryCard.tsx**:
```typescript
<span className="text-yellow-500 text-sm">
  {priorityStars(story.businessImpact || 3)}
</span>
```

**StoryDetailDrawer.tsx**:
```typescript
<div>
  <label className="block text-sm font-medium text-muted">Priority</label>
  <div className="mt-1 text-yellow-500 text-lg">
    {'★'.repeat(Math.min(story.businessImpact || 3, 5))}
  </div>
</div>
```

### Complexity Assessment

**Displayed in Detail Drawer**:
```typescript
<div className="grid grid-cols-2 gap-4">
  <div className="bg-secondary p-3 rounded-lg">
    <div className="text-sm font-medium text-muted">Business Complexity</div>
    <div className="mt-1 text-2xl font-bold text-accent-dark">
      {story.businessComplexity || 'N/A'}
    </div>
  </div>
  <div className="bg-secondary p-3 rounded-lg">
    <div className="text-sm font-medium text-muted">Technical Complexity</div>
    <div className="mt-1 text-2xl font-bold text-purple-600">
      {story.technicalComplexity || 'N/A'}
    </div>
  </div>
</div>
```

### Workflow Validation with Priority

**Backend Story Service** includes validation:
```typescript
// Require complexity metrics before moving to implementation
private validateComplexityForImplementation(story: any): void {
  if (
    !story.businessComplexity ||
    !story.technicalComplexity ||
    !story.businessImpact
  ) {
    throw new BadRequestException(
      'Story must have businessComplexity, technicalComplexity, and businessImpact ' +
      'before moving to implementation phase'
    );
  }
}
```

---

## 7. REAL-TIME AND STATE MANAGEMENT

### WebSocket Service

**File**: `/home/user/AIStudio/frontend/src/services/websocket.service.ts`

Uses Socket.io client for real-time communication:

```typescript
class WebSocketService {
  private socket: Socket | null = null;
  private connected = false;

  connect(): Socket {
    const token = localStorage.getItem('accessToken');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    return this.socket;
  }

  joinRoom(room: string, userId: string, userName: string): void {
    if (this.socket) {
      this.socket.emit('join-room', { room, userId, userName });
    }
  }

  leaveRoom(room: string): void {
    if (this.socket) {
      this.socket.emit('leave-room', { room });
    }
  }

  emitTyping(entityId: string, entityType: string, userId: string, userName: string): void {
    if (this.socket) {
      this.socket.emit('typing', { entityId, entityType, userId, userName });
    }
  }
}
```

### WebSocket Hooks

**useWebSocket()**: Connection management
```typescript
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = wsService.connect();
    // ... setup event listeners
  }, []);

  return { isConnected, socket: socketRef.current, joinRoom, leaveRoom };
}
```

**useStoryEvents()**: Listen to story events
```typescript
export function useStoryEvents(callbacks: {
  onStoryCreated?: (data: StoryCreatedEvent) => void;
  onStoryUpdated?: (data: StoryUpdatedEvent) => void;
  onStoryStatusChanged?: (data: StoryStatusChangedEvent) => void;
})
```

**useEpicEvents()**: Listen to epic events

**useSubtaskEvents()**: Listen to subtask events

**usePresenceEvents()**: Listen to user presence

### Backend WebSocket Gateway

**File**: `/home/user/AIStudio/backend/src/websocket/websocket.gateway.ts`

Broadcasting methods:
- `broadcastStoryCreated(projectId, story)`
- `broadcastStoryUpdated(storyId, projectId, story)`
- `broadcastStoryStatusChanged(storyId, projectId, eventData)`
- `broadcastEpicCreated(projectId, epic)`
- `broadcastEpicUpdated(epicId, projectId, epic)`
- `broadcastSubtaskCreated(storyId, projectId, subtask)`
- `broadcastSubtaskUpdated(subtaskId, storyId, projectId, subtask)`

### React Query State Management

**File**: `/home/user/AIStudio/frontend/src/services/api.ts`

API clients:
- `storiesApi` - GET/POST/PATCH stories
- `epicsApi` - GET epics
- `subtasksApi` - GET subtasks
- `runsApi` - GET agent execution runs
- `commitsApi` - GET code commits

**Cache Invalidation Pattern**:
```typescript
const updateStatusMutation = useMutation({
  mutationFn: ({ storyId, status }: { storyId: string; status: StoryStatus }) =>
    storiesApi.updateStatus(storyId, { status }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['stories'] });
  },
});
```

---

## 8. KEY FILES AND LOCATIONS

### Frontend
```
/home/user/AIStudio/frontend/src/
├── pages/
│   ├── PlanningView.tsx               # Main Kanban planning board
│   ├── StoryListPage.tsx              # Story list view
│   ├── StoryDetailPage.tsx            # Full story detail page
│   └── DashboardPage.tsx              # Overview dashboard
├── components/
│   ├── KanbanBoard.tsx                # DnD context + column layout
│   ├── KanbanColumn.tsx               # Droppable column
│   ├── StoryCard.tsx                  # Draggable card
│   ├── StoryDetailDrawer.tsx          # Right-side detail panel
│   ├── StoryFilters.tsx               # Filter controls
│   ├── ProjectSelector.tsx            # Project dropdown
│   └── Layout.tsx                     # Main layout
├── services/
│   ├── api.ts                         # API endpoints
│   ├── websocket.service.ts           # WebSocket setup
│   ├── stories.service.ts             # Story API client
│   ├── epics.service.ts               # Epic API client
│   ├── subtasks.service.ts            # Subtask API client
│   └── ... other services
├── types/
│   └── index.ts                       # All TypeScript interfaces
└── App.tsx                            # Router setup
```

### Backend
```
/home/user/AIStudio/backend/src/
├── stories/
│   ├── stories.controller.ts          # REST endpoints
│   ├── stories.service.ts             # Business logic
│   ├── dto/
│   │   ├── create-story.dto.ts
│   │   ├── update-story.dto.ts
│   │   ├── filter-story.dto.ts
│   │   └── update-story-status.dto.ts
│   └── stories.module.ts
├── epics/
│   ├── epics.controller.ts
│   ├── epics.service.ts
│   ├── dto/
│   │   ├── create-epic.dto.ts
│   │   ├── update-epic.dto.ts
│   │   └── filter-epic.dto.ts
│   └── epics.module.ts
├── subtasks/
│   ├── subtasks.controller.ts
│   ├── subtasks.service.ts
│   ├── dto/
│   └── subtasks.module.ts
├── websocket/
│   └── websocket.gateway.ts           # Socket.io gateway
├── prisma/
│   └── schema.prisma                  # Database schema
└── app.module.ts                      # Root module
```

### Database Schema
```
/home/user/AIStudio/backend/prisma/schema.prisma
```

---

## 9. WORKFLOW STATE MACHINE

### Story Status Transitions (Backend Validation)

```typescript
const STORY_WORKFLOW: Record<StoryStatus, StoryStatus[]> = {
  planning: [StoryStatus.analysis],
  analysis: [StoryStatus.planning, StoryStatus.architecture],
  architecture: [StoryStatus.analysis, StoryStatus.design],
  design: [StoryStatus.architecture, StoryStatus.implementation],
  implementation: [StoryStatus.design, StoryStatus.review],
  review: [StoryStatus.implementation, StoryStatus.qa],
  qa: [StoryStatus.review, StoryStatus.done, StoryStatus.implementation],
  done: [],  // Terminal state
  // Note: 'blocked' status not in workflow - can be set directly
};
```

**Validation Logic**:
- Admins can override any transition
- Non-admins must follow workflow
- Implementing phase requires complexity metrics
- Broadcast status change event via WebSocket

---

## 10. KANBAN BOARD COLUMNS

```typescript
const columns: { status: StoryStatus; title: string }[] = [
  { status: 'backlog', title: 'Backlog' },
  { status: 'planning', title: 'Planning' },
  { status: 'analysis', title: 'Analysis' },
  { status: 'architecture', title: 'Architecture' },
  { status: 'implementation', title: 'Implementation' },
  { status: 'review', title: 'Review' },
  { status: 'qa', title: 'QA' },
  { status: 'done', title: 'Done' },
];
```

**Note**: `design` and `blocked` statuses exist in model but not displayed as columns in current board

---

## 11. AUTHENTICATION & AUTHORIZATION

### User Roles
```typescript
enum UserRole {
  admin        # Full access
  pm          # Project management, story creation/deletion
  ba          # Story creation, analysis
  architect   # Epic/architecture decisions
  dev         # Development, story status updates
  qa          # QA status updates
  viewer      # Read-only
}
```

### Endpoint Authorization

**Stories Controller**:
- GET (all roles)
- POST (admin, pm, ba only)
- PATCH (admin, pm, ba only)
- PATCH /status (admin, pm, ba, architect, dev allowed)
- DELETE (admin, pm only)

**Epics Controller**:
- GET (all roles)
- POST (admin, pm, architect only)
- PATCH (admin, pm, architect only)
- DELETE (admin, pm only)

---

## 12. TESTING COVERAGE

**Test Libraries**:
- Vitest (unit/component tests)
- Playwright (e2e tests)

**Frontend Testing**:
- Component tests in `__tests__` directories
- Coverage reports available via `npm run test:coverage`

**Backend Testing**:
- NestJS testing utilities

---

## 13. KEY FEATURES TO NOTE

1. **Real-time Collaboration**: WebSocket-based live updates
2. **Workflow Enforcement**: State machine prevents invalid transitions
3. **Complexity Gating**: Metrics required before implementation
4. **Hierarchical Organization**: Epics → Stories → Subtasks
5. **Multi-layer Subtasks**: Frontend, Backend, Tests, Docs, Infra
6. **Agent Integration**: Stories can be assigned to AI agent frameworks
7. **Defect Tracking**: Bug-specific metadata (origin, discovery stage, severity)
8. **Code Integration**: Commits and runs linked to stories
9. **Test Coverage**: Test cases and executions tracked
10. **Release Management**: Stories linked to releases

---

## Summary Statistics

- **Frontend Source Files**: 35+ TypeScript/React files
- **Backend Services**: 10+ NestJS modules
- **Database Models**: 25+ Prisma models
- **API Endpoints**: 50+ REST endpoints
- **Data Models**: 4 main entities (Epic, Story, Subtask, Defect)
- **UI Components**: 8+ reusable React components
- **Real-time Events**: 10+ WebSocket event types
- **User Roles**: 7 role-based access levels

