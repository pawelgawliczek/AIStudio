/**
 * Tests for ResponseHandler
 */

import { ResponseHandler, RunnerInterface } from '../../state-machine/response-handler';
import { MasterResponse } from '../../types/master-response';
import { WorkflowState } from '../../types/workflow';

describe('ResponseHandler', () => {
  let handler: ResponseHandler;
  let mockRunner: jest.Mocked<RunnerInterface>;
  let testState: WorkflowState;

  beforeEach(() => {
    // Create mock runner
    mockRunner = {
      pause: jest.fn().mockResolvedValue(undefined),
      skipToState: jest.fn().mockResolvedValue(undefined),
      rerunState: jest.fn().mockResolvedValue(undefined),
    };

    handler = new ResponseHandler(mockRunner);

    // Create test state
    testState = {
      id: 'state-1',
      workflowId: 'workflow-1',
      name: 'Test State',
      order: 1,
      componentId: 'component-1',
      requiresApproval: false,
      mandatory: false,
    };
  });

  describe('handle - proceed action', () => {
    it('should return continue for proceed action', async () => {
      const response: MasterResponse = {
        action: 'proceed',
        status: 'success',
        message: 'Proceeding to next state',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('continue');
    });

    it('should handle proceed with output', async () => {
      const response: MasterResponse = {
        action: 'proceed',
        status: 'success',
        message: 'State completed',
        output: {
          stateOutput: { result: 'success' },
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('continue');
    });
  });

  describe('handle - spawn_agent action', () => {
    it('should return continue for spawn_agent', async () => {
      const response: MasterResponse = {
        action: 'spawn_agent',
        status: 'success',
        message: 'Spawning agent',
        control: {
          agentConfig: {
            componentId: 'test-component',
            maxTurns: 50,
          },
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('continue');
    });

    it('should return continue even without agentConfig', async () => {
      const response: MasterResponse = {
        action: 'spawn_agent',
        status: 'success',
        message: 'Spawning agent',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('continue');
    });
  });

  describe('handle - pause action', () => {
    it('should pause runner and return pause', async () => {
      const response: MasterResponse = {
        action: 'pause',
        status: 'warning',
        message: 'Pausing for review',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('pause');
      expect(mockRunner.pause).toHaveBeenCalledWith('Pausing for review');
    });

    it('should handle pause with wait condition', async () => {
      const response: MasterResponse = {
        action: 'pause',
        status: 'info',
        message: 'Pausing with timeout',
        control: {
          waitCondition: {
            type: 'timeout',
            timeout: 60000,
          },
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('pause');
      expect(mockRunner.pause).toHaveBeenCalled();
    });
  });

  describe('handle - stop action', () => {
    it('should return stop for stop action', async () => {
      const response: MasterResponse = {
        action: 'stop',
        status: 'success',
        message: 'Workflow completed',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('stop');
    });

    it('should handle stop with error status', async () => {
      const response: MasterResponse = {
        action: 'stop',
        status: 'error',
        message: 'Critical error occurred',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('stop');
    });
  });

  describe('handle - retry action', () => {
    it('should return retry for retry action', async () => {
      const response: MasterResponse = {
        action: 'retry',
        status: 'error',
        message: 'Retrying after failure',
        control: {
          retryCount: 1,
          maxRetries: 3,
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('retry');
    });

    it('should handle retry without retry count', async () => {
      const response: MasterResponse = {
        action: 'retry',
        status: 'error',
        message: 'Retrying',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('retry');
    });
  });

  describe('handle - skip action', () => {
    it('should return skip for non-mandatory state', async () => {
      const response: MasterResponse = {
        action: 'skip',
        status: 'info',
        message: 'Skipping optional state',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('skip');
    });

    it('should pause instead of skip for mandatory state', async () => {
      testState.mandatory = true;

      const response: MasterResponse = {
        action: 'skip',
        status: 'info',
        message: 'Trying to skip',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('pause');
      expect(mockRunner.pause).toHaveBeenCalledWith(
        expect.stringContaining('Cannot skip mandatory state')
      );
    });

    it('should call skipToState when target specified', async () => {
      const response: MasterResponse = {
        action: 'skip',
        status: 'info',
        message: 'Skipping to specific state',
        control: {
          skipToState: 'state-5',
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('skip');
      expect(mockRunner.skipToState).toHaveBeenCalledWith('state-5');
    });
  });

  describe('handle - wait action', () => {
    it('should wait for timeout condition', async () => {
      const response: MasterResponse = {
        action: 'wait',
        status: 'info',
        message: 'Waiting 1 second',
        control: {
          waitCondition: {
            type: 'timeout',
            timeout: 100,
          },
        },
      };

      const startTime = Date.now();
      const action = await handler.handle(response, testState);
      const duration = Date.now() - startTime;

      expect(action).toBe('continue');
      expect(duration).toBeGreaterThanOrEqual(90); // Allow 10ms tolerance
    });

    it('should pause for approval condition', async () => {
      const response: MasterResponse = {
        action: 'wait',
        status: 'info',
        message: 'Waiting for approval',
        control: {
          waitCondition: {
            type: 'approval',
          },
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('pause');
      expect(mockRunner.pause).toHaveBeenCalledWith(
        expect.stringContaining('Approval required')
      );
    });

    it('should continue for event condition', async () => {
      const response: MasterResponse = {
        action: 'wait',
        status: 'info',
        message: 'Waiting for event',
        control: {
          waitCondition: {
            type: 'event',
            event: 'deployment-complete',
          },
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('continue');
    });

    it('should return wait for resource condition', async () => {
      const response: MasterResponse = {
        action: 'wait',
        status: 'info',
        message: 'Waiting for resource',
        control: {
          waitCondition: {
            type: 'resource',
            resource: 'database',
          },
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('wait');
    });

    it('should continue when no wait condition specified', async () => {
      const response: MasterResponse = {
        action: 'wait',
        status: 'info',
        message: 'Wait without condition',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('continue');
    });
  });

  describe('handle - rerun_state action', () => {
    it('should rerun current state when no target specified', async () => {
      const response: MasterResponse = {
        action: 'rerun_state',
        status: 'info',
        message: 'Rerunning current state',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('continue');
      expect(mockRunner.rerunState).toHaveBeenCalledWith('state-1');
    });

    it('should rerun specified target state', async () => {
      const response: MasterResponse = {
        action: 'rerun_state',
        status: 'info',
        message: 'Rerunning previous state',
        control: {
          targetStateId: 'state-0',
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('continue');
      expect(mockRunner.rerunState).toHaveBeenCalledWith('state-0');
    });
  });

  describe('handle - unknown action', () => {
    it('should default to continue for unknown action', async () => {
      const response: any = {
        action: 'unknown_action',
        status: 'success',
        message: 'Unknown',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('continue');
    });
  });

  describe('validate', () => {
    it('should return true for valid response', () => {
      const response: MasterResponse = {
        action: 'proceed',
        status: 'success',
        message: 'Valid',
      };

      expect(handler.validate(response)).toBe(true);
    });

    it('should return false for response without action', () => {
      const response: any = {
        status: 'success',
        message: 'No action',
      };

      expect(handler.validate(response)).toBe(false);
    });

    it('should return false for invalid action', () => {
      const response: any = {
        action: 'invalid_action',
        status: 'success',
        message: 'Invalid',
      };

      expect(handler.validate(response)).toBe(false);
    });

    it('should return true for all valid actions', () => {
      const actions = [
        'proceed',
        'spawn_agent',
        'pause',
        'stop',
        'retry',
        'skip',
        'wait',
        'rerun_state',
      ];

      actions.forEach(action => {
        const response: MasterResponse = {
          action: action as any,
          status: 'success',
          message: 'Test',
        };

        expect(handler.validate(response)).toBe(true);
      });
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle response with full control block', async () => {
      const response: MasterResponse = {
        action: 'pause',
        status: 'warning',
        message: 'Complex pause',
        output: {
          stateOutput: { data: 'test' },
          decision: 'Need review',
        },
        control: {
          reason: 'Waiting for approval',
          waitCondition: {
            type: 'approval',
            timeout: 300000,
          },
        },
        meta: {
          tokensUsed: 1500,
          durationMs: 5000,
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('pause');
      expect(mockRunner.pause).toHaveBeenCalled();
    });

    it('should handle retry with full control', async () => {
      const response: MasterResponse = {
        action: 'retry',
        status: 'error',
        message: 'Retry with details',
        control: {
          retryCount: 2,
          maxRetries: 5,
          reason: 'Transient network error',
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('retry');
    });

    it('should handle skip with reason', async () => {
      const response: MasterResponse = {
        action: 'skip',
        status: 'info',
        message: 'Skipping with reason',
        control: {
          skipReason: 'Not applicable for current context',
          skipToState: 'state-10',
        },
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('skip');
      expect(mockRunner.skipToState).toHaveBeenCalledWith('state-10');
    });
  });

  describe('Error Handling', () => {
    it('should handle pause error gracefully', async () => {
      mockRunner.pause.mockRejectedValue(new Error('Pause failed'));

      const response: MasterResponse = {
        action: 'pause',
        status: 'warning',
        message: 'Pausing',
      };

      await expect(handler.handle(response, testState)).rejects.toThrow('Pause failed');
    });

    it('should handle skipToState error gracefully', async () => {
      mockRunner.skipToState.mockRejectedValue(new Error('Skip failed'));

      const response: MasterResponse = {
        action: 'skip',
        status: 'info',
        message: 'Skipping',
        control: {
          skipToState: 'invalid-state',
        },
      };

      await expect(handler.handle(response, testState)).rejects.toThrow('Skip failed');
    });

    it('should handle rerunState error gracefully', async () => {
      mockRunner.rerunState.mockRejectedValue(new Error('Rerun failed'));

      const response: MasterResponse = {
        action: 'rerun_state',
        status: 'info',
        message: 'Rerunning',
      };

      await expect(handler.handle(response, testState)).rejects.toThrow('Rerun failed');
    });
  });

  describe('State Properties', () => {
    it('should respect requiresApproval on state', async () => {
      testState.requiresApproval = true;

      const response: MasterResponse = {
        action: 'proceed',
        status: 'success',
        message: 'Proceeding',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('continue');
      // Note: requiresApproval is informational, doesn't affect proceed action
    });

    it('should enforce mandatory on skip', async () => {
      testState.mandatory = true;

      const response: MasterResponse = {
        action: 'skip',
        status: 'info',
        message: 'Attempt skip',
      };

      const action = await handler.handle(response, testState);

      expect(action).toBe('pause');
      expect(mockRunner.pause).toHaveBeenCalledWith(
        expect.stringContaining('mandatory')
      );
    });
  });
});
