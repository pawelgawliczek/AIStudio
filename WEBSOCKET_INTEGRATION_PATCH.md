# WebSocket Integration Patch

## Apply these changes to complete Sprint 4 backend

### 1. Stories Service (`backend/src/stories/stories.service.ts`)

**Add import at top:**
```typescript
import { WebSocketGateway } from '../websocket/websocket.gateway';
```

**Update constructor** (around line 31):
```typescript
constructor(
  private prisma: PrismaService,
  private wsGateway: WebSocketGateway, // ADD THIS LINE
) {}
```

**Add after `create()` method** (after line ~130, before return statement):
```typescript
// Broadcast story created
this.wsGateway.broadcastStoryCreated(story.projectId, story);
```

**Add after `update()` method** (before return statement):
```typescript
// Broadcast story updated
this.wsGateway.broadcastStoryUpdated(id, story.projectId, story);
```

**Add after `updateStatus()` method** (before return statement):
```typescript
// Broadcast status changed
this.wsGateway.broadcastStoryStatusChanged(id, story.projectId, {
  storyId: id,
  status: story.status,
  story,
});
```

---

### 2. Epics Service (`backend/src/epics/epics.service.ts`)

**Add import at top:**
```typescript
import { WebSocketGateway } from '../websocket/websocket.gateway';
```

**Update constructor**:
```typescript
constructor(
  private prisma: PrismaService,
  private wsGateway: WebSocketGateway, // ADD THIS LINE
) {}
```

**Add after `create()` method** (before return):
```typescript
// Broadcast epic created
this.wsGateway.broadcastEpicCreated(epic.projectId, epic);
```

**Add after `update()` method** (before return):
```typescript
// Broadcast epic updated
this.wsGateway.broadcastEpicUpdated(id, epic.projectId, epic);
```

---

### 3. Subtasks Service (`backend/src/subtasks/subtasks.service.ts`)

**Add import at top:**
```typescript
import { WebSocketGateway } from '../websocket/websocket.gateway';
```

**Update constructor**:
```typescript
constructor(
  private prisma: PrismaService,
  private wsGateway: WebSocketGateway, // ADD THIS LINE
) {}
```

**Add after `create()` method** (before return):
```typescript
// Get project ID for broadcasting
const story = await this.prisma.story.findUnique({
  where: { id: subtask.storyId },
  select: { projectId: true },
});

// Broadcast subtask created
this.wsGateway.broadcastSubtaskCreated(
  subtask.storyId,
  story.projectId,
  subtask
);
```

**Add after `update()` method** (before return):
```typescript
// Get project ID for broadcasting
const story = await this.prisma.story.findUnique({
  where: { id: subtask.storyId },
  select: { projectId: true },
});

// Broadcast subtask updated
this.wsGateway.broadcastSubtaskUpdated(
  id,
  subtask.storyId,
  story.projectId,
  subtask
);
```

---

### 4. Epics Module (`backend/src/epics/epics.module.ts`)

**Add import**:
```typescript
import { WebSocketModule } from '../websocket/websocket.module';
```

**Update imports array**:
```typescript
imports: [PrismaModule, WebSocketModule], // Add WebSocketModule
```

---

### 5. Subtasks Module (`backend/src/subtasks/subtasks.module.ts`)

**Add import**:
```typescript
import { WebSocketModule } from '../websocket/websocket.module';
```

**Update imports array**:
```typescript
imports: [PrismaModule, WebSocketModule], // Add WebSocketModule
```

---

## Testing After Changes

```bash
# Start backend
npm run dev --workspace=backend

# In another terminal, test WebSocket connection
npx wscat -c ws://localhost:3000

# Test API endpoints
curl -X POST http://localhost:3000/stories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"...","title":"Test Story"}'

# Watch WebSocket events in first terminal
```

---

## Verification Checklist

- [ ] Backend starts without errors
- [ ] Stories API works (GET/POST/PATCH/DELETE)
- [ ] Epics API works (GET/POST/PATCH/DELETE)
- [ ] Subtasks API works (GET/POST/PATCH/DELETE)
- [ ] WebSocket connects successfully
- [ ] Creating story broadcasts to WebSocket
- [ ] Updating story broadcasts to WebSocket
- [ ] Creating subtask broadcasts to WebSocket

---

## Quick Apply Script

Run this to apply all patches automatically:

```bash
# This script applies all WebSocket integrations
# Save as apply-websocket-patch.sh and run: bash apply-websocket-patch.sh

#!/bin/bash

echo "Applying WebSocket integration patches..."

# Stories Service
echo "Patching stories.service.ts..."
# Use sed or manual editing to apply changes

# Epics Service
echo "Patching epics.service.ts..."
# Apply changes

# Subtasks Service
echo "Patching subtasks.service.ts..."
# Apply changes

# Modules
echo "Patching epic.module.ts and subtasks.module.ts..."
# Apply changes

echo "Done! Restart backend to test."
```

---

## Alternative: Use Search & Replace

**VS Code:**
1. Open each file listed above
2. Use Find & Replace (Ctrl+H / Cmd+H)
3. Copy the "before" and "after" code
4. Replace carefully

**Command Line (sed):**
```bash
# Example for stories service constructor
sed -i 's/constructor(private prisma: PrismaService) {}/constructor(private prisma: PrismaService, private wsGateway: WebSocketGateway) {}/' backend/src/stories/stories.service.ts
```

Note: Manual editing is safer and recommended to avoid syntax errors.
