/**
 * Tests for Production Safety Guards (ST-76)
 */

import {
  PRODUCTION,
  TEST,
  isProductionPort,
  isProductionContainer,
  isProductionDatabaseUrl,
  isProductionDockerCommand,
  assertNotProductionDb,
  assertNotProductionContainer,
  assertNotMainWorktreeCheckout,
  assertTestPort,
  assertSafeDockerCommand,
  ProductionSafetyError,
  enableAgentTestingMode,
  disableAgentTestingMode,
  isAgentTestingMode,
  withAgentTestingMode,
} from '../environments';

describe('Environment Constants', () => {
  it('should have correct production ports', () => {
    expect(PRODUCTION.DB_PORT).toBe(5432);
    expect(PRODUCTION.BACKEND_PORT).toBe(3000);
    expect(PRODUCTION.FRONTEND_PORT).toBe(5173);
  });

  it('should have correct test ports', () => {
    expect(TEST.DB_PORT).toBe(5434);
    expect(TEST.BACKEND_PORT).toBe(3001);
    expect(TEST.FRONTEND_PORT).toBe(5174);
  });
});

describe('isProductionPort', () => {
  it('should identify production ports', () => {
    expect(isProductionPort(5432)).toBe(true);
    expect(isProductionPort(3000)).toBe(true);
    expect(isProductionPort(5173)).toBe(true);
    expect(isProductionPort(6379)).toBe(true);
  });

  it('should NOT identify test ports as production', () => {
    expect(isProductionPort(5434)).toBe(false);
    expect(isProductionPort(3001)).toBe(false);
    expect(isProductionPort(5174)).toBe(false);
    expect(isProductionPort(6381)).toBe(false);
  });
});

describe('isProductionContainer', () => {
  it('should identify production containers', () => {
    expect(isProductionContainer('vibe-studio-backend')).toBe(true);
    expect(isProductionContainer('vibe-studio-frontend')).toBe(true);
  });

  it('should NOT identify test containers as production', () => {
    expect(isProductionContainer('vibe-studio-test-backend')).toBe(false);
    expect(isProductionContainer('vibe-studio-test-frontend')).toBe(false);
  });
});

describe('isProductionDatabaseUrl', () => {
  it('should identify production database URLs', () => {
    expect(
      isProductionDatabaseUrl('postgresql://user:pass@localhost:5432/vibestudio')
    ).toBe(true);
    expect(
      isProductionDatabaseUrl('postgresql://postgres:secret@127.0.0.1:5432/vibestudio?schema=public')
    ).toBe(true);
  });

  it('should NOT identify test database URLs as production', () => {
    expect(
      isProductionDatabaseUrl('postgresql://postgres:test@127.0.0.1:5434/vibestudio_test')
    ).toBe(false);
    // Port 5432 but with _test database name
    expect(
      isProductionDatabaseUrl('postgresql://postgres:pass@localhost:5432/vibestudio_test')
    ).toBe(false);
  });
});

describe('isProductionDockerCommand', () => {
  it('should block production container operations', () => {
    expect(isProductionDockerCommand('restart backend')).toBe(true);
    expect(isProductionDockerCommand('stop frontend')).toBe(true);
    expect(isProductionDockerCommand('down backend frontend')).toBe(true);
    expect(isProductionDockerCommand('up -d backend')).toBe(true);
    expect(isProductionDockerCommand('build backend')).toBe(true);
    expect(isProductionDockerCommand('build --no-cache frontend')).toBe(true);
  });

  it('should allow test container operations', () => {
    expect(isProductionDockerCommand('restart test-backend')).toBe(false);
    expect(isProductionDockerCommand('up -d test-backend test-frontend')).toBe(false);
    expect(isProductionDockerCommand('build test-backend')).toBe(false);
    expect(isProductionDockerCommand('logs backend')).toBe(false); // read-only
    expect(isProductionDockerCommand('ps')).toBe(false);
  });
});

