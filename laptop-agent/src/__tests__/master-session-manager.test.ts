/**
 * TDD Tests for MasterSessionManager (ST-200)
 *
 * Tests for persistent Master Session management on laptop agent.
 * These tests WILL FAIL until implementation is complete.
 */

import { ChildProcess } from 'child_process';
import { MasterSessionManager } from '../master-session-manager';

// Mock child_process
jest.mock('child_process');

describe('MasterSessionManager', () => {
  let manager: MasterSessionManager;
  let mockProcess: Partial<ChildProcess>;

  beforeEach(() => {
    manager = new MasterSessionManager();

    // Mock ChildProcess
    mockProcess = {
      stdin: {
        write: jest.fn(),
      } as any,
      stdout: {
        on: jest.fn(),
        removeListener: jest.fn(),
      } as any,
      stderr: {
        on: jest.fn(),
        removeListener: jest.fn(),
      } as any,
      on: jest.fn(),
      kill: jest.fn(),
      pid: 12345,
    };

    // Mock spawn to return mockProcess
    const spawn = require('child_process').spawn as jest.Mock;
    spawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startSession', () => {
    const validConfig = {
      workflowRunId: 'run-123',
      projectPath: '/Users/test/projects/TestProject',
      model: 'claude-sonnet-4',
    };

    it('should spawn Claude CLI with correct flags', async () => {
      const { spawn } = require('child_process');

      await manager.startSession(validConfig);

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '--session-id', expect.any(String),
          '--output-format', 'stream-json',
          '--model', 'claude-sonnet-4',
          '--verbose',
        ]),
        expect.objectContaining({
          cwd: '/Users/test/projects/TestProject',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });

    it('should generate unique session ID', async () => {
      const result1 = await manager.startSession(validConfig);
      const result2 = await manager.startSession({
        ...validConfig,
        workflowRunId: 'run-456',
      });

      expect(result1.sessionId).toBeDefined();
      expect(result2.sessionId).toBeDefined();
      expect(result1.sessionId).not.toBe(result2.sessionId);
    });

    it('should track session in internal map', async () => {
      await manager.startSession(validConfig);

      const session = manager.getSession(validConfig.workflowRunId);
      expect(session).toBeDefined();
      expect(session?.workflowRunId).toBe('run-123');
      expect(session?.sessionId).toBeDefined();
    });

    it('should extract transcript path from stdout', async () => {
      // Mock stdout to emit transcript path
      const stdoutCallback = (mockProcess.stdout!.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )?.[1];

      const result = await manager.startSession(validConfig);

      // Simulate Claude Code emitting transcript path
      if (stdoutCallback) {
        stdoutCallback(Buffer.from('Transcript: /path/to/transcript.jsonl\n'));
      }

      // Should have captured transcript path
      const session = manager.getSession(validConfig.workflowRunId);
      expect(session?.transcriptPath).toBeDefined();
    });

    it('should reject if session already exists for workflow run', async () => {
      await manager.startSession(validConfig);

      await expect(manager.startSession(validConfig)).rejects.toThrow(
        'Session already exists for workflow run: run-123'
      );
    });

    it('should handle spawn error', async () => {
      const { spawn } = require('child_process');
      spawn.mockImplementationOnce(() => {
        const proc = { ...mockProcess };
        setImmediate(() => {
          (proc.on as jest.Mock).mock.calls.find(
            call => call[0] === 'error'
          )?.[1](new Error('spawn ENOENT'));
        });
        return proc;
      });

      await expect(manager.startSession(validConfig)).rejects.toThrow('spawn ENOENT');
    });

    it('should return session metadata', async () => {
      const result = await manager.startSession(validConfig);

      expect(result).toMatchObject({
        sessionId: expect.any(String),
        transcriptPath: expect.any(String),
        workflowRunId: 'run-123',
        pid: 12345,
      });
    });
  });

  describe('sendCommand', () => {
    const validConfig = {
      workflowRunId: 'run-123',
      projectPath: '/Users/test/projects/TestProject',
      model: 'claude-sonnet-4',
    };

    beforeEach(async () => {
      await manager.startSession(validConfig);
    });

    it('should write command to stdin', async () => {
      const command = 'Use the Task tool to analyze the codebase';

      await manager.sendCommand('run-123', command);

      expect(mockProcess.stdin!.write).toHaveBeenCalledWith(
        expect.stringContaining(command)
      );
    });

    it('should append newline to command', async () => {
      await manager.sendCommand('run-123', 'test command');

      expect(mockProcess.stdin!.write).toHaveBeenCalledWith(
        expect.stringMatching(/\n$/)
      );
    });

    it('should wait for response from stdout', async () => {
      const stdoutCallback = (mockProcess.stdout!.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )?.[1];

      const commandPromise = manager.sendCommand('run-123', 'test');

      // Simulate response
      if (stdoutCallback) {
        stdoutCallback(Buffer.from('Response text here\n'));
      }

      const result = await commandPromise;
      expect(result.output).toContain('Response text here');
    });

    it('should throw if session not found', async () => {
      await expect(
        manager.sendCommand('non-existent-run', 'command')
      ).rejects.toThrow('Session not found for workflow run: non-existent-run');
    });

    it('should timeout if no response received', async () => {
      const commandPromise = manager.sendCommand('run-123', 'test', {
        timeoutMs: 1000,
      });

      await expect(commandPromise).rejects.toThrow('Command timeout after 1000ms');
    });

    it('should include nonce in command', async () => {
      await manager.sendCommand('run-123', 'test command');

      expect(mockProcess.stdin!.write).toHaveBeenCalledWith(
        expect.stringMatching(/\[NONCE:[0-9a-f-]{36}\]/)
      );
    });

    it('should validate nonce in response', async () => {
      const stdoutCallback = (mockProcess.stdout!.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )?.[1];

      const commandPromise = manager.sendCommand('run-123', 'test');

      // Simulate response with WRONG nonce
      if (stdoutCallback) {
        stdoutCallback(Buffer.from('Response [NONCE:wrong-nonce-here]\n'));
      }

      await expect(commandPromise).rejects.toThrow('Response nonce mismatch');
    });

    it('should handle multi-chunk responses', async () => {
      const stdoutCallback = (mockProcess.stdout!.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )?.[1];

      const commandPromise = manager.sendCommand('run-123', 'test');

      // Simulate response in multiple chunks
      if (stdoutCallback) {
        stdoutCallback(Buffer.from('Part 1 '));
        stdoutCallback(Buffer.from('Part 2 '));
        stdoutCallback(Buffer.from('[NONCE:valid-nonce]\n'));
      }

      const result = await commandPromise;
      expect(result.output).toContain('Part 1 Part 2');
    });
  });

  describe('resumeSession', () => {
    it('should spawn Claude CLI with --resume flag', async () => {
      const { spawn } = require('child_process');

      await manager.resumeSession({
        workflowRunId: 'run-123',
        sessionId: 'existing-session-id',
        projectPath: '/Users/test/projects/TestProject',
        model: 'claude-sonnet-4',
      });

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '--resume', 'existing-session-id',
          '--model', 'claude-sonnet-4',
        ]),
        expect.any(Object)
      );
    });

    it('should restore session to internal map', async () => {
      await manager.resumeSession({
        workflowRunId: 'run-123',
        sessionId: 'existing-session-id',
        projectPath: '/Users/test/projects/TestProject',
        model: 'claude-sonnet-4',
      });

      const session = manager.getSession('run-123');
      expect(session?.sessionId).toBe('existing-session-id');
    });

    it('should reject if session already exists for workflow run', async () => {
      await manager.startSession({
        workflowRunId: 'run-123',
        projectPath: '/Users/test/projects/TestProject',
        model: 'claude-sonnet-4',
      });

      await expect(
        manager.resumeSession({
          workflowRunId: 'run-123',
          sessionId: 'different-session',
          projectPath: '/Users/test/projects/TestProject',
          model: 'claude-sonnet-4',
        })
      ).rejects.toThrow('Session already exists');
    });
  });

  describe('stopSession', () => {
    beforeEach(async () => {
      await manager.startSession({
        workflowRunId: 'run-123',
        projectPath: '/Users/test/projects/TestProject',
        model: 'claude-sonnet-4',
      });
    });

    it('should send SIGTERM to process', async () => {
      await manager.stopSession('run-123');

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should remove session from internal map', async () => {
      await manager.stopSession('run-123');

      const session = manager.getSession('run-123');
      expect(session).toBeUndefined();
    });

    it('should wait for graceful shutdown', async () => {
      jest.useFakeTimers();

      const stopPromise = manager.stopSession('run-123');

      // Simulate process exit event
      const exitCallback = (mockProcess.on as jest.Mock).mock.calls.find(
        call => call[0] === 'exit'
      )?.[1];
      if (exitCallback) {
        exitCallback(0, null);
      }

      await stopPromise;

      jest.useRealTimers();
    });

    it('should force kill if graceful shutdown times out', async () => {
      jest.useFakeTimers();

      const stopPromise = manager.stopSession('run-123', { timeoutMs: 5000 });

      // Don't emit exit event - let it timeout
      jest.advanceTimersByTime(6000);

      await stopPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');

      jest.useRealTimers();
    });

    it('should not throw if session not found', async () => {
      await expect(manager.stopSession('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('should return empty array initially', () => {
      const sessions = manager.listSessions();
      expect(sessions).toEqual([]);
    });

    it('should return all active sessions', async () => {
      await manager.startSession({
        workflowRunId: 'run-1',
        projectPath: '/path/1',
        model: 'claude-sonnet-4',
      });
      await manager.startSession({
        workflowRunId: 'run-2',
        projectPath: '/path/2',
        model: 'claude-sonnet-4',
      });

      const sessions = manager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.workflowRunId)).toEqual(['run-1', 'run-2']);
    });
  });

  describe('getSession', () => {
    it('should return undefined for non-existent session', () => {
      const session = manager.getSession('non-existent');
      expect(session).toBeUndefined();
    });

    it('should return session metadata', async () => {
      await manager.startSession({
        workflowRunId: 'run-123',
        projectPath: '/path/test',
        model: 'claude-sonnet-4',
      });

      const session = manager.getSession('run-123');

      expect(session).toMatchObject({
        workflowRunId: 'run-123',
        sessionId: expect.any(String),
        transcriptPath: expect.any(String),
        pid: 12345,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle process crash during command execution', async () => {
      await manager.startSession({
        workflowRunId: 'run-123',
        projectPath: '/path/test',
        model: 'claude-sonnet-4',
      });

      const commandPromise = manager.sendCommand('run-123', 'test');

      // Simulate process crash
      const exitCallback = (mockProcess.on as jest.Mock).mock.calls.find(
        call => call[0] === 'exit'
      )?.[1];
      if (exitCallback) {
        exitCallback(1, 'SIGSEGV');
      }

      await expect(commandPromise).rejects.toThrow('Process crashed');
    });

    it('should handle stderr output', async () => {
      await manager.startSession({
        workflowRunId: 'run-123',
        projectPath: '/path/test',
        model: 'claude-sonnet-4',
      });

      const stderrCallback = (mockProcess.stderr!.on as jest.Mock).mock.calls.find(
        call => call[0] === 'data'
      )?.[1];

      // Simulate error output
      if (stderrCallback) {
        stderrCallback(Buffer.from('ERROR: Something went wrong\n'));
      }

      // Should capture stderr for debugging
      const session = manager.getSession('run-123');
      expect(session?.lastError).toBeDefined();
    });

    it('should cleanup resources on error', async () => {
      const { spawn } = require('child_process');
      spawn.mockImplementationOnce(() => {
        const proc = { ...mockProcess };
        setImmediate(() => {
          (proc.on as jest.Mock).mock.calls.find(
            call => call[0] === 'error'
          )?.[1](new Error('Test error'));
        });
        return proc;
      });

      await expect(
        manager.startSession({
          workflowRunId: 'run-123',
          projectPath: '/path/test',
          model: 'claude-sonnet-4',
        })
      ).rejects.toThrow();

      // Session should not be in map
      const session = manager.getSession('run-123');
      expect(session).toBeUndefined();
    });
  });
});
