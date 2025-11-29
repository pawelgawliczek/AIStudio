/**
 * Response Handler
 * Processes MasterResponse and determines next action for the runner
 */

import { MasterResponse, MasterAction, WorkflowState } from '../types';

/**
 * Actions the response handler can return
 */
export type HandlerAction = 'continue' | 'skip' | 'pause' | 'stop' | 'retry' | 'wait';

/**
 * Runner interface for response handler operations
 */
export interface RunnerInterface {
  pause(reason?: string): Promise<void>;
  skipToState(stateId: string): Promise<void>;
  rerunState(stateId: string): Promise<void>;
}

/**
 * Response Handler
 * Interprets MasterResponse and orchestrates runner behavior
 */
export class ResponseHandler {
  private runner: RunnerInterface;
  private waitCallbacks: Map<string, () => void> = new Map();

  constructor(runner: RunnerInterface) {
    this.runner = runner;
  }

  /**
   * Handle a MasterResponse and return the action to take
   */
  async handle(response: MasterResponse, state: WorkflowState): Promise<HandlerAction> {
    console.log(`[ResponseHandler] Handling response: action=${response.action}, status=${response.status}`);

    // Log any messages
    if (response.message) {
      console.log(`[ResponseHandler] Message: ${response.message}`);
    }

    // Process based on action
    switch (response.action) {
      case 'proceed':
        return this.handleProceed(response, state);

      case 'spawn_agent':
        return this.handleSpawnAgent(response, state);

      case 'pause':
        return this.handlePause(response, state);

      case 'stop':
        return this.handleStop(response, state);

      case 'retry':
        return this.handleRetry(response, state);

      case 'skip':
        return this.handleSkip(response, state);

      case 'wait':
        return this.handleWait(response, state);

      case 'rerun_state':
        return this.handleRerunState(response, state);

      default:
        console.warn(`[ResponseHandler] Unknown action: ${response.action}, defaulting to proceed`);
        return 'continue';
    }
  }

  /**
   * Handle 'proceed' action - continue to next step
   */
  private async handleProceed(response: MasterResponse, state: WorkflowState): Promise<HandlerAction> {
    // Check for any output to store
    if (response.output) {
      console.log(`[ResponseHandler] Storing output: ${JSON.stringify(response.output).substring(0, 100)}...`);
    }

    return 'continue';
  }

  /**
   * Handle 'spawn_agent' action - used when master wants to delegate to agent
   * In our architecture, agents are spawned by the runner, not requested by master
   * This action is for edge cases where master needs to trigger an ad-hoc agent
   */
  private async handleSpawnAgent(response: MasterResponse, state: WorkflowState): Promise<HandlerAction> {
    const agentConfig = response.control?.agentConfig;
    if (!agentConfig) {
      console.warn('[ResponseHandler] spawn_agent without agentConfig, continuing normally');
      return 'continue';
    }

    console.log(`[ResponseHandler] Agent spawn requested: ${agentConfig.componentId || 'default'}`);
    // The runner will handle agent spawning based on state.componentId
    return 'continue';
  }

  /**
   * Handle 'pause' action - pause execution for review or approval
   */
  private async handlePause(response: MasterResponse, state: WorkflowState): Promise<HandlerAction> {
    const reason = response.message || 'Pause requested by master session';
    console.log(`[ResponseHandler] Pausing: ${reason}`);

    // Check if this is a timed pause
    if (response.control?.waitCondition) {
      const condition = response.control.waitCondition;
      if (condition.type === 'timeout' && condition.timeout) {
        console.log(`[ResponseHandler] Timed pause: ${condition.timeout}ms`);
        // For timed pause, we still pause but the condition is informational
      }
    }

    await this.runner.pause(reason);
    return 'pause';
  }

  /**
   * Handle 'stop' action - stop execution (success or failure)
   */
  private async handleStop(response: MasterResponse, state: WorkflowState): Promise<HandlerAction> {
    const reason = response.message || 'Stop requested by master session';
    const isSuccess = response.status === 'success';

    console.log(`[ResponseHandler] Stopping (${isSuccess ? 'success' : 'failure'}): ${reason}`);

    // Stop is final - the runner will handle completion/failure
    return 'stop';
  }

