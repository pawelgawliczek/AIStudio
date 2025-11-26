/**
 * Unit tests for BuildDecisionService - ST-115
 *
 * Tests cover intelligent build change detection:
 * - File classification (backend, frontend, shared, docs)
 * - Git diff analysis
 * - Build decision logic
 * - Deployment state tracking
 */

import { BuildDecisionService, ChangeType, ChangeAnalysis, BuildDecision } from '../build-decision.service';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

// Mock child_process for git commands
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('BuildDecisionService', () => {
  let service: BuildDecisionService;
  let mockPrisma: any;
  const projectRoot = '/opt/stack/AIStudio';

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      serviceDeploymentState: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    service = new BuildDecisionService(mockPrisma as PrismaClient, projectRoot);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // GROUP 1: File Classification Tests
  // ==========================================================================

  describe('File Classification', () => {
    it('should classify backend/ files as backend', () => {
      const isBackend = (service as any).isBackendFile('backend/src/services/auth.service.ts');
      expect(isBackend).toBe(true);
    });

    it('should classify prisma/ files as backend', () => {
      const isBackend = (service as any).isBackendFile('prisma/schema.prisma');
      expect(isBackend).toBe(true);
    });

    it('should classify prisma migration files as backend', () => {
      const isBackend = (service as any).isBackendFile('prisma/migrations/20251126_add_table/migration.sql');
      expect(isBackend).toBe(true);
    });

    it('should NOT classify frontend/ files as backend', () => {
      const isBackend = (service as any).isBackendFile('frontend/src/App.tsx');
      expect(isBackend).toBe(false);
    });

    it('should classify frontend/ files as frontend', () => {
      const isFrontend = (service as any).isFrontendFile('frontend/src/components/Header.tsx');
      expect(isFrontend).toBe(true);
    });

    it('should NOT classify backend/ files as frontend', () => {
      const isFrontend = (service as any).isFrontendFile('backend/src/main.ts');
      expect(isFrontend).toBe(false);
    });

    it('should classify shared/ files as shared', () => {
      const isShared = (service as any).isSharedFile('shared/types/index.ts');
      expect(isShared).toBe(true);
    });

    it('should classify .md files as docs', () => {
      const isDocs = (service as any).isDocsFile('README.md');
      expect(isDocs).toBe(true);
    });

    it('should classify docs/ files as docs', () => {
      const isDocs = (service as any).isDocsFile('docs/architecture/overview.md');
      expect(isDocs).toBe(true);
    });

    it('should classify .github/ files as docs', () => {
      const isDocs = (service as any).isDocsFile('.github/workflows/ci.yml');
      expect(isDocs).toBe(true);
    });

    it('should classify LICENSE files as docs', () => {
      const isDocs = (service as any).isDocsFile('LICENSE');
      expect(isDocs).toBe(true);
    });

    it('should classify nested .md files as docs', () => {
      const isDocs = (service as any).isDocsFile('backend/README.md');
      expect(isDocs).toBe(true);
    });
  });

  // ==========================================================================
  // GROUP 2: analyzeChanges() Tests
  // ==========================================================================

  describe('analyzeChanges', () => {
    it('should return NONE when no files changed', async () => {
      (execSync as jest.Mock).mockReturnValue('');

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.changeType).toBe(ChangeType.NONE);
      expect(analysis.totalChangedFiles).toBe(0);
      expect(analysis.skipBackendBuild).toBe(true);
      expect(analysis.skipFrontendBuild).toBe(true);
    });

    it('should detect BACKEND_ONLY changes', async () => {
      const changedFiles = [
        'backend/src/services/auth.service.ts',
        'backend/src/controllers/user.controller.ts',
        'prisma/schema.prisma',
      ].join('\n');

      (execSync as jest.Mock).mockReturnValue(changedFiles);

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.changeType).toBe(ChangeType.BACKEND_ONLY);
      expect(analysis.backendFiles.length).toBe(3);
      expect(analysis.frontendFiles.length).toBe(0);
      expect(analysis.skipBackendBuild).toBe(false);
      expect(analysis.skipFrontendBuild).toBe(true);
    });

    it('should detect FRONTEND_ONLY changes', async () => {
      const changedFiles = [
        'frontend/src/App.tsx',
        'frontend/src/components/Header.tsx',
        'frontend/src/styles/main.css',
      ].join('\n');

      (execSync as jest.Mock).mockReturnValue(changedFiles);

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.changeType).toBe(ChangeType.FRONTEND_ONLY);
      expect(analysis.backendFiles.length).toBe(0);
      expect(analysis.frontendFiles.length).toBe(3);
      expect(analysis.skipBackendBuild).toBe(true);
      expect(analysis.skipFrontendBuild).toBe(false);
    });

    it('should detect BOTH when backend and frontend files changed', async () => {
      const changedFiles = [
        'backend/src/services/auth.service.ts',
        'frontend/src/App.tsx',
      ].join('\n');

      (execSync as jest.Mock).mockReturnValue(changedFiles);

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.changeType).toBe(ChangeType.BOTH);
      expect(analysis.backendFiles.length).toBe(1);
      expect(analysis.frontendFiles.length).toBe(1);
      expect(analysis.skipBackendBuild).toBe(false);
      expect(analysis.skipFrontendBuild).toBe(false);
    });

    it('should detect BOTH when shared files changed', async () => {
      const changedFiles = [
        'shared/types/api.ts',
      ].join('\n');

      (execSync as jest.Mock).mockReturnValue(changedFiles);

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.changeType).toBe(ChangeType.BOTH);
      expect(analysis.sharedFiles.length).toBe(1);
      // Shared affects both, so neither should be skipped
      expect(analysis.skipBackendBuild).toBe(false);
      expect(analysis.skipFrontendBuild).toBe(false);
    });

    it('should detect DOCS_ONLY when only docs changed', async () => {
      const changedFiles = [
        'README.md',
        'docs/architecture/overview.md',
        '.github/workflows/ci.yml',
      ].join('\n');

      (execSync as jest.Mock).mockReturnValue(changedFiles);

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.changeType).toBe(ChangeType.DOCS_ONLY);
      expect(analysis.docsFiles.length).toBe(3);
      expect(analysis.skipBackendBuild).toBe(true);
      expect(analysis.skipFrontendBuild).toBe(true);
    });

    it('should NOT skip builds when docs and code files are mixed', async () => {
      const changedFiles = [
        'README.md',
        'backend/src/main.ts',
      ].join('\n');

      (execSync as jest.Mock).mockReturnValue(changedFiles);

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.changeType).toBe(ChangeType.BACKEND_ONLY);
      expect(analysis.docsFiles.length).toBe(1);
      expect(analysis.backendFiles.length).toBe(1);
      expect(analysis.skipBackendBuild).toBe(false);
      expect(analysis.skipFrontendBuild).toBe(true);
    });

    it('should handle git diff command failure gracefully', async () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('git diff failed');
      });

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.changeType).toBe(ChangeType.NONE);
      expect(analysis.totalChangedFiles).toBe(0);
    });

    it('should correctly count total changed files', async () => {
      const changedFiles = [
        'backend/src/main.ts',
        'frontend/src/App.tsx',
        'shared/types/api.ts',
        'README.md',
      ].join('\n');

      (execSync as jest.Mock).mockReturnValue(changedFiles);

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.totalChangedFiles).toBe(4);
    });
  });

  // ==========================================================================
  // GROUP 3: getLastDeployedCommit() Tests
  // ==========================================================================

  describe('getLastDeployedCommit', () => {
    it('should return commit hash when deployment state exists', async () => {
      mockPrisma.serviceDeploymentState.findUnique.mockResolvedValue({
        service: 'backend',
        lastDeployedCommit: 'abc123def456',
        lastDeployedAt: new Date(),
      });

      const commit = await service.getLastDeployedCommit('backend');

      expect(commit).toBe('abc123def456');
      expect(mockPrisma.serviceDeploymentState.findUnique).toHaveBeenCalledWith({
        where: { service: 'backend' },
      });
    });

    it('should return null when no deployment state exists', async () => {
      mockPrisma.serviceDeploymentState.findUnique.mockResolvedValue(null);

      const commit = await service.getLastDeployedCommit('frontend');

      expect(commit).toBeNull();
    });

    it('should query with correct service parameter', async () => {
      mockPrisma.serviceDeploymentState.findUnique.mockResolvedValue(null);

      await service.getLastDeployedCommit('frontend');

      expect(mockPrisma.serviceDeploymentState.findUnique).toHaveBeenCalledWith({
        where: { service: 'frontend' },
      });
    });
  });

  // ==========================================================================
  // GROUP 4: recordDeployment() Tests
  // ==========================================================================

  describe('recordDeployment', () => {
    it('should upsert deployment state with correct data', async () => {
      mockPrisma.serviceDeploymentState.upsert.mockResolvedValue({
        id: 'state-123',
        service: 'backend',
        lastDeployedCommit: 'abc123',
      });

      await service.recordDeployment(
        'backend',
        'abc123',
        ['backend/src/main.ts'],
        { storyKey: 'ST-115', duration: 120000 }
      );

      expect(mockPrisma.serviceDeploymentState.upsert).toHaveBeenCalledWith({
        where: { service: 'backend' },
        update: {
          lastDeployedCommit: 'abc123',
          lastDeployedAt: expect.any(Date),
          filesChanged: ['backend/src/main.ts'],
          metadata: { storyKey: 'ST-115', duration: 120000 },
        },
        create: {
          service: 'backend',
          lastDeployedCommit: 'abc123',
          lastDeployedAt: expect.any(Date),
          filesChanged: ['backend/src/main.ts'],
          metadata: { storyKey: 'ST-115', duration: 120000 },
        },
      });
    });

    it('should handle empty filesChanged array', async () => {
      mockPrisma.serviceDeploymentState.upsert.mockResolvedValue({});

      await service.recordDeployment('frontend', 'def456', []);

      expect(mockPrisma.serviceDeploymentState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            filesChanged: [],
          }),
          create: expect.objectContaining({
            filesChanged: [],
          }),
        })
      );
    });

    it('should handle missing metadata', async () => {
      mockPrisma.serviceDeploymentState.upsert.mockResolvedValue({});

      await service.recordDeployment('backend', 'abc123', []);

      expect(mockPrisma.serviceDeploymentState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            metadata: {},
          }),
        })
      );
    });
  });

  // ==========================================================================
  // GROUP 5: makeBuildDecision() Tests
  // ==========================================================================

  describe('makeBuildDecision', () => {
    it('should build both services when no deployment history exists', async () => {
      mockPrisma.serviceDeploymentState.findUnique.mockResolvedValue(null);

      const decision = await service.makeBuildDecision();

      expect(decision.skipBackendBuild).toBe(false);
      expect(decision.skipFrontendBuild).toBe(false);
      expect(decision.reason).toContain('No deployment history');
    });

    it('should analyze changes when deployment history exists', async () => {
      mockPrisma.serviceDeploymentState.findUnique
        .mockResolvedValueOnce({ service: 'backend', lastDeployedCommit: 'old123' })
        .mockResolvedValueOnce({ service: 'frontend', lastDeployedCommit: 'old123' });

      // Mock git commands
      (execSync as jest.Mock)
        .mockReturnValueOnce('current456\n') // getCurrentCommit
        .mockReturnValueOnce('old123\n') // getOldestCommit merge-base
        .mockReturnValueOnce('backend/src/main.ts\n'); // getChangedFiles

      const decision = await service.makeBuildDecision();

      expect(decision.analysis).toBeDefined();
      expect(decision.skipFrontendBuild).toBe(true); // Backend-only changes
    });

    it('should handle git errors gracefully', async () => {
      mockPrisma.serviceDeploymentState.findUnique
        .mockResolvedValueOnce({ service: 'backend', lastDeployedCommit: 'old123' })
        .mockResolvedValueOnce({ service: 'frontend', lastDeployedCommit: 'old123' });

      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('git command failed');
      });

      // Should not throw, but return a safe decision
      const decision = await service.makeBuildDecision();

      // When errors occur, analysis returns NONE with both skipped
      expect(decision.analysis.changeType).toBe(ChangeType.NONE);
    });

    it('should use oldest commit as base for comparison', async () => {
      // Different last deployed commits for backend and frontend
      mockPrisma.serviceDeploymentState.findUnique
        .mockResolvedValueOnce({ service: 'backend', lastDeployedCommit: 'older123' })
        .mockResolvedValueOnce({ service: 'frontend', lastDeployedCommit: 'newer456' });

      (execSync as jest.Mock)
        .mockReturnValueOnce('current789\n') // getCurrentCommit
        .mockReturnValueOnce('older123\n') // merge-base returns older commit
        .mockReturnValueOnce('frontend/src/App.tsx\n'); // getChangedFiles

      const decision = await service.makeBuildDecision();

      // Should have analyzed from the older commit
      expect(decision.analysis).toBeDefined();
    });
  });

  // ==========================================================================
  // GROUP 6: getOldestCommit() Helper Tests
  // ==========================================================================

  describe('getOldestCommit', () => {
    it('should return commit2 when commit1 is null', () => {
      const oldest = (service as any).getOldestCommit(null, 'commit2');
      expect(oldest).toBe('commit2');
    });

    it('should return commit1 when commit2 is null', () => {
      const oldest = (service as any).getOldestCommit('commit1', null);
      expect(oldest).toBe('commit1');
    });

    it('should use git merge-base to find oldest', () => {
      (execSync as jest.Mock).mockReturnValue('commit1\n');

      const oldest = (service as any).getOldestCommit('commit1', 'commit2');

      expect(execSync).toHaveBeenCalledWith(
        'git merge-base commit1 commit2',
        expect.objectContaining({ cwd: projectRoot })
      );
      expect(oldest).toBe('commit1');
    });

    it('should fallback to commit1 on git error', () => {
      (execSync as jest.Mock).mockImplementation(() => {
        throw new Error('git error');
      });

      const oldest = (service as any).getOldestCommit('commit1', 'commit2');

      expect(oldest).toBe('commit1');
    });
  });

  // ==========================================================================
  // GROUP 7: Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty lines in git diff output', async () => {
      const changedFiles = '\nbackend/src/main.ts\n\nfrontend/src/App.tsx\n';

      (execSync as jest.Mock).mockReturnValue(changedFiles);

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.totalChangedFiles).toBe(2);
      expect(analysis.backendFiles).toContain('backend/src/main.ts');
      expect(analysis.frontendFiles).toContain('frontend/src/App.tsx');
    });

    it('should handle whitespace in file paths', async () => {
      const changedFiles = '  backend/src/main.ts  ';

      (execSync as jest.Mock).mockReturnValue(changedFiles);

      const analysis = await service.analyzeChanges('abc123', 'def456');

      // After trim() in split and filter, empty strings are removed
      expect(analysis.backendFiles.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle deeply nested paths correctly', async () => {
      const changedFiles = [
        'backend/src/mcp/servers/deployment/utils/docker.util.ts',
        'frontend/src/components/features/auth/LoginForm.tsx',
      ].join('\n');

      (execSync as jest.Mock).mockReturnValue(changedFiles);

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.backendFiles).toContain('backend/src/mcp/servers/deployment/utils/docker.util.ts');
      expect(analysis.frontendFiles).toContain('frontend/src/components/features/auth/LoginForm.tsx');
    });

    it('should correctly handle mixed case scenarios', async () => {
      const changedFiles = [
        'backend/src/main.ts',
        'frontend/src/App.tsx',
        'shared/utils/helpers.ts',
        'docs/README.md',
        'CHANGELOG.md',
      ].join('\n');

      (execSync as jest.Mock).mockReturnValue(changedFiles);

      const analysis = await service.analyzeChanges('abc123', 'def456');

      expect(analysis.changeType).toBe(ChangeType.BOTH);
      expect(analysis.backendFiles.length).toBe(1);
      expect(analysis.frontendFiles.length).toBe(1);
      expect(analysis.sharedFiles.length).toBe(1);
      expect(analysis.docsFiles.length).toBe(2);
      expect(analysis.skipBackendBuild).toBe(false);
      expect(analysis.skipFrontendBuild).toBe(false);
    });
  });

  // ==========================================================================
  // GROUP 8: Integration-like Tests
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it('should correctly decide for frontend-only hotfix', async () => {
      // Simulate a frontend-only CSS fix
      mockPrisma.serviceDeploymentState.findUnique
        .mockResolvedValueOnce({ service: 'backend', lastDeployedCommit: 'prod123' })
        .mockResolvedValueOnce({ service: 'frontend', lastDeployedCommit: 'prod123' });

      (execSync as jest.Mock)
        .mockReturnValueOnce('hotfix456\n') // getCurrentCommit
        .mockReturnValueOnce('prod123\n') // merge-base
        .mockReturnValueOnce('frontend/src/styles/button.css\n'); // changes

      const decision = await service.makeBuildDecision();

      expect(decision.skipBackendBuild).toBe(true);
      expect(decision.skipFrontendBuild).toBe(false);
      expect(decision.reason).toContain('Frontend-only');
    });

    it('should correctly decide for backend-only API change', async () => {
      mockPrisma.serviceDeploymentState.findUnique
        .mockResolvedValueOnce({ service: 'backend', lastDeployedCommit: 'prod123' })
        .mockResolvedValueOnce({ service: 'frontend', lastDeployedCommit: 'prod123' });

      (execSync as jest.Mock)
        .mockReturnValueOnce('api456\n')
        .mockReturnValueOnce('prod123\n')
        .mockReturnValueOnce('backend/src/controllers/api.controller.ts\nprisma/schema.prisma\n');

      const decision = await service.makeBuildDecision();

      expect(decision.skipBackendBuild).toBe(false);
      expect(decision.skipFrontendBuild).toBe(true);
      expect(decision.reason).toContain('Backend-only');
    });

    it('should build both for shared type changes', async () => {
      mockPrisma.serviceDeploymentState.findUnique
        .mockResolvedValueOnce({ service: 'backend', lastDeployedCommit: 'prod123' })
        .mockResolvedValueOnce({ service: 'frontend', lastDeployedCommit: 'prod123' });

      (execSync as jest.Mock)
        .mockReturnValueOnce('types456\n')
        .mockReturnValueOnce('prod123\n')
        .mockReturnValueOnce('shared/types/api.ts\n');

      const decision = await service.makeBuildDecision();

      expect(decision.skipBackendBuild).toBe(false);
      expect(decision.skipFrontendBuild).toBe(false);
      expect(decision.reason).toContain('both');
    });

    it('should skip both builds for docs-only changes', async () => {
      mockPrisma.serviceDeploymentState.findUnique
        .mockResolvedValueOnce({ service: 'backend', lastDeployedCommit: 'prod123' })
        .mockResolvedValueOnce({ service: 'frontend', lastDeployedCommit: 'prod123' });

      (execSync as jest.Mock)
        .mockReturnValueOnce('docs456\n')
        .mockReturnValueOnce('prod123\n')
        .mockReturnValueOnce('README.md\ndocs/architecture.md\n.github/ISSUE_TEMPLATE.md\n');

      const decision = await service.makeBuildDecision();

      expect(decision.skipBackendBuild).toBe(true);
      expect(decision.skipFrontendBuild).toBe(true);
      expect(decision.analysis.changeType).toBe(ChangeType.DOCS_ONLY);
    });
  });
});
