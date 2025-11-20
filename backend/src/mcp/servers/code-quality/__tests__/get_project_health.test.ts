import { PrismaClient } from '@prisma/client';
import { handler, tool } from '../get_project_health';

describe('get_project_health MCP tool', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    project: {
      findUnique: jest.fn(),
    },
    codeMetrics: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('get_project_health');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('health metrics');
    });

    it('should require projectId', () => {
      expect(tool.inputSchema.required).toContain('projectId');
    });

    it('should only have projectId as required', () => {
      expect(tool.inputSchema.required).toHaveLength(1);
    });
  });

  describe('handler - empty metrics case (ST-7 fix)', () => {
    const mockProject = {
      id: 'proj-test-001',
      name: 'Test Project',
    };

    it('should return valid JSON structure when no metrics exist', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue([]);

      const result = await handler(prisma, { projectId: mockProject.id });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const data = JSON.parse(result.content[0].text);
      expect(data).toBeDefined();
    });

    it('should return project info with zero totals when empty', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue([]);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.project.id).toBe(mockProject.id);
      expect(data.project.name).toBe(mockProject.name);
      expect(data.project.totalFiles).toBe(0);
      expect(data.project.totalLoc).toBe(0);
    });

    it('should return health score of 0 and Unknown rating when empty', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue([]);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.health.score).toBe(0);
      expect(data.health.rating).toBe('Unknown');
    });

    it('should return metrics with "No data" status when empty', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue([]);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.metrics.complexity.avg).toBe(0);
      expect(data.metrics.complexity.status).toBe('No data');
      expect(data.metrics.maintainability.avg).toBe(0);
      expect(data.metrics.maintainability.status).toBe('No data');
      expect(data.metrics.churn.avg).toBe(0);
      expect(data.metrics.churn.level).toBe('unknown');
      expect(data.metrics.codeSmells.total).toBe(0);
      expect(data.metrics.codeSmells.perFile).toBe(0);
    });

    it('should return empty arrays for folders, subfolders, and hotspots when empty', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue([]);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.folders).toEqual([]);
      expect(data.subfolders).toEqual([]);
      expect(data.criticalHotspots).toEqual([]);
    });

    it('should return informative insights when empty', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue([]);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.insights).toHaveLength(1);
      expect(data.insights[0]).toContain('No code metrics found');
      expect(data.insights[0]).toContain('CodeAnalysisWorker');
    });

    it('should return recommendation to run code analysis when empty', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue([]);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.recommendations).toHaveLength(1);
      expect(data.recommendations[0]).toContain('code analysis');
    });

    it('should return analysis metadata indicating no files analyzed', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue([]);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.analysis.analyzedBy).toBe('CodeAnalysisWorker');
      expect(data.analysis.lastUpdate).toBeNull();
      expect(data.analysis.dataSource).toBe('code_metrics table');
      expect(data.analysis.filesAnalyzed).toBe(0);
    });

    it('should NOT throw an error when metrics are empty (critical fix)', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue([]);

      await expect(handler(prisma, { projectId: mockProject.id })).resolves.toBeDefined();
    });
  });

  describe('handler - error cases', () => {
    it('should throw error when project does not exist', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(null);

      await expect(
        handler(prisma, { projectId: 'non-existent' })
      ).rejects.toThrow('Project not found: non-existent');
    });
  });

  describe('handler - with metrics data', () => {
    const mockProject = {
      id: 'proj-test-001',
      name: 'Test Project',
    };

    const mockMetrics = [
      {
        filePath: 'backend/src/auth/auth.service.ts',
        linesOfCode: 150,
        cyclomaticComplexity: 12,
        cognitiveComplexity: 18,
        maintainabilityIndex: 72,
        testCoverage: 85,
        churnRate: 4.5,
        churnCount: 15,
        riskScore: 45,
        codeSmellCount: 3,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      },
      {
        filePath: 'backend/src/users/users.service.ts',
        linesOfCode: 200,
        cyclomaticComplexity: 8,
        cognitiveComplexity: 12,
        maintainabilityIndex: 78,
        testCoverage: 90,
        churnRate: 2.0,
        churnCount: 8,
        riskScore: 25,
        codeSmellCount: 1,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      },
      {
        filePath: 'frontend/src/App.tsx',
        linesOfCode: 100,
        cyclomaticComplexity: 5,
        cognitiveComplexity: 8,
        maintainabilityIndex: 85,
        testCoverage: 70,
        churnRate: 6.0,
        churnCount: 20,
        riskScore: 30,
        codeSmellCount: 2,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      },
    ];

    it('should calculate correct project totals', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.project.totalFiles).toBe(3);
      expect(data.project.totalLoc).toBe(450); // 150 + 200 + 100
    });

    it('should calculate correct average complexity', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      // (12 + 8 + 5) / 3 = 8.33
      expect(data.metrics.complexity.avg).toBeCloseTo(8.3, 1);
      expect(data.metrics.complexity.status).toBe('OK');
    });

    it('should calculate correct average maintainability', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      // (72 + 78 + 85) / 3 = 78.33
      expect(data.metrics.maintainability.avg).toBeCloseTo(78, 0);
      expect(data.metrics.maintainability.status).toBe('Good');
    });

    it('should group metrics by top-level folder', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.folders).toHaveLength(2);

      const backendFolder = data.folders.find((f: any) => f.name === 'backend');
      const frontendFolder = data.folders.find((f: any) => f.name === 'frontend');

      expect(backendFolder).toBeDefined();
      expect(backendFolder.fileCount).toBe(2);
      expect(backendFolder.totalLoc).toBe(350);

      expect(frontendFolder).toBeDefined();
      expect(frontendFolder.fileCount).toBe(1);
      expect(frontendFolder.totalLoc).toBe(100);
    });

    it('should group metrics by subfolder (top 3 path segments)', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      // backend/src/auth, backend/src/users, frontend/src/App.tsx
      expect(data.subfolders.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate health score between 0 and 100', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.health.score).toBeGreaterThanOrEqual(0);
      expect(data.health.score).toBeLessThanOrEqual(100);
    });

    it('should assign correct health rating', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(['Good', 'Moderate', 'Poor']).toContain(data.health.rating);
    });

    it('should include lastAnalyzedAt timestamp in analysis', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockMetrics);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.analysis.lastUpdate).toBe('2025-01-15T10:00:00.000Z');
      expect(data.analysis.filesAnalyzed).toBe(3);
    });
  });

  describe('handler - hotspot detection', () => {
    const mockProject = {
      id: 'proj-test-001',
      name: 'Test Project',
    };

    it('should identify high-risk files as hotspots (risk > 60)', async () => {
      const mockMetricsWithHotspot = [
        {
          filePath: 'backend/src/complex/hotspot.service.ts',
          linesOfCode: 500,
          cyclomaticComplexity: 25,
          cognitiveComplexity: 40,
          maintainabilityIndex: 45,
          testCoverage: 30,
          churnRate: 10.0,
          churnCount: 50,
          riskScore: 85, // High risk
          codeSmellCount: 15,
          criticalIssues: 3,
          lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
          metadata: {},
        },
      ];

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockMetricsWithHotspot);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.criticalHotspots).toHaveLength(1);
      expect(data.criticalHotspots[0].filePath).toBe('backend/src/complex/hotspot.service.ts');
      expect(data.criticalHotspots[0].riskScore).toBe(85);
    });

    it('should limit hotspots to top 10', async () => {
      const mockMetricsWithManyHotspots = Array.from({ length: 15 }, (_, i) => ({
        filePath: `backend/src/hotspot${i}.ts`,
        linesOfCode: 100,
        cyclomaticComplexity: 20,
        cognitiveComplexity: 30,
        maintainabilityIndex: 40,
        testCoverage: 20,
        churnRate: 8.0,
        churnCount: 30,
        riskScore: 65 + i, // All above 60
        codeSmellCount: 10,
        criticalIssues: 2,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      }));

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockMetricsWithManyHotspots);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.criticalHotspots.length).toBeLessThanOrEqual(10);
    });
  });

  describe('handler - insights generation', () => {
    const mockProject = {
      id: 'proj-test-001',
      name: 'Test Project',
    };

    it('should generate critical warning for poor health score', async () => {
      const mockPoorHealthMetrics = [
        {
          filePath: 'backend/src/poor.ts',
          linesOfCode: 1000,
          cyclomaticComplexity: 30,
          cognitiveComplexity: 50,
          maintainabilityIndex: 35,
          testCoverage: 10,
          churnRate: 12.0,
          churnCount: 60,
          riskScore: 90,
          codeSmellCount: 25,
          criticalIssues: 10,
          lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
          metadata: {},
        },
      ];

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue(mockPoorHealthMetrics);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      // Should have critical or warning insight
      const hasWarningOrCritical = data.insights.some((insight: string) =>
        insight.includes('CRITICAL') || insight.includes('⚠️') || insight.includes('🚨')
      );
      expect(hasWarningOrCritical).toBe(true);
    });

    it('should generate recommendations based on metrics', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findMany.mockResolvedValue([
        {
          filePath: 'backend/src/test.ts',
          linesOfCode: 100,
          cyclomaticComplexity: 15, // High complexity
          cognitiveComplexity: 20,
          maintainabilityIndex: 60,
          testCoverage: 50,
          churnRate: 5.0,
          churnCount: 15,
          riskScore: 50,
          codeSmellCount: 5,
          criticalIssues: 0,
          lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
          metadata: {},
        },
      ]);

      const result = await handler(prisma, { projectId: mockProject.id });
      const data = JSON.parse(result.content[0].text);

      expect(data.recommendations.length).toBeGreaterThan(0);
    });
  });
});
