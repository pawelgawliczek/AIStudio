/**
 * Tests for MasterResponse types and validation
 */

import {
  MasterResponse,
  MasterAction,
  MasterStatus,
  WaitConditionType,
  DEFAULT_MASTER_RESPONSE,
  isValidMasterResponse,
} from '../../types/master-response';

describe('MasterResponse Types', () => {
  describe('isValidMasterResponse', () => {
    it('should return true for valid proceed action', () => {
      const response: MasterResponse = {
        action: 'proceed',
        status: 'success',
        message: 'Proceeding to next state',
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });

    it('should return true for valid spawn_agent action', () => {
      const response: MasterResponse = {
        action: 'spawn_agent',
        status: 'success',
        message: 'Spawning agent for component',
        control: {
          agentConfig: {
            componentId: 'test-component',
            maxTurns: 50,
          },
        },
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });

    it('should return true for valid pause action', () => {
      const response: MasterResponse = {
        action: 'pause',
        status: 'warning',
        message: 'Pausing for approval',
        control: {
          waitCondition: {
            type: 'approval',
            timeout: 300000,
          },
        },
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });

    it('should return true for valid stop action', () => {
      const response: MasterResponse = {
        action: 'stop',
        status: 'success',
        message: 'Workflow completed successfully',
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });

    it('should return true for valid retry action', () => {
      const response: MasterResponse = {
        action: 'retry',
        status: 'error',
        message: 'Retrying after failure',
        control: {
          retryCount: 1,
          maxRetries: 3,
          reason: 'Temporary API error',
        },
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });

    it('should return true for valid skip action', () => {
      const response: MasterResponse = {
        action: 'skip',
        status: 'info',
        message: 'Skipping optional state',
        control: {
          skipReason: 'Not applicable for this workflow',
        },
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });

    it('should return true for valid wait action', () => {
      const response: MasterResponse = {
        action: 'wait',
        status: 'info',
        message: 'Waiting for resource',
        control: {
          waitCondition: {
            type: 'resource',
            resource: 'external-api',
            timeout: 60000,
          },
        },
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });

    it('should return true for valid rerun_state action', () => {
      const response: MasterResponse = {
        action: 'rerun_state',
        status: 'info',
        message: 'Re-running previous state',
        control: {
          targetStateId: 'state-123',
          reason: 'Input data changed',
        },
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });

    it('should return true for response with output', () => {
      const response: MasterResponse = {
        action: 'proceed',
        status: 'success',
        message: 'State completed',
        output: {
          stateOutput: { result: 'success' },
          decision: 'Moving forward',
          updates: { context: 'updated' },
          artifacts: ['artifact-1', 'artifact-2'],
        },
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });

    it('should return true for response with meta', () => {
      const response: MasterResponse = {
        action: 'proceed',
        status: 'success',
        message: 'Completed',
        meta: {
          tokensUsed: 1500,
          durationMs: 5000,
          toolsCalled: ['read_file', 'execute_code'],
        },
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });

    it('should return false for null input', () => {
      expect(isValidMasterResponse(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(isValidMasterResponse(undefined)).toBe(false);
    });

    it('should return false for non-object input', () => {
      expect(isValidMasterResponse('string')).toBe(false);
      expect(isValidMasterResponse(123)).toBe(false);
      expect(isValidMasterResponse(true)).toBe(false);
    });

    it('should return false for missing action', () => {
      const response = {
        status: 'success',
        message: 'Missing action',
      };
      expect(isValidMasterResponse(response)).toBe(false);
    });

    it('should return false for missing status', () => {
      const response = {
        action: 'proceed',
        message: 'Missing status',
      };
      expect(isValidMasterResponse(response)).toBe(false);
    });

    it('should return false for missing message', () => {
      const response = {
        action: 'proceed',
        status: 'success',
      };
      expect(isValidMasterResponse(response)).toBe(false);
    });

    it('should return false for invalid action type', () => {
      const response = {
        action: 123,
        status: 'success',
        message: 'Invalid action type',
      };
      expect(isValidMasterResponse(response)).toBe(false);
    });

    it('should return false for invalid status type', () => {
      const response = {
        action: 'proceed',
        status: 123,
        message: 'Invalid status type',
      };
      expect(isValidMasterResponse(response)).toBe(false);
    });

    it('should return false for invalid message type', () => {
      const response = {
        action: 'proceed',
        status: 'success',
        message: 123,
      };
      expect(isValidMasterResponse(response)).toBe(false);
    });

    it('should return false for invalid action value', () => {
      const response = {
        action: 'invalid_action',
        status: 'success',
        message: 'Invalid action value',
      };
      expect(isValidMasterResponse(response)).toBe(false);
    });

    it('should return false for invalid status value', () => {
      const response = {
        action: 'proceed',
        status: 'invalid_status',
        message: 'Invalid status value',
      };
      expect(isValidMasterResponse(response)).toBe(false);
    });
  });

  describe('DEFAULT_MASTER_RESPONSE', () => {
    it('should have proceed action', () => {
      expect(DEFAULT_MASTER_RESPONSE.action).toBe('proceed');
    });

    it('should have success status', () => {
      expect(DEFAULT_MASTER_RESPONSE.status).toBe('success');
    });

    it('should have default message', () => {
      expect(DEFAULT_MASTER_RESPONSE.message).toBe('No explicit response, proceeding by default');
    });

    it('should be a valid MasterResponse', () => {
      expect(isValidMasterResponse(DEFAULT_MASTER_RESPONSE)).toBe(true);
    });
  });

  describe('Type Checking', () => {
    it('should accept all valid action types', () => {
      const actions: MasterAction[] = [
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
          action,
          status: 'success',
          message: `Testing ${action}`,
        };
        expect(isValidMasterResponse(response)).toBe(true);
      });
    });

    it('should accept all valid status types', () => {
      const statuses: MasterStatus[] = ['success', 'error', 'warning', 'info'];

      statuses.forEach(status => {
        const response: MasterResponse = {
          action: 'proceed',
          status,
          message: `Testing ${status}`,
        };
        expect(isValidMasterResponse(response)).toBe(true);
      });
    });

    it('should accept all valid wait condition types', () => {
      const conditionTypes: WaitConditionType[] = ['approval', 'timeout', 'event', 'resource'];

      conditionTypes.forEach(type => {
        const response: MasterResponse = {
          action: 'wait',
          status: 'info',
          message: `Waiting for ${type}`,
          control: {
            waitCondition: { type },
          },
        };
        expect(isValidMasterResponse(response)).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty object', () => {
      expect(isValidMasterResponse({})).toBe(false);
    });

    it('should handle object with extra properties', () => {
      const response = {
        action: 'proceed',
        status: 'success',
        message: 'With extra properties',
        extraProp: 'should not affect validation',
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });

    it('should handle response with all optional fields', () => {
      const response: MasterResponse = {
        action: 'proceed',
        status: 'success',
        message: 'Full response',
        output: {
          stateOutput: { data: 'test' },
          decision: 'test decision',
          updates: { key: 'value' },
          artifacts: ['id1', 'id2'],
        },
        control: {
          targetState: 'state-1',
          targetStateId: 'id-1',
          reason: 'test reason',
          retryCount: 1,
          maxRetries: 3,
          waitCondition: {
            type: 'timeout',
            timeout: 5000,
          },
          skipToState: 'state-2',
          skipReason: 'skip reason',
          agentConfig: {
            componentId: 'comp-1',
            allowedTools: ['tool1', 'tool2'],
            maxTurns: 100,
            timeout: 30000,
          },
        },
        meta: {
          tokensUsed: 2000,
          durationMs: 10000,
          toolsCalled: ['tool1', 'tool2', 'tool3'],
        },
      };
      expect(isValidMasterResponse(response)).toBe(true);
    });
  });
});