describe('Safety Assertions', () => {
  describe('assertNotProductionDb', () => {
    it('should throw ProductionSafetyError for production DB', () => {
      expect(() =>
        assertNotProductionDb(
          'postgresql://user:pass@localhost:5432/vibestudio',
          'migrate'
        )
      ).toThrow(ProductionSafetyError);
    });

    it('should NOT throw for test DB', () => {
      expect(() =>
        assertNotProductionDb(
          'postgresql://postgres:test@127.0.0.1:5434/vibestudio_test',
          'migrate'
        )
      ).not.toThrow();
    });
  });

  describe('assertNotProductionContainer', () => {
    it('should throw ProductionSafetyError for production container', () => {
      expect(() =>
        assertNotProductionContainer('vibe-studio-backend', 'restart')
      ).toThrow(ProductionSafetyError);
    });

    it('should NOT throw for test container', () => {
      expect(() =>
        assertNotProductionContainer('vibe-studio-test-backend', 'restart')
      ).not.toThrow();
    });
  });

  describe('assertNotMainWorktreeCheckout', () => {
    it('should throw ProductionSafetyError for non-main branch in main worktree', () => {
      expect(() =>
        assertNotMainWorktreeCheckout('/opt/stack/AIStudio', 'feature-branch')
      ).toThrow(ProductionSafetyError);
    });

    it('should NOT throw for main branch in main worktree', () => {
      expect(() =>
        assertNotMainWorktreeCheckout('/opt/stack/AIStudio', 'main')
      ).not.toThrow();
    });

    it('should NOT throw for any branch in dedicated worktree', () => {
      expect(() =>
        assertNotMainWorktreeCheckout(
          '/opt/stack/worktrees/feature-branch',
          'feature-branch'
        )
      ).not.toThrow();
    });
  });

  describe('assertTestPort', () => {
    it('should throw ProductionSafetyError for production port', () => {
      expect(() => assertTestPort(5432, 'database')).toThrow(
        ProductionSafetyError
      );
      expect(() => assertTestPort(3000, 'backend')).toThrow(
        ProductionSafetyError
      );
    });

    it('should NOT throw for test port', () => {
      expect(() => assertTestPort(5434, 'database')).not.toThrow();
      expect(() => assertTestPort(3001, 'backend')).not.toThrow();
    });
  });

  describe('assertSafeDockerCommand', () => {
    it('should throw ProductionSafetyError for production docker commands', () => {
      expect(() => assertSafeDockerCommand('restart backend')).toThrow(
        ProductionSafetyError
      );
    });

    it('should NOT throw for test docker commands', () => {
      expect(() =>
        assertSafeDockerCommand('restart test-backend')
      ).not.toThrow();
    });
  });
});

describe('Agent Testing Mode', () => {
  afterEach(() => {
    disableAgentTestingMode();
    delete process.env.AGENT_MODE;
  });

  it('should track agent testing mode state', () => {
    expect(isAgentTestingMode()).toBe(false);

    enableAgentTestingMode();
    expect(isAgentTestingMode()).toBe(true);

    disableAgentTestingMode();
    expect(isAgentTestingMode()).toBe(false);
  });

  it('should detect AGENT_MODE environment variable', () => {
    process.env.AGENT_MODE = 'testing';
    expect(isAgentTestingMode()).toBe(true);
  });

  it('should handle withAgentTestingMode wrapper', async () => {
    expect(isAgentTestingMode()).toBe(false);

    await withAgentTestingMode(async () => {
      expect(isAgentTestingMode()).toBe(true);
    });

    expect(isAgentTestingMode()).toBe(false);
  });

  it('should disable mode even if function throws', async () => {
    expect(isAgentTestingMode()).toBe(false);

    await expect(
      withAgentTestingMode(async () => {
        expect(isAgentTestingMode()).toBe(true);
        throw new Error('test error');
      })
    ).rejects.toThrow('test error');

    expect(isAgentTestingMode()).toBe(false);
  });
});

describe('ProductionSafetyError', () => {
  it('should include operation and suggestion', () => {
    const error = new ProductionSafetyError(
      'Test message',
      'test operation',
      'Use test environment'
    );

    expect(error.message).toContain('PRODUCTION SAFETY BLOCK');
    expect(error.operation).toBe('test operation');
    expect(error.suggestion).toBe('Use test environment');
  });
});
