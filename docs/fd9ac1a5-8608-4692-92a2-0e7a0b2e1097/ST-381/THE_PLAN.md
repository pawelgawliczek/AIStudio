# ST-381: Executor Interface Abstraction - Implementation Plan

## Overview
Extract the `IAgentExecutor` interface from the existing `ClaudeCodeExecutor` to allow for multiple CLI-based agents. Refactor `ClaudeCodeExecutor` to implement this interface.

## Relevant Files
- `laptop-agent/src/claude-code-executor.ts`: Concrete implementation to be refactored.
- `laptop-agent/src/agent.ts`: Primary consumer of the executor.
- `laptop-agent/src/types/executor.ts`: (New) Location for the `IAgentExecutor` interface.

## Proposed Changes

### 1. Create `IAgentExecutor` Interface
Define the interface in a new file `laptop-agent/src/types/executor.ts` (or similar).

```typescript
export interface IAgentExecutor extends EventEmitter {
  execute(job: ClaudeCodeJobPayload): Promise<ExecutionResult>;
  resumeWithAnswer(answer: string, state: ExecutionState): Promise<ExecutionResult>;
  stop(): Promise<void>;
  // Static method checkAvailability() is not part of the interface but should be kept in concrete classes
}
```

### 2. Refactor `ClaudeCodeExecutor`
- Import `IAgentExecutor`.
- Implement the interface: `class ClaudeCodeExecutor extends EventEmitter implements IAgentExecutor`.
- Ensure all public methods match the interface.

### 3. Refactor `RemoteAgent`
- Update `laptop-agent/src/agent.ts` to use `IAgentExecutor` type for the executor property.
- Update initialization logic to be more flexible.

## Verification Plan
1. Run existing tests for `ClaudeCodeExecutor`.
2. Run tests for `RemoteAgent`.
3. Verify that types match and no regressions are introduced in existing job handling.