  /**
   * Handle 'retry' action - retry current operation
   */
  private async handleRetry(response: MasterResponse, state: WorkflowState): Promise<HandlerAction> {
    const maxRetries = response.control?.retryCount || 3;
    console.log(`[ResponseHandler] Retry requested (max: ${maxRetries})`);

    // The runner will handle retry logic
    // For now, we return 'retry' and let the runner decide
    return 'retry';
  }

  /**
   * Handle 'skip' action - skip current state
   */
  private async handleSkip(response: MasterResponse, state: WorkflowState): Promise<HandlerAction> {
    console.log(`[ResponseHandler] Skipping state: ${state.name}`);

    // Check if state is mandatory
    if (state.mandatory) {
      console.warn(`[ResponseHandler] Cannot skip mandatory state: ${state.name}`);
      // Convert to pause for human review
      await this.runner.pause(`Cannot skip mandatory state: ${state.name}`);
      return 'pause';
    }

    // Check if skip target is specified
    if (response.control?.skipToState) {
      console.log(`[ResponseHandler] Skipping to specific state: ${response.control.skipToState}`);
      await this.runner.skipToState(response.control.skipToState);
    }

    return 'skip';
  }

  /**
   * Handle 'wait' action - wait for condition
   */
  private async handleWait(response: MasterResponse, state: WorkflowState): Promise<HandlerAction> {
    const condition = response.control?.waitCondition;

    if (!condition) {
      console.warn('[ResponseHandler] wait action without condition, continuing');
      return 'continue';
    }

    console.log(`[ResponseHandler] Waiting for condition: ${condition.type}`);

    switch (condition.type) {
      case 'timeout':
        // Wait for specified time
        if (condition.timeout) {
          console.log(`[ResponseHandler] Waiting ${condition.timeout}ms`);
          await this.sleep(condition.timeout);
        }
        return 'continue';

      case 'approval':
        // Wait for human approval - pause for now
        // ST-148 will implement proper approval gates
        console.log(`[ResponseHandler] Approval required - pausing for review`);
        await this.runner.pause(`Approval required: ${response.message}`);
        return 'pause';

      case 'event':
        // Wait for external event
        // For now, log and continue (events handled by backend)
        console.log(`[ResponseHandler] Event wait: ${condition.event}`);
        if (condition.timeout) {
          await this.sleep(condition.timeout);
        }
        return 'continue';

      case 'resource':
        // Wait for resource availability
        // For now, pause and let runner handle
        console.log(`[ResponseHandler] Resource wait: ${condition.resource}`);
        return 'wait';

      default:
        console.warn(`[ResponseHandler] Unknown wait condition type: ${condition.type}`);
        return 'continue';
    }
  }

  /**
   * Handle 'rerun_state' action - go back and rerun a state
   */
  private async handleRerunState(response: MasterResponse, state: WorkflowState): Promise<HandlerAction> {
    const targetStateId = response.control?.targetStateId;

    if (!targetStateId) {
      console.log(`[ResponseHandler] Rerunning current state: ${state.name}`);
      await this.runner.rerunState(state.id);
    } else {
      console.log(`[ResponseHandler] Rerunning state: ${targetStateId}`);
      await this.runner.rerunState(targetStateId);
    }

    return 'continue';
  }

  /**
   * Utility: sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate MasterResponse structure
   */
  validate(response: MasterResponse): boolean {
    if (!response.action) {
      console.error('[ResponseHandler] Missing action in response');
      return false;
    }

    const validActions: MasterAction[] = [
      'proceed', 'spawn_agent', 'pause', 'stop',
      'retry', 'skip', 'wait', 'rerun_state'
    ];

    if (!validActions.includes(response.action)) {
      console.error(`[ResponseHandler] Invalid action: ${response.action}`);
      return false;
    }

    return true;
  }
}
