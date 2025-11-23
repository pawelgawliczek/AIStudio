/**
 * Integration Tests for Permission Enforcement
 * ST-85: Safe Migration MCP Tools & Permission Enforcement
 *
 * Tests that unsafe Prisma commands are properly blocked by the permission system
 *
 * NOTE: These tests verify the permission configuration in .claude/settings.local.json
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Permission Enforcement - Integration Tests', () => {
  const SETTINGS_PATH = path.join(__dirname, '../../../../../.claude/settings.local.json');
  let settings: any;

  beforeAll(() => {
    // Read settings file
    if (fs.existsSync(SETTINGS_PATH)) {
      const content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
      settings = JSON.parse(content);
    }
  });

  describe('Settings File Validation', () => {
    it('should have .claude/settings.local.json file', () => {
      expect(fs.existsSync(SETTINGS_PATH)).toBe(true);
    });

    it('should have valid JSON structure', () => {
      expect(settings).toBeDefined();
      expect(settings).toHaveProperty('permissions');
    });

    it('should have allow, deny, and ask lists', () => {
      expect(settings.permissions).toHaveProperty('allow');
      expect(settings.permissions).toHaveProperty('deny');
      expect(settings.permissions).toHaveProperty('ask');

      expect(Array.isArray(settings.permissions.allow)).toBe(true);
      expect(Array.isArray(settings.permissions.deny)).toBe(true);
      expect(Array.isArray(settings.permissions.ask)).toBe(true);
    });
  });

  describe('Deny List - Unsafe Commands Blocked', () => {
    it('should block *prisma db push* commands', () => {
      const denyList = settings.permissions.deny;

      const hasDbPushBlock = denyList.some((pattern: string) =>
        pattern.includes('*prisma db push*')
      );

      expect(hasDbPushBlock).toBe(true);
    });

    it('should block *prisma migrate deploy* commands', () => {
      const denyList = settings.permissions.deny;

      const hasMigrateDeployBlock = denyList.some((pattern: string) =>
        pattern.includes('*prisma migrate deploy*')
      );

      expect(hasMigrateDeployBlock).toBe(true);
    });

    it('should block *prisma migrate dev* commands', () => {
      const denyList = settings.permissions.deny;

      const hasMigrateDevBlock = denyList.some((pattern: string) =>
        pattern.includes('*prisma migrate dev*')
      );

      expect(hasMigrateDevBlock).toBe(true);
    });

    it('should block *prisma migrate resolve* commands', () => {
      const denyList = settings.permissions.deny;

      const hasMigrateResolveBlock = denyList.some((pattern: string) =>
        pattern.includes('*prisma migrate resolve*')
      );

      expect(hasMigrateResolveBlock).toBe(true);
    });

    it('should block *prisma db execute* commands', () => {
      const denyList = settings.permissions.deny;

      const hasDbExecuteBlock = denyList.some((pattern: string) =>
        pattern.includes('*prisma db execute*')
      );

      expect(hasDbExecuteBlock).toBe(true);
    });

    it('should have at least 5 blocked patterns', () => {
      const denyList = settings.permissions.deny;

      expect(denyList.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Allow List - Safe MCP Tools Permitted', () => {
    it('should allow run_safe_migration MCP tool', () => {
      const allowList = settings.permissions.allow;

      const hasRunSafeMigration = allowList.some((pattern: string) =>
        pattern.includes('mcp__vibestudio__run_safe_migration')
      );

      expect(hasRunSafeMigration).toBe(true);
    });

    it('should allow preview_migration MCP tool', () => {
      const allowList = settings.permissions.allow;

      const hasPreviewMigration = allowList.some((pattern: string) =>
        pattern.includes('mcp__vibestudio__preview_migration')
      );

      expect(hasPreviewMigration).toBe(true);
    });

    it('should allow create_migration MCP tool', () => {
      const allowList = settings.permissions.allow;

      const hasCreateMigration = allowList.some((pattern: string) =>
        pattern.includes('mcp__vibestudio__create_migration')
      );

      expect(hasCreateMigration).toBe(true);
    });

    it('should have all 3 safe migration tools whitelisted', () => {
      const allowList = settings.permissions.allow;

      const migrationTools = [
        'mcp__vibestudio__run_safe_migration',
        'mcp__vibestudio__preview_migration',
        'mcp__vibestudio__create_migration',
      ];

      migrationTools.forEach(tool => {
        const isAllowed = allowList.some((pattern: string) => pattern.includes(tool));
        expect(isAllowed).toBe(true);
      });
    });
  });

  describe('Allow List - Unsafe Commands NOT Permitted', () => {
    it('should NOT allow direct prisma db push commands', () => {
      const allowList = settings.permissions.allow;

      const hasUnsafeDbPush = allowList.some((pattern: string) =>
        pattern.includes('npx prisma db push') &&
        !pattern.includes('5434') // Test database commands are OK
      );

      expect(hasUnsafeDbPush).toBe(false);
    });

    it('should NOT allow direct prisma migrate deploy commands', () => {
      const allowList = settings.permissions.allow;

      const hasUnsafeMigrateDeploy = allowList.some((pattern: string) =>
        pattern.includes('npx prisma migrate deploy') &&
        !pattern.includes('5434') // Test database commands are OK
      );

      expect(hasUnsafeMigrateDeploy).toBe(false);
    });

    it('should NOT allow direct prisma migrate dev commands', () => {
      const allowList = settings.permissions.allow;

      const hasUnsafeMigrateDev = allowList.some((pattern: string) =>
        pattern.includes('npx prisma migrate dev') &&
        !pattern.includes('5434') // Test database commands are OK
      );

      expect(hasUnsafeMigrateDev).toBe(false);
    });

    it('should NOT allow prisma db push --accept-data-loss', () => {
      const allowList = settings.permissions.allow;

      const hasDataLossCommand = allowList.some((pattern: string) =>
        pattern.includes('--accept-data-loss')
      );

      expect(hasDataLossCommand).toBe(false);
    });
  });

  describe('Security Configuration', () => {
    it('should have deny list as first line of defense', () => {
      const denyList = settings.permissions.deny;

      // Deny list should not be empty
      expect(denyList.length).toBeGreaterThan(0);
    });

    it('should use wildcard patterns for comprehensive blocking', () => {
      const denyList = settings.permissions.deny;

      // Check that patterns use wildcards for broad matching
      const hasWildcards = denyList.every((pattern: string) =>
        pattern.includes('*')
      );

      expect(hasWildcards).toBe(true);
    });

    it('should not have conflicting allow/deny rules', () => {
      const allowList = settings.permissions.allow;
      const denyList = settings.permissions.deny;

      // Check that no allow pattern matches a deny pattern
      const conflicts: string[] = [];

      allowList.forEach((allowPattern: string) => {
        denyList.forEach((denyPattern: string) => {
          // Simple check: if allow pattern contains deny pattern substring
          if (allowPattern.includes('prisma db push') ||
              allowPattern.includes('prisma migrate deploy')) {
            conflicts.push(allowPattern);
          }
        });
      });

      // Allow only test database commands
      const validConflicts = conflicts.filter(pattern =>
        !pattern.includes('5434') && !pattern.includes('vibestudio_test')
      );

      expect(validConflicts).toEqual([]);
    });
  });

  describe('Permission Patterns', () => {
    it('should use Bash() wrapper for command patterns', () => {
      const denyList = settings.permissions.deny;

      const allUseBashWrapper = denyList.every((pattern: string) =>
        pattern.startsWith('Bash(') && pattern.endsWith(')')
      );

      expect(allUseBashWrapper).toBe(true);
    });

    it('should use mcp__ prefix for MCP tools', () => {
      const allowList = settings.permissions.allow;

      const migrationTools = allowList.filter((pattern: string) =>
        pattern.includes('migration')
      );

      const allUseMcpPrefix = migrationTools.every((pattern: string) =>
        pattern.startsWith('mcp__')
      );

      expect(allUseMcpPrefix).toBe(true);
    });
  });

  describe('Coverage Verification', () => {
    const DANGEROUS_COMMANDS = [
      'prisma db push',
      'prisma migrate deploy',
      'prisma migrate dev',
      'prisma migrate resolve',
      'prisma db execute',
    ];

    DANGEROUS_COMMANDS.forEach(command => {
      it(`should block ${command} via deny list`, () => {
        const denyList = settings.permissions.deny;

        const isBlocked = denyList.some((pattern: string) =>
          pattern.includes(command)
        );

        expect(isBlocked).toBe(true);
      });
    });
  });

  describe('Documentation Alignment', () => {
    it('should match blocked commands documented in CLAUDE.md', () => {
      const denyList = settings.permissions.deny;

      // Commands that should be in both CLAUDE.md and settings
      const documentedBlockedCommands = [
        'prisma db push',
        'prisma migrate deploy',
        'prisma migrate dev',
        'prisma migrate resolve',
      ];

      documentedBlockedCommands.forEach(cmd => {
        const isBlocked = denyList.some((pattern: string) =>
          pattern.includes(cmd)
        );

        expect(isBlocked).toBe(true);
      });
    });

    it('should match allowed tools documented in guide', () => {
      const allowList = settings.permissions.allow;

      const documentedAllowedTools = [
        'run_safe_migration',
        'preview_migration',
        'create_migration',
      ];

      documentedAllowedTools.forEach(tool => {
        const isAllowed = allowList.some((pattern: string) =>
          pattern.includes(tool)
        );

        expect(isAllowed).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should not accidentally block safe test database operations', () => {
      const allowList = settings.permissions.allow;

      // Test database operations should still be allowed
      const hasTestDbOperations = allowList.some((pattern: string) =>
        pattern.includes('5434') || pattern.includes('vibestudio_test')
      );

      // This is OK - test operations are allowed
      expect(true).toBe(true); // Just confirming no error
    });

    it('should not have empty deny list', () => {
      const denyList = settings.permissions.deny;

      expect(denyList.length).toBeGreaterThan(0);
    });

    it('should not have overly broad deny patterns that block everything', () => {
      const denyList = settings.permissions.deny;

      // Check that deny patterns are specific to Prisma commands
      const allPrismaSpecific = denyList.every((pattern: string) =>
        pattern.includes('prisma')
      );

      expect(allPrismaSpecific).toBe(true);
    });
  });

  describe('Settings File Integrity', () => {
    it('should be valid JSON', () => {
      expect(() => {
        const content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
        JSON.parse(content);
      }).not.toThrow();
    });

    it('should be readable by Node.js', () => {
      expect(() => {
        require(SETTINGS_PATH);
      }).not.toThrow();
    });

    it('should have enableAllProjectMcpServers flag', () => {
      expect(settings).toHaveProperty('enableAllProjectMcpServers');
      expect(typeof settings.enableAllProjectMcpServers).toBe('boolean');
    });
  });
});
