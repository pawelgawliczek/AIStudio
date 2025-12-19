/**
 * ST-360: Integration tests for stuck item recovery
 *
 * Tests the mechanism that requeues items stuck in 'sent' state
 * after a timeout, preventing items from being stuck forever.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { UploadQueue } from '../upload-queue';

describe('Stuck Item Recovery', () => {
  let queue: UploadQueue;
  let tempDbPath: string;

  beforeEach(async () => {
    // Create temporary database for testing
    tempDbPath = path.join(os.tmpdir(), `test-queue-${Date.now()}.db`);
    queue = new UploadQueue(tempDbPath, {
      maxItems: 100,
      defaultRetryTimeout: 30,
      maxRetries: 5,
    });
  });

  afterEach(async () => {
    await queue.close();
    // Clean up temporary database
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it('should requeue items stuck in sent state after timeout', async () => {
    // Queue an item
    const item = await queue.enqueue({
      type: 'test_type',
      payload: { data: 'test data' },
    });

    // Mark as sent
    await queue.markSent(item.id);

    // Verify item is in sent state
    let stats = await queue.getStats();
    expect(stats.pending).toBe(0);
    expect(stats.sent).toBe(1);
    expect(stats.acked).toBe(0);

    // Manually update sentAt to simulate timeout
    // Set it to 60 seconds ago (well past the 30-second timeout)
    const oldDate = new Date();
    oldDate.setSeconds(oldDate.getSeconds() - 60);
    await queue.updateSentAt(item.id, oldDate);

    // Trigger requeue of stuck items
    const requeued = await queue.requeueStuckItems({
      timeoutSeconds: 30,
      maxRetries: 5,
    });

    // Verify item was requeued
    expect(requeued).toBe(1);

    // Verify item is back in pending state with incremented retry count
    stats = await queue.getStats();
    expect(stats.pending).toBe(1);
    expect(stats.sent).toBe(0);
    expect(stats.acked).toBe(0);

    const requeuedItem = await queue.getItem(item.id);
    expect(requeuedItem?.status).toBe('pending');
    expect(requeuedItem?.retryCount).toBe(1);
  });

  it('should not requeue items that have not timed out yet', async () => {
    // Queue an item
    const item = await queue.enqueue({
      type: 'test_type',
      payload: { data: 'test data' },
    });

    // Mark as sent (with current timestamp)
    await queue.markSent(item.id);

    // Try to requeue items - should not requeue since it's not timed out
    const requeued = await queue.requeueStuckItems({
      timeoutSeconds: 30,
      maxRetries: 5,
    });

    // Verify no items were requeued
    expect(requeued).toBe(0);

    // Verify item is still in sent state
    const stats = await queue.getStats();
    expect(stats.pending).toBe(0);
    expect(stats.sent).toBe(1);
    expect(stats.acked).toBe(0);
  });

  it('should not requeue items that have reached max retries', async () => {
    // Queue an item
    const item = await queue.enqueue({
      type: 'test_type',
      payload: { data: 'test data' },
    });

    // Mark as sent
    await queue.markSent(item.id);

    // Set retry count to maxRetries - 1 (4, so next retry would be 5)
    for (let i = 0; i < 4; i++) {
      await queue.incrementRetryCount(item.id);
    }

    // Verify retry count is 4
    let itemState = await queue.getItem(item.id);
    expect(itemState?.retryCount).toBe(4);

    // Manually update sentAt to simulate timeout
    const oldDate = new Date();
    oldDate.setSeconds(oldDate.getSeconds() - 60);
    await queue.updateSentAt(item.id, oldDate);

    // Trigger requeue - should not requeue because retry count is at limit
    const requeued = await queue.requeueStuckItems({
      timeoutSeconds: 30,
      maxRetries: 4, // Set max to 4 (item already has 4 retries)
    });

    // Verify no items were requeued
    expect(requeued).toBe(0);

    // Verify item is still in sent state (not requeued)
    const stats = await queue.getStats();
    expect(stats.pending).toBe(0);
    expect(stats.sent).toBe(1);
    expect(stats.acked).toBe(0);
  });

  it('should requeue multiple stuck items in a single call', async () => {
    // Queue multiple items
    const item1 = await queue.enqueue({
      type: 'test_type',
      payload: { data: 'test data 1' },
    });

    const item2 = await queue.enqueue({
      type: 'test_type',
      payload: { data: 'test data 2' },
    });

    const item3 = await queue.enqueue({
      type: 'test_type',
      payload: { data: 'test data 3' },
    });

    // Mark all as sent
    await queue.markSent(item1.id);
    await queue.markSent(item2.id);
    await queue.markSent(item3.id);

    // Set all to timed out
    const oldDate = new Date();
    oldDate.setSeconds(oldDate.getSeconds() - 60);
    await queue.updateSentAt(item1.id, oldDate);
    await queue.updateSentAt(item2.id, oldDate);
    await queue.updateSentAt(item3.id, oldDate);

    // Trigger requeue
    const requeued = await queue.requeueStuckItems({
      timeoutSeconds: 30,
      maxRetries: 5,
    });

    // Verify all items were requeued
    expect(requeued).toBe(3);

    // Verify stats
    const stats = await queue.getStats();
    expect(stats.pending).toBe(3);
    expect(stats.sent).toBe(0);
    expect(stats.acked).toBe(0);
  });

  it('should increment retry count when requeueing', async () => {
    // Queue an item
    const item = await queue.enqueue({
      type: 'test_type',
      payload: { data: 'test data' },
    });

    // Mark as sent
    await queue.markSent(item.id);

    // Initial retry count should be 0
    let itemState = await queue.getItem(item.id);
    expect(itemState?.retryCount).toBe(0);

    // Set to timed out
    const oldDate = new Date();
    oldDate.setSeconds(oldDate.getSeconds() - 60);
    await queue.updateSentAt(item.id, oldDate);

    // First requeue
    await queue.requeueStuckItems({
      timeoutSeconds: 30,
      maxRetries: 5,
    });

    itemState = await queue.getItem(item.id);
    expect(itemState?.retryCount).toBe(1);

    // Mark as sent again and timeout again
    await queue.markSent(item.id);
    await queue.updateSentAt(item.id, oldDate);

    // Second requeue
    await queue.requeueStuckItems({
      timeoutSeconds: 30,
      maxRetries: 5,
    });

    itemState = await queue.getItem(item.id);
    expect(itemState?.retryCount).toBe(2);
  });

  it('should not affect acked items when requeueing', async () => {
    // Queue items in different states
    const item1 = await queue.enqueue({
      type: 'test_type',
      payload: { data: 'stuck item' },
    });

    const item2 = await queue.enqueue({
      type: 'test_type',
      payload: { data: 'acked item' },
    });

    // Mark first as sent (will be stuck)
    await queue.markSent(item1.id);

    // Mark second as sent then acked
    await queue.markSent(item2.id);
    await queue.markAcked(item2.id);

    // Set first item to timed out
    const oldDate = new Date();
    oldDate.setSeconds(oldDate.getSeconds() - 60);
    await queue.updateSentAt(item1.id, oldDate);

    // Trigger requeue
    const requeued = await queue.requeueStuckItems({
      timeoutSeconds: 30,
      maxRetries: 5,
    });

    // Only the stuck item should be requeued
    expect(requeued).toBe(1);

    // Verify acked item is still acked
    const ackedItem = await queue.getItem(item2.id);
    expect(ackedItem?.status).toBe('acked');
  });
});
