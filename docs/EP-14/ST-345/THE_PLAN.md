# THE_PLAN - ST-345: Add retry timeout for stuck sent items

## Story Context
Add automatic retry for items stuck in "sent" state without ACK.

**Key Requirements:**
1. After 30s without ACK, re-queue item (mark as pending, increment retryCount) ✅ IMPLEMENTED
2. On manual reconnect, flush all pending AND sent items ❌ NEEDS IMPLEMENTATION
3. Max retry count of 5, then move to "failed" status ❌ NEEDS IMPLEMENTATION

## Architecture Analysis

### Current Implementation (ST-360)
- **UploadQueue.requeueStuckItems()** - Requeues items in 'sent' state after timeout ✅
- **UploadQueue.markFailed()** - Marks items as failed with error message ✅
- **UploadManager.startStuckItemMonitor()** - Runs every 30s to requeue stuck items ✅

### Gaps Identified

#### 1. Reconnect Handler - Not Flushing Sent Items
**Current Behavior:**
```typescript
this.socket.on('connect', () => {
  this.flush(); // Only flushes pending items
});
```

**Required Behavior:**
```typescript
this.socket.on('connect', () => {
  this.requeueSentItems(); // Requeue all sent items
  this.flush(); // Then flush all pending
});
```

#### 2. Stuck Item Monitor - Not Marking as Failed After Max Retries
**Current Behavior:**
```typescript
startStuckItemMonitor() {
  const requeued = await queue.requeueStuckItems({
    timeoutSeconds: 30,
    maxRetries: 5,
  });
}
```

The `requeueStuckItems` method correctly skips items that have reached max retries, but it doesn't mark them as failed.

**Required Behavior:**
After requeueing, check for items with `retryCount >= maxRetries` and `status = 'sent'`, then mark them as failed.

## Implementation Plan

### 1. Add getSentItems() to UploadQueue
```typescript
async getSentItems(options?: GetSentItemsOptions): Promise<QueueItem[]> {
  // SELECT * FROM upload_queue WHERE status = 'sent' ORDER BY createdAt
}
```

### 2. Add requeueAllSentItems() to UploadQueue
```typescript
async requeueAllSentItems(): Promise<number> {
  // UPDATE upload_queue SET status = 'pending', retryCount = retryCount + 1
  // WHERE status = 'sent'
}
```

### 3. Update UploadManager.setupSocketHandlers()
```typescript
this.socket.on('connect', () => {
  this.logger.info('Socket connected, requeueing sent items and flushing');
  this.isConnected = true;

  // Requeue all sent items (they didn't get ACKed before disconnect)
  this.queue.requeueAllSentItems()
    .then(count => {
      if (count > 0) {
        this.logger.info('Requeued sent items on reconnect', { count });
      }
      // Then flush all pending items
      return this.flush();
    })
    .catch(error => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Reconnect handling failed', { error: message });
    });
});
```

### 4. Update UploadManager.startStuckItemMonitor()
```typescript
private startStuckItemMonitor(): void {
  this.stuckItemTimer = setInterval(async () => {
    try {
      const stats = await this.queue.getStats();
      if (stats.sent > 0) {
        // Requeue items that haven't timed out yet
        const requeued = await this.queue.requeueStuckItems({
          timeoutSeconds: 30,
          maxRetries: 5,
        });

        if (requeued > 0) {
          this.logger.warn('Requeued stuck items', {
            count: requeued,
            previousSentCount: stats.sent,
          });
        }

        // Mark items that have exceeded max retries as failed
        const failedItems = await this.queue.getSentItems();
        for (const item of failedItems) {
          if (item.retryCount >= 5) {
            await this.queue.markFailed(item.id, 'Max retries exceeded');
            this.logger.error('Item marked as failed after max retries', {
              id: item.id,
              type: item.type,
              retryCount: item.retryCount,
            });
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Stuck item monitor failed', { error: message });
    }
  }, 30000);
}
```

## Files to Modify

### /Users/pawelgawliczek/projects/AIStudio/laptop-agent/src/upload-queue.ts
- Add `getSentItems()` method
- Add `requeueAllSentItems()` method
- Update types in `types/upload-queue.types.ts`

### /Users/pawelgawliczek/projects/AIStudio/laptop-agent/src/upload-manager.ts
- Update `setupSocketHandlers()` to requeue sent items on reconnect
- Update `startStuckItemMonitor()` to mark failed items after max retries

## Test Requirements

### Tests Already Passing ✅
- `/Users/pawelgawliczek/projects/AIStudio/laptop-agent/src/__tests__/stuck-item-recovery.test.ts` (ST-360)
- `/Users/pawelgawliczek/projects/AIStudio/laptop-agent/src/__tests__/upload-queue.test.ts` (retry handling tests)

### New Tests Needed
1. Test reconnect handler requeues sent items
2. Test items marked as failed after max retries
3. Test failed items not retried again

## Acceptance Criteria
- [x] Items don't stay stuck in "sent" forever (via stuck item monitor)
- [x] Reconnect triggers flush of all pending/sent
- [x] Failed items tracked separately after max retries

## Implementation Complete

All requirements have been successfully implemented and tested. See AGENT_PROGRESS.md for detailed results.

## Technical Notes
- Keep existing 30-second timeout behavior
- Max retries = 5 (configurable via QueueConfig)
- Use existing `markFailed()` method
- Maintain backward compatibility with ST-360 implementation
