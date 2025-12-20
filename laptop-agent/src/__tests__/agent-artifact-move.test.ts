/**
 * ST-363: Laptop Agent Artifact Move Handler Tests
 *
 * Tests the laptop agent's handling of artifact move requests:
 * - Receiving move-request events from backend
 * - Calling ArtifactMover service
 * - Emitting move-complete or move-failed events
 *
 * Test Categories:
 * - Unit: Event handler logic
 * - Integration: ArtifactMover integration
 * - Error Handling: Mover failures, missing dependencies
 * - WebSocket: Event emission patterns
 */

import { ArtifactMover, MoveArtifactResult } from '../artifact-mover';

describe('Agent - Artifact Move Handler (ST-363)', () => {
  let mockSocket: any;
  let mockArtifactMover: jest.Mocked<ArtifactMover>;
  let handleArtifactMoveRequest: (data: any) => Promise<void>;

  beforeEach(() => {
    // Mock socket
    mockSocket = {
      emit: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      off: jest.fn(),
    };

    // Mock ArtifactMover
    mockArtifactMover = {
      moveArtifacts: jest.fn(),
    } as any;

    // Simulate the handler function from agent.ts
    handleArtifactMoveRequest = async (data: {
      requestId: string;
      storyKey: string;
      epicKey: string | null;
      oldPath: string;
      newPath: string;
      timestamp: number;
    }) => {
      if (!mockArtifactMover) {
        mockSocket.emit('artifact:move-failed', {
          requestId: data.requestId,
          storyKey: data.storyKey,
          success: false,
          error: 'ArtifactMover not initialized',
          timestamp: Date.now(),
        });
        return;
      }

      try {
        const result = await mockArtifactMover.moveArtifacts({
          storyKey: data.storyKey,
          epicKey: data.epicKey,
          oldPath: data.oldPath,
          newPath: data.newPath,
        });

        if (result.success) {
          mockSocket.emit('artifact:move-complete', {
            requestId: data.requestId,
            storyKey: data.storyKey,
            success: true,
            newPath: result.newPath,
            timestamp: Date.now(),
          });
        } else {
          mockSocket.emit('artifact:move-failed', {
            requestId: data.requestId,
            storyKey: data.storyKey,
            success: false,
            error: result.error,
            timestamp: Date.now(),
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        mockSocket.emit('artifact:move-failed', {
          requestId: data.requestId,
          storyKey: data.storyKey,
          success: false,
          error: message,
          timestamp: Date.now(),
        });
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Move Handling', () => {
    it('should emit move-complete on successful move to epic', async () => {
      const moveResult: MoveArtifactResult = {
        success: true,
        newPath: 'docs/EP-1/ST-123',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      await handleArtifactMoveRequest({
        requestId: 'req-123',
        storyKey: 'ST-123',
        epicKey: 'EP-1',
        oldPath: 'docs/ST-123',
        newPath: 'docs/EP-1/ST-123',
        timestamp: Date.now(),
      });

      expect(mockArtifactMover.moveArtifacts).toHaveBeenCalledWith({
        storyKey: 'ST-123',
        epicKey: 'EP-1',
        oldPath: 'docs/ST-123',
        newPath: 'docs/EP-1/ST-123',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('artifact:move-complete', {
        requestId: 'req-123',
        storyKey: 'ST-123',
        success: true,
        newPath: 'docs/EP-1/ST-123',
        timestamp: expect.any(Number),
      });
    });

    it('should emit move-complete on successful move to unassigned', async () => {
      const moveResult: MoveArtifactResult = {
        success: true,
        newPath: 'docs/unassigned/ST-456',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      await handleArtifactMoveRequest({
        requestId: 'req-456',
        storyKey: 'ST-456',
        epicKey: null,
        oldPath: 'docs/ST-456',
        newPath: 'docs/unassigned/ST-456',
        timestamp: Date.now(),
      });

      expect(mockArtifactMover.moveArtifacts).toHaveBeenCalledWith({
        storyKey: 'ST-456',
        epicKey: null,
        oldPath: 'docs/ST-456',
        newPath: 'docs/unassigned/ST-456',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('artifact:move-complete', {
        requestId: 'req-456',
        storyKey: 'ST-456',
        success: true,
        newPath: 'docs/unassigned/ST-456',
        timestamp: expect.any(Number),
      });
    });

    it('should include newPath in completion event', async () => {
      const moveResult: MoveArtifactResult = {
        success: true,
        newPath: 'docs/EP-10/ST-789',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      await handleArtifactMoveRequest({
        requestId: 'req-789',
        storyKey: 'ST-789',
        epicKey: 'EP-10',
        oldPath: 'docs/ST-789',
        newPath: 'docs/EP-10/ST-789',
        timestamp: Date.now(),
      });

      const emitCall = mockSocket.emit.mock.calls[0];
      expect(emitCall[0]).toBe('artifact:move-complete');
      expect(emitCall[1].newPath).toBe('docs/EP-10/ST-789');
    });

    it('should preserve requestId in completion event', async () => {
      const moveResult: MoveArtifactResult = {
        success: true,
        newPath: 'docs/EP-2/ST-100',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      const requestId = 'unique-request-id-12345';

      await handleArtifactMoveRequest({
        requestId,
        storyKey: 'ST-100',
        epicKey: 'EP-2',
        oldPath: 'docs/ST-100',
        newPath: 'docs/EP-2/ST-100',
        timestamp: Date.now(),
      });

      const emitCall = mockSocket.emit.mock.calls[0];
      expect(emitCall[1].requestId).toBe(requestId);
    });
  });

  describe('Failed Move Handling', () => {
    it('should emit move-failed when mover returns failure', async () => {
      const moveResult: MoveArtifactResult = {
        success: false,
        error: 'Source directory does not exist',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      await handleArtifactMoveRequest({
        requestId: 'req-fail-1',
        storyKey: 'ST-999',
        epicKey: 'EP-5',
        oldPath: 'docs/ST-999',
        newPath: 'docs/EP-5/ST-999',
        timestamp: Date.now(),
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('artifact:move-failed', {
        requestId: 'req-fail-1',
        storyKey: 'ST-999',
        success: false,
        error: 'Source directory does not exist',
        timestamp: expect.any(Number),
      });
    });

    it('should emit move-failed on validation errors', async () => {
      const moveResult: MoveArtifactResult = {
        success: false,
        error: 'Invalid story key format: ST-ABC',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      await handleArtifactMoveRequest({
        requestId: 'req-fail-2',
        storyKey: 'ST-ABC',
        epicKey: 'EP-1',
        oldPath: 'docs/ST-ABC',
        newPath: 'docs/EP-1/ST-ABC',
        timestamp: Date.now(),
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('artifact:move-failed', {
        requestId: 'req-fail-2',
        storyKey: 'ST-ABC',
        success: false,
        error: expect.stringContaining('Invalid story key format'),
        timestamp: expect.any(Number),
      });
    });

    it('should emit move-failed when target already exists', async () => {
      const moveResult: MoveArtifactResult = {
        success: false,
        error: 'Target directory already exists: docs/EP-3/ST-200',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      await handleArtifactMoveRequest({
        requestId: 'req-fail-3',
        storyKey: 'ST-200',
        epicKey: 'EP-3',
        oldPath: 'docs/ST-200',
        newPath: 'docs/EP-3/ST-200',
        timestamp: Date.now(),
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('artifact:move-failed', {
        requestId: 'req-fail-3',
        storyKey: 'ST-200',
        success: false,
        error: expect.stringContaining('Target directory already exists'),
        timestamp: expect.any(Number),
      });
    });

    it('should include error message in failure event', async () => {
      const moveResult: MoveArtifactResult = {
        success: false,
        error: 'Permission denied',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      await handleArtifactMoveRequest({
        requestId: 'req-fail-4',
        storyKey: 'ST-300',
        epicKey: 'EP-4',
        oldPath: 'docs/ST-300',
        newPath: 'docs/EP-4/ST-300',
        timestamp: Date.now(),
      });

      const emitCall = mockSocket.emit.mock.calls[0];
      expect(emitCall[0]).toBe('artifact:move-failed');
      expect(emitCall[1].error).toBe('Permission denied');
    });
  });

  describe('Exception Handling', () => {
    it('should emit move-failed on mover exception', async () => {
      mockArtifactMover.moveArtifacts.mockRejectedValue(new Error('Filesystem error'));

      await handleArtifactMoveRequest({
        requestId: 'req-exception-1',
        storyKey: 'ST-400',
        epicKey: 'EP-6',
        oldPath: 'docs/ST-400',
        newPath: 'docs/EP-6/ST-400',
        timestamp: Date.now(),
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('artifact:move-failed', {
        requestId: 'req-exception-1',
        storyKey: 'ST-400',
        success: false,
        error: 'Filesystem error',
        timestamp: expect.any(Number),
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockArtifactMover.moveArtifacts.mockRejectedValue('String error');

      await handleArtifactMoveRequest({
        requestId: 'req-exception-2',
        storyKey: 'ST-500',
        epicKey: 'EP-7',
        oldPath: 'docs/ST-500',
        newPath: 'docs/EP-7/ST-500',
        timestamp: Date.now(),
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('artifact:move-failed', {
        requestId: 'req-exception-2',
        storyKey: 'ST-500',
        success: false,
        error: 'String error',
        timestamp: expect.any(Number),
      });
    });

    it('should emit move-failed if ArtifactMover is not initialized', async () => {
      // Simulate missing mover
      mockArtifactMover = null as any;

      await handleArtifactMoveRequest({
        requestId: 'req-no-mover',
        storyKey: 'ST-600',
        epicKey: 'EP-8',
        oldPath: 'docs/ST-600',
        newPath: 'docs/EP-8/ST-600',
        timestamp: Date.now(),
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('artifact:move-failed', {
        requestId: 'req-no-mover',
        storyKey: 'ST-600',
        success: false,
        error: 'ArtifactMover not initialized',
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Request Validation', () => {
    it('should handle requests with all required fields', async () => {
      const moveResult: MoveArtifactResult = {
        success: true,
        newPath: 'docs/EP-9/ST-700',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      const request = {
        requestId: 'req-valid',
        storyKey: 'ST-700',
        epicKey: 'EP-9',
        oldPath: 'docs/ST-700',
        newPath: 'docs/EP-9/ST-700',
        timestamp: Date.now(),
      };

      await handleArtifactMoveRequest(request);

      expect(mockArtifactMover.moveArtifacts).toHaveBeenCalledWith({
        storyKey: request.storyKey,
        epicKey: request.epicKey,
        oldPath: request.oldPath,
        newPath: request.newPath,
      });
    });

    it('should pass epicKey=null correctly to mover', async () => {
      const moveResult: MoveArtifactResult = {
        success: true,
        newPath: 'docs/unassigned/ST-800',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      await handleArtifactMoveRequest({
        requestId: 'req-null-epic',
        storyKey: 'ST-800',
        epicKey: null,
        oldPath: 'docs/ST-800',
        newPath: 'docs/unassigned/ST-800',
        timestamp: Date.now(),
      });

      expect(mockArtifactMover.moveArtifacts).toHaveBeenCalledWith(
        expect.objectContaining({
          epicKey: null,
        })
      );
    });
  });

  describe('Event Emission Patterns', () => {
    it('should emit exactly one event per request (success)', async () => {
      const moveResult: MoveArtifactResult = {
        success: true,
        newPath: 'docs/EP-10/ST-900',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      await handleArtifactMoveRequest({
        requestId: 'req-single-event-1',
        storyKey: 'ST-900',
        epicKey: 'EP-10',
        oldPath: 'docs/ST-900',
        newPath: 'docs/EP-10/ST-900',
        timestamp: Date.now(),
      });

      expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    });

    it('should emit exactly one event per request (failure)', async () => {
      const moveResult: MoveArtifactResult = {
        success: false,
        error: 'Test error',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      await handleArtifactMoveRequest({
        requestId: 'req-single-event-2',
        storyKey: 'ST-1000',
        epicKey: 'EP-11',
        oldPath: 'docs/ST-1000',
        newPath: 'docs/EP-11/ST-1000',
        timestamp: Date.now(),
      });

      expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    });

    it('should emit different events for different request IDs', async () => {
      const moveResult: MoveArtifactResult = {
        success: true,
        newPath: 'docs/EP-12/ST-1100',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      await handleArtifactMoveRequest({
        requestId: 'req-first',
        storyKey: 'ST-1100',
        epicKey: 'EP-12',
        oldPath: 'docs/ST-1100',
        newPath: 'docs/EP-12/ST-1100',
        timestamp: Date.now(),
      });

      await handleArtifactMoveRequest({
        requestId: 'req-second',
        storyKey: 'ST-1200',
        epicKey: 'EP-13',
        oldPath: 'docs/ST-1200',
        newPath: 'docs/EP-13/ST-1200',
        timestamp: Date.now(),
      });

      expect(mockSocket.emit).toHaveBeenCalledTimes(2);

      const firstEmit = mockSocket.emit.mock.calls[0][1];
      const secondEmit = mockSocket.emit.mock.calls[1][1];

      expect(firstEmit.requestId).toBe('req-first');
      expect(secondEmit.requestId).toBe('req-second');
    });

    it('should include timestamp in all emitted events', async () => {
      const moveResult: MoveArtifactResult = {
        success: true,
        newPath: 'docs/EP-14/ST-1300',
      };

      mockArtifactMover.moveArtifacts.mockResolvedValue(moveResult);

      const before = Date.now();

      await handleArtifactMoveRequest({
        requestId: 'req-timestamp',
        storyKey: 'ST-1300',
        epicKey: 'EP-14',
        oldPath: 'docs/ST-1300',
        newPath: 'docs/EP-14/ST-1300',
        timestamp: Date.now(),
      });

      const after = Date.now();

      const emitCall = mockSocket.emit.mock.calls[0][1];
      expect(emitCall.timestamp).toBeGreaterThanOrEqual(before);
      expect(emitCall.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Concurrent Move Handling', () => {
    it('should handle multiple concurrent move requests', async () => {
      const moveResult1: MoveArtifactResult = {
        success: true,
        newPath: 'docs/EP-15/ST-1400',
      };

      const moveResult2: MoveArtifactResult = {
        success: true,
        newPath: 'docs/EP-16/ST-1500',
      };

      mockArtifactMover.moveArtifacts
        .mockResolvedValueOnce(moveResult1)
        .mockResolvedValueOnce(moveResult2);

      await Promise.all([
        handleArtifactMoveRequest({
          requestId: 'req-concurrent-1',
          storyKey: 'ST-1400',
          epicKey: 'EP-15',
          oldPath: 'docs/ST-1400',
          newPath: 'docs/EP-15/ST-1400',
          timestamp: Date.now(),
        }),
        handleArtifactMoveRequest({
          requestId: 'req-concurrent-2',
          storyKey: 'ST-1500',
          epicKey: 'EP-16',
          oldPath: 'docs/ST-1500',
          newPath: 'docs/EP-16/ST-1500',
          timestamp: Date.now(),
        }),
      ]);

      expect(mockSocket.emit).toHaveBeenCalledTimes(2);
      expect(mockArtifactMover.moveArtifacts).toHaveBeenCalledTimes(2);
    });
  });
});
