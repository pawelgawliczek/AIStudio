/**
 * TDD Tests for WebSocket Orchestrator (ST-200)
 *
 * Tests for Docker Runner's WebSocket communication with laptop agent.
 * These tests WILL FAIL until implementation is complete.
 */

import { WebSocketOrchestrator } from '../websocket-orchestrator';
import { io, Socket } from 'socket.io-client';

// Mock socket.io-client
jest.mock('socket.io-client');

describe('WebSocketOrchestrator', () => {
  let orchestrator: WebSocketOrchestrator;
  let mockSocket: Partial<Socket>;

  beforeEach(() => {
    // Mock Socket.IO socket
    mockSocket = {
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn(),
      connected: true,
      disconnect: jest.fn(),
      connect: jest.fn(),
    };

    (io as jest.Mock).mockReturnValue(mockSocket);

    orchestrator = new WebSocketOrchestrator({
      serverUrl: 'https://vibestudio.example.com',
      apiKey: 'test-api-key',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to WebSocket server', async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      const connectPromise = orchestrator.connect();

      // Simulate connection success
      if (onCallback) onCallback();

      await connectPromise;

      expect(io).toHaveBeenCalledWith(
        'https://vibestudio.example.com',
        expect.objectContaining({
          auth: expect.objectContaining({
            apiKey: 'test-api-key',
          }),
        })
      );
    });

    it('should handle connection error', async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect_error'
      )?.[1];

      const connectPromise = orchestrator.connect();

      // Simulate connection error
      if (onCallback) onCallback(new Error('Connection refused'));

      await expect(connectPromise).rejects.toThrow('Connection refused');
    });

    it('should set up event listeners', async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      const connectPromise = orchestrator.connect();
      if (onCallback) onCallback();
      await connectPromise;

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('agent:master_response', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('agent:master_error', expect.any(Function));
    });

    it('should timeout if connection takes too long', async () => {
      const connectPromise = orchestrator.connect({ timeoutMs: 1000 });

      // Don't trigger connect event - let it timeout
      await expect(connectPromise).rejects.toThrow('Connection timeout');
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      const connectPromise = orchestrator.connect();
      if (onCallback) onCallback();
      await connectPromise;
    });

    it('should disconnect from WebSocket server', async () => {
      await orchestrator.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should clean up event listeners', async () => {
      await orchestrator.disconnect();

      expect(mockSocket.off).toHaveBeenCalled();
    });
  });

  describe('startMasterSession', () => {
    beforeEach(async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      const connectPromise = orchestrator.connect();
      if (onCallback) onCallback();
      await connectPromise;
    });

    it('should emit master:start event with config', async () => {
      const config = {
        workflowRunId: 'run-123',
        projectPath: '/Users/test/projects/TestProject',
        model: 'claude-sonnet-4',
        jobToken: 'test-token-123',
      };

      await orchestrator.startMasterSession(config);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'agent:master_start',
        expect.objectContaining({
          workflowRunId: 'run-123',
          projectPath: '/Users/test/projects/TestProject',
          model: 'claude-sonnet-4',
          jobToken: 'test-token-123',
        })
      );
    });

    it('should wait for agent:master_started response', async () => {
      const responseCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'agent:master_started'
      )?.[1];

      const sessionPromise = orchestrator.startMasterSession({
        workflowRunId: 'run-123',
        projectPath: '/path',
        model: 'claude-sonnet-4',
        jobToken: 'token',
      });

      // Simulate success response
      if (responseCallback) {
        responseCallback({
          success: true,
          sessionId: 'session-abc',
          transcriptPath: '/path/to/transcript.jsonl',
          pid: 12345,
        });
      }

      const result = await sessionPromise;

      expect(result.sessionId).toBe('session-abc');
      expect(result.transcriptPath).toBe('/path/to/transcript.jsonl');
    });

    it('should handle master session start failure', async () => {
      const responseCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'agent:master_error'
      )?.[1];

      const sessionPromise = orchestrator.startMasterSession({
        workflowRunId: 'run-123',
        projectPath: '/path',
        model: 'claude-sonnet-4',
        jobToken: 'token',
      });

      // Simulate error response
      if (responseCallback) {
        responseCallback({
          error: 'Failed to spawn Claude CLI',
          workflowRunId: 'run-123',
        });
      }

      await expect(sessionPromise).rejects.toThrow('Failed to spawn Claude CLI');
    });

    it('should timeout if no response received', async () => {
      const sessionPromise = orchestrator.startMasterSession(
        {
          workflowRunId: 'run-123',
          projectPath: '/path',
          model: 'claude-sonnet-4',
          jobToken: 'token',
        },
        { timeoutMs: 1000 }
      );

      await expect(sessionPromise).rejects.toThrow('timeout');
    });
  });

  describe('sendCommand', () => {
    beforeEach(async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      const connectPromise = orchestrator.connect();
      if (onCallback) onCallback();
      await connectPromise;
    });

    it('should emit master:command event', async () => {
      const command = {
        workflowRunId: 'run-123',
        command: 'Use Task tool to spawn Architect agent',
        nonce: 'nonce-abc',
      };

      await orchestrator.sendCommand(command);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'agent:master_command',
        expect.objectContaining({
          workflowRunId: 'run-123',
          command: expect.stringContaining('Use Task tool'),
          nonce: 'nonce-abc',
        })
      );
    });

    it('should wait for agent:master_response', async () => {
      const responseCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'agent:master_response'
      )?.[1];

      const commandPromise = orchestrator.sendCommand({
        workflowRunId: 'run-123',
        command: 'test command',
        nonce: 'nonce-123',
      });

      // Simulate response
      if (responseCallback) {
        responseCallback({
          workflowRunId: 'run-123',
          output: 'Command executed successfully',
          nonce: 'nonce-123',
        });
      }

      const result = await commandPromise;

      expect(result.output).toContain('Command executed successfully');
      expect(result.nonce).toBe('nonce-123');
    });

    it('should handle command execution error', async () => {
      const errorCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'agent:master_error'
      )?.[1];

      const commandPromise = orchestrator.sendCommand({
        workflowRunId: 'run-123',
        command: 'test',
        nonce: 'nonce-123',
      });

      // Simulate error
      if (errorCallback) {
        errorCallback({
          workflowRunId: 'run-123',
          error: 'Master session crashed',
        });
      }

      await expect(commandPromise).rejects.toThrow('Master session crashed');
    });

    it('should timeout if no response within limit', async () => {
      const commandPromise = orchestrator.sendCommand(
        {
          workflowRunId: 'run-123',
          command: 'test',
          nonce: 'nonce-123',
        },
        { timeoutMs: 1000 }
      );

      await expect(commandPromise).rejects.toThrow('timeout');
    });

    it('should handle multiple concurrent commands', async () => {
      const responseCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'agent:master_response'
      )?.[1];

      const command1 = orchestrator.sendCommand({
        workflowRunId: 'run-123',
        command: 'command 1',
        nonce: 'nonce-1',
      });

      const command2 = orchestrator.sendCommand({
        workflowRunId: 'run-123',
        command: 'command 2',
        nonce: 'nonce-2',
      });

      // Simulate responses in order
      if (responseCallback) {
        responseCallback({ workflowRunId: 'run-123', output: 'result 1', nonce: 'nonce-1' });
        responseCallback({ workflowRunId: 'run-123', output: 'result 2', nonce: 'nonce-2' });
      }

      const [result1, result2] = await Promise.all([command1, command2]);

      expect(result1.output).toBe('result 1');
      expect(result2.output).toBe('result 2');
    });
  });

  describe('stopMasterSession', () => {
    beforeEach(async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      const connectPromise = orchestrator.connect();
      if (onCallback) onCallback();
      await connectPromise;
    });

    it('should emit master:stop event', async () => {
      await orchestrator.stopMasterSession('run-123');

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'agent:master_stop',
        expect.objectContaining({
          workflowRunId: 'run-123',
        })
      );
    });

    it('should wait for confirmation', async () => {
      const responseCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'agent:master_stopped'
      )?.[1];

      const stopPromise = orchestrator.stopMasterSession('run-123');

      // Simulate confirmation
      if (responseCallback) {
        responseCallback({
          workflowRunId: 'run-123',
          exitCode: 0,
        });
      }

      await stopPromise;

      expect(mockSocket.emit).toHaveBeenCalled();
    });

    it('should handle graceful timeout', async () => {
      const stopPromise = orchestrator.stopMasterSession('run-123', {
        timeoutMs: 1000,
        forceKill: false,
      });

      // Don't send confirmation - let it timeout
      await expect(stopPromise).rejects.toThrow('Graceful shutdown timeout');
    });

    it('should force kill on timeout if requested', async () => {
      const stopPromise = orchestrator.stopMasterSession('run-123', {
        timeoutMs: 1000,
        forceKill: true,
      });

      // Wait for timeout
      await stopPromise;

      // Should emit force kill command
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'agent:master_kill',
        expect.objectContaining({
          workflowRunId: 'run-123',
          signal: 'SIGKILL',
        })
      );
    });
  });

  describe('Auto-Reconnect', () => {
    beforeEach(async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      const connectPromise = orchestrator.connect();
      if (onCallback) onCallback();
      await connectPromise;
    });

    it('should attempt to reconnect on disconnect', async () => {
      const disconnectCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      // Simulate disconnect
      if (disconnectCallback) {
        disconnectCallback('transport close');
      }

      // Should attempt reconnect
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should use exponential backoff for reconnect attempts', async () => {
      jest.useFakeTimers();

      const disconnectCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      // First disconnect
      if (disconnectCallback) disconnectCallback('transport close');

      expect(mockSocket.connect).toHaveBeenCalledTimes(1);

      // Second disconnect (after reconnect fails)
      if (disconnectCallback) disconnectCallback('transport close');

      // Should wait longer before next attempt
      jest.advanceTimersByTime(2000); // Exponential backoff

      expect(mockSocket.connect).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should limit maximum reconnect attempts', async () => {
      const disconnectCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      // Simulate 10 failed reconnect attempts
      for (let i = 0; i < 10; i++) {
        if (disconnectCallback) disconnectCallback('transport close');
      }

      // Should give up after max attempts
      expect(orchestrator.getConnectionState()).toBe('failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection loss during command', async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      const connectPromise = orchestrator.connect();
      if (onCallback) onCallback();
      await connectPromise;

      const disconnectCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      const commandPromise = orchestrator.sendCommand({
        workflowRunId: 'run-123',
        command: 'test',
        nonce: 'nonce-123',
      });

      // Simulate disconnect during command
      if (disconnectCallback) {
        disconnectCallback('transport error');
      }

      await expect(commandPromise).rejects.toThrow('Connection lost');
    });

    it('should throw if sending command while disconnected', async () => {
      mockSocket.connected = false;

      await expect(
        orchestrator.sendCommand({
          workflowRunId: 'run-123',
          command: 'test',
          nonce: 'nonce-123',
        })
      ).rejects.toThrow('Not connected');
    });

    it('should handle malformed responses gracefully', async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      const connectPromise = orchestrator.connect();
      if (onCallback) onCallback();
      await connectPromise;

      const responseCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'agent:master_response'
      )?.[1];

      const commandPromise = orchestrator.sendCommand({
        workflowRunId: 'run-123',
        command: 'test',
        nonce: 'nonce-123',
      });

      // Simulate malformed response
      if (responseCallback) {
        responseCallback({ invalid: 'response' });
      }

      await expect(commandPromise).rejects.toThrow('Invalid response format');
    });
  });

  describe('State Management', () => {
    it('should track connection state', () => {
      expect(orchestrator.getConnectionState()).toBe('disconnected');
    });

    it('should update state on connect', async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      const connectPromise = orchestrator.connect();
      if (onCallback) onCallback();
      await connectPromise;

      expect(orchestrator.getConnectionState()).toBe('connected');
    });

    it('should update state on disconnect', async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      const connectPromise = orchestrator.connect();
      if (onCallback) onCallback();
      await connectPromise;

      const disconnectCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      if (disconnectCallback) {
        disconnectCallback('transport close');
      }

      expect(orchestrator.getConnectionState()).toBe('reconnecting');
    });

    it('should track active sessions', async () => {
      const onCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];
      const connectPromise = orchestrator.connect();
      if (onCallback) onCallback();
      await connectPromise;

      const startCallback = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'agent:master_started'
      )?.[1];

      const sessionPromise = orchestrator.startMasterSession({
        workflowRunId: 'run-123',
        projectPath: '/path',
        model: 'claude-sonnet-4',
        jobToken: 'token',
      });

      if (startCallback) {
        startCallback({
          success: true,
          sessionId: 'session-abc',
          transcriptPath: '/path/transcript.jsonl',
        });
      }

      await sessionPromise;

      const activeSessions = orchestrator.getActiveSessions();
      expect(activeSessions).toContain('run-123');
    });
  });
});
