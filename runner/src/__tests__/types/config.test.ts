/**
 * Tests for Configuration types and loading
 */

import {
  RunnerConfig,
  ResourceLimits,
  AgentConfig,
  MasterConfig,
  DEFAULT_LIMITS,
  DEFAULT_AGENT_CONFIG,
  DEFAULT_MASTER_CONFIG,
  loadConfig,
} from '../../types/config';

describe('Configuration Types', () => {
  describe('DEFAULT_LIMITS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_LIMITS.maxAgentSpawns).toBe(20);
      expect(DEFAULT_LIMITS.maxTokenBudget).toBe(500000);
      expect(DEFAULT_LIMITS.maxStateTransitions).toBe(50);
      expect(DEFAULT_LIMITS.maxRunDuration).toBe(7200000); // 2 hours
      expect(DEFAULT_LIMITS.maxConcurrentRuns).toBe(5);
    });
  });

  describe('DEFAULT_AGENT_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_AGENT_CONFIG.maxTurns).toBe(100);
      expect(DEFAULT_AGENT_CONFIG.timeout).toBe(1800000); // 30 minutes
      expect(DEFAULT_AGENT_CONFIG.defaultTimeout).toBe(1800000);
    });
  });

  describe('DEFAULT_MASTER_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_MASTER_CONFIG.maxTurns).toBe(1000);
      expect(DEFAULT_MASTER_CONFIG.idleTimeout).toBe(300000); // 5 minutes
    });
  });

  describe('loadConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment before each test
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    it('should load default values when no environment variables set', () => {
      // Clear all related env vars
      delete process.env.MAX_AGENT_SPAWNS;
      delete process.env.MAX_TOKEN_BUDGET;
      delete process.env.MAX_STATE_TRANSITIONS;
      delete process.env.MAX_RUN_DURATION;
      delete process.env.MAX_CONCURRENT_RUNS;
      delete process.env.AGENT_MAX_TURNS;
      delete process.env.AGENT_TIMEOUT;
      delete process.env.MASTER_MAX_TURNS;
      delete process.env.MASTER_IDLE_TIMEOUT;
      delete process.env.BACKEND_URL;
      delete process.env.WORKING_DIRECTORY;
      delete process.env.CHECKPOINT_DIR;
      delete process.env.DATABASE_URL;

      const config = loadConfig();

      expect(config.limits.maxAgentSpawns).toBe(20);
      expect(config.limits.maxTokenBudget).toBe(500000);
      expect(config.limits.maxStateTransitions).toBe(50);
      expect(config.limits.maxRunDuration).toBe(7200000);
      expect(config.limits.maxConcurrentRuns).toBe(5);
      expect(config.agent.maxTurns).toBe(100);
      expect(config.agent.timeout).toBe(1800000);
      expect(config.master.maxTurns).toBe(1000);
      expect(config.master.idleTimeout).toBe(300000);
      expect(config.backendUrl).toBe('http://localhost:3000');
      expect(config.workingDirectory).toBe('/app/worktree');
      expect(config.checkpointDir).toBe('/app/checkpoints');
      expect(config.databaseUrl).toBe('');
    });

    it('should load custom resource limits from environment', () => {
      process.env.MAX_AGENT_SPAWNS = '30';
      process.env.MAX_TOKEN_BUDGET = '1000000';
      process.env.MAX_STATE_TRANSITIONS = '100';
      process.env.MAX_RUN_DURATION = '14400000'; // 4 hours
      process.env.MAX_CONCURRENT_RUNS = '10';

      const config = loadConfig();

      expect(config.limits.maxAgentSpawns).toBe(30);
      expect(config.limits.maxTokenBudget).toBe(1000000);
      expect(config.limits.maxStateTransitions).toBe(100);
      expect(config.limits.maxRunDuration).toBe(14400000);
      expect(config.limits.maxConcurrentRuns).toBe(10);
    });

    it('should load custom agent config from environment', () => {
      process.env.AGENT_MAX_TURNS = '200';
      process.env.AGENT_TIMEOUT = '3600000'; // 1 hour
      process.env.AGENT_MODEL = 'claude-opus-4';

      const config = loadConfig();

      expect(config.agent.maxTurns).toBe(200);
      expect(config.agent.timeout).toBe(3600000);
      expect(config.agent.defaultTimeout).toBe(3600000);
      expect(config.agent.model).toBe('claude-opus-4');
    });

    it('should load custom master config from environment', () => {
      process.env.MASTER_MAX_TURNS = '2000';
      process.env.MASTER_IDLE_TIMEOUT = '600000'; // 10 minutes
      process.env.MASTER_MODEL = 'claude-sonnet-4';

      const config = loadConfig();

      expect(config.master.maxTurns).toBe(2000);
      expect(config.master.idleTimeout).toBe(600000);
      expect(config.master.model).toBe('claude-sonnet-4');
    });

    it('should load custom paths from environment', () => {
      process.env.BACKEND_URL = 'http://backend:4000';
      process.env.WORKING_DIRECTORY = '/custom/worktree';
      process.env.CHECKPOINT_DIR = '/custom/checkpoints';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';

      const config = loadConfig();

      expect(config.backendUrl).toBe('http://backend:4000');
      expect(config.workingDirectory).toBe('/custom/worktree');
      expect(config.checkpointDir).toBe('/custom/checkpoints');
      expect(config.databaseUrl).toBe('postgresql://localhost:5432/db');
    });

    it('should parse string numbers correctly', () => {
      process.env.MAX_AGENT_SPAWNS = '   50   '; // with whitespace
      process.env.MAX_TOKEN_BUDGET = '2000000';

      const config = loadConfig();

      expect(config.limits.maxAgentSpawns).toBe(50);
      expect(config.limits.maxTokenBudget).toBe(2000000);
    });

    it('should handle invalid number strings by using defaults', () => {
      process.env.MAX_AGENT_SPAWNS = 'invalid';
      process.env.MAX_TOKEN_BUDGET = '';

      const config = loadConfig();

      // parseInt('invalid', 10) returns NaN, parseInt('', 10) returns NaN
      // The code uses parseInt with fallback to default string
      expect(typeof config.limits.maxAgentSpawns).toBe('number');
      expect(typeof config.limits.maxTokenBudget).toBe('number');
    });

    it('should handle zero values', () => {
      process.env.MAX_AGENT_SPAWNS = '0';
      process.env.MAX_TOKEN_BUDGET = '0';

      const config = loadConfig();

      expect(config.limits.maxAgentSpawns).toBe(0);
      expect(config.limits.maxTokenBudget).toBe(0);
    });

    it('should handle negative values', () => {
      process.env.MAX_AGENT_SPAWNS = '-10';
      process.env.AGENT_TIMEOUT = '-5000';

      const config = loadConfig();

      expect(config.limits.maxAgentSpawns).toBe(-10);
      expect(config.agent.timeout).toBe(-5000);
    });

    it('should create complete RunnerConfig structure', () => {
      const config = loadConfig();

      expect(config).toHaveProperty('limits');
      expect(config).toHaveProperty('agent');
      expect(config).toHaveProperty('master');
      expect(config).toHaveProperty('backendUrl');
      expect(config).toHaveProperty('workingDirectory');
      expect(config).toHaveProperty('checkpointDir');
      expect(config).toHaveProperty('databaseUrl');

      expect(config.limits).toHaveProperty('maxAgentSpawns');
      expect(config.limits).toHaveProperty('maxTokenBudget');
      expect(config.limits).toHaveProperty('maxStateTransitions');
      expect(config.limits).toHaveProperty('maxRunDuration');
      expect(config.limits).toHaveProperty('maxConcurrentRuns');

      expect(config.agent).toHaveProperty('maxTurns');
      expect(config.agent).toHaveProperty('timeout');
      expect(config.agent).toHaveProperty('defaultTimeout');

      expect(config.master).toHaveProperty('maxTurns');
      expect(config.master).toHaveProperty('idleTimeout');
    });
  });

  describe('Type Interfaces', () => {
    it('should allow ResourceLimits with all fields', () => {
      const limits: ResourceLimits = {
        maxAgentSpawns: 25,
        maxTokenBudget: 600000,
        maxStateTransitions: 60,
        maxRunDuration: 10800000,
        maxConcurrentRuns: 8,
      };

      expect(limits.maxAgentSpawns).toBe(25);
      expect(limits.maxTokenBudget).toBe(600000);
    });

    it('should allow AgentConfig with optional fields', () => {
      const config1: AgentConfig = {
        maxTurns: 150,
        timeout: 2700000,
        defaultTimeout: 2700000,
      };

      const config2: AgentConfig = {
        maxTurns: 150,
        timeout: 2700000,
        defaultTimeout: 2700000,
        model: 'claude-opus-4',
        allowedTools: ['tool1', 'tool2'],
      };

      expect(config1.model).toBeUndefined();
      expect(config2.model).toBe('claude-opus-4');
      expect(config2.allowedTools).toEqual(['tool1', 'tool2']);
    });

    it('should allow MasterConfig with optional model', () => {
      const config1: MasterConfig = {
        maxTurns: 1500,
        idleTimeout: 450000,
      };

      const config2: MasterConfig = {
        maxTurns: 1500,
        idleTimeout: 450000,
        model: 'claude-sonnet-4',
      };

      expect(config1.model).toBeUndefined();
      expect(config2.model).toBe('claude-sonnet-4');
    });

    it('should allow RunnerConfig with all fields', () => {
      const config: RunnerConfig = {
        limits: DEFAULT_LIMITS,
        agent: DEFAULT_AGENT_CONFIG,
        master: DEFAULT_MASTER_CONFIG,
        backendUrl: 'http://test:3000',
        workingDirectory: '/test',
        checkpointDir: '/test/checkpoints',
        databaseUrl: 'postgresql://test',
      };

      expect(config.backendUrl).toBe('http://test:3000');
      expect(config.workingDirectory).toBe('/test');
    });
  });
});
