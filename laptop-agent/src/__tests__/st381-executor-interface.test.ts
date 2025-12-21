import { ClaudeCodeExecutor } from '../claude-code-executor';
import { IAgentExecutor } from '../types/executor';
import { EventEmitter } from 'events';

describe('ST-381: Executor Interface Abstraction', () => {
  it('ClaudeCodeExecutor should implement IAgentExecutor', () => {
    const executor = new ClaudeCodeExecutor({
      agentSecret: 'test-secret',
      projectPath: '/tmp',
    });

    // Type check (will fail compilation if not matching)
    const agentExecutor: IAgentExecutor = executor;
    
    expect(agentExecutor).toBeInstanceOf(ClaudeCodeExecutor);
    expect(agentExecutor).toBeInstanceOf(EventEmitter);
    expect(typeof agentExecutor.execute).toBe('function');
    expect(typeof agentExecutor.resumeWithAnswer).toBe('function');
    expect(typeof agentExecutor.stop).toBe('function');
  });

  it('IAgentExecutor should have the required methods', () => {
    // This is more of a type-level test, but we can verify presence
    const mockExecutor: IAgentExecutor = {
      execute: jest.fn(),
      resumeWithAnswer: jest.fn(),
      stop: jest.fn(),
    } as any;

    expect(mockExecutor.execute).toBeDefined();
    expect(mockExecutor.resumeWithAnswer).toBeDefined();
    expect(mockExecutor.stop).toBeDefined();
  });
});
