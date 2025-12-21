import {
  ClaudeCodeExecutor,
} from '../claude-code-executor';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe('ClaudeCodeExecutor', () => {
  let executor: ClaudeCodeExecutor;
  const config = {
    agentSecret: 'test-secret',
    projectPath: '/test/path',
  };

  beforeEach(() => {
    executor = new ClaudeCodeExecutor(config);
    jest.clearAllMocks();
  });

  it('should verify signature correctly', () => {
    const job = {
      id: 'job-1',
      componentId: 'comp-1',
      stateId: 'state-1',
      workflowRunId: 'run-1',
      instructions: 'test instructions',
      config: {},
      timestamp: Date.now(),
      jobToken: 'token-1',
      signature: '',
    };

    // Calculate valid signature
    const crypto = require('crypto');
    const payload = JSON.stringify({
      id: job.id,
      componentId: job.componentId,
      stateId: job.stateId,
      instructions: job.instructions,
      timestamp: job.timestamp,
    });
    job.signature = crypto.createHmac('sha256', config.agentSecret)
      .update(payload)
      .digest('hex');

    expect(executor.verifySignature(job)).toBe(true);
    
    job.signature = 'wrong';
    expect(executor.verifySignature(job)).toBe(false);
  });

  it('should build claude code args correctly', () => {
    const job = {
      id: 'job-1',
      componentId: 'comp-1',
      stateId: 'state-1',
      workflowRunId: 'run-1',
      instructions: 'test instructions',
      config: {
        model: 'claude-3-opus',
        maxTurns: 10,
        executionType: 'native_explore' as any,
      },
      timestamp: Date.now(),
      jobToken: 'token-1',
      signature: 'sig',
    };

    // Accessing private method for testing
    const args = (executor as any).buildClaudeCodeArgs(job);
    expect(args).toContain('--print');
    expect(args).toContain('--verbose');
    expect(args).toContain('--model');
    expect(args).toContain('claude-3-opus');
    expect(args).toContain('--max-turns');
    expect(args).toContain('10');
    expect(args).toContain('--permission-mode');
    expect(args).toContain('plan');
  });

  it('should handle process execution', async () => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.stdin = { write: jest.fn(), end: jest.fn() };
    mockProcess.kill = jest.fn();

    (spawn as jest.Mock).mockReturnValue(mockProcess);

    const job = {
      id: 'job-1',
      componentId: 'comp-1',
      stateId: 'state-1',
      workflowRunId: 'run-1',
      instructions: 'test instructions',
      config: {},
      timestamp: Date.now(),
      jobToken: 'token-1',
      signature: 'sig',
    };

    // Mock signature verification
    jest.spyOn(executor, 'verifySignature').mockReturnValue(true);

    const executePromise = executor.execute(job);

    // Simulate stdout data
    mockProcess.stdout.emit('data', Buffer.from('{"type":"text","text":"Hello"}\n'));
    
    // Simulate process close
    mockProcess.emit('close', 0);

    const result = await executePromise;
    expect(result.success).toBe(true);
    expect(spawn).toHaveBeenCalled();
  });

  it('should handle resumeWithAnswer', async () => {
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.stdin = { write: jest.fn(), end: jest.fn() };
    mockProcess.kill = jest.fn();

    (spawn as jest.Mock).mockReturnValue(mockProcess);

    const originalJob = {
      id: 'job-1',
      componentId: 'comp-1',
      stateId: 'state-1',
      workflowRunId: 'run-1',
      instructions: 'test instructions',
      config: {},
      timestamp: Date.now(),
      jobToken: 'token-1',
      signature: 'sig',
    };

    const resumePromise = executor.resumeWithAnswer('session-1', 'my answer', originalJob);

    // Simulate stdout data
    mockProcess.stdout.emit('data', Buffer.from('{"type":"text","text":"Continued"}\n'));
    
    // Simulate process close
    mockProcess.emit('close', 0);

    const result = await resumePromise;
    expect(result.success).toBe(true);
    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['--resume', 'session-1']),
      expect.anything()
    );
  });
});
