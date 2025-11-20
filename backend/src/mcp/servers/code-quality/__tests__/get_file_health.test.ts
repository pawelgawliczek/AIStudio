import { PrismaClient } from '@prisma/client';
import { handler, tool } from '../get_file_health';

/**
 * ST-28: Tests for get_file_health MCP Tool
 *
 * COVERAGE REQUIREMENTS (from baAnalysis):
 * - BR-1: Formula Standardization - verify stored risk score is used
 * - BR-2: Historical Data Integrity - verify fallback calculation when null
 * - BR-CALC-002: Risk Score Retrieval - read from database without recalculation
 * - BR-CALC-003: Exception Handling - recalculate only if stored value is NULL
 *
 * EDGE CASES (from baAnalysis):
 * - Zero risk scores (complexity=0, churn=0, maintainability=100)
 * - Risk score > 100 (capped values)
 * - NULL risk scores (backward compatibility)
 * - Test files vs source files
 */
describe('get_file_health MCP tool (ST-28)', () => {
  let prisma: PrismaClient;

  const mockPrismaClient = {
    project: {
      findUnique: jest.fn(),
    },
    codeMetrics: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    prisma = mockPrismaClient as any;
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('get_file_health');
    });

    it('should have description', () => {
      expect(tool.description).toBeDefined();
      expect(tool.description).toContain('health metrics');
    });

    it('should require projectId and filePath', () => {
      expect(tool.inputSchema.required).toContain('projectId');
      expect(tool.inputSchema.required).toContain('filePath');
    });
  });

  describe('handler - error cases', () => {
    it('should throw error when project does not exist', async () => {
      mockPrismaClient.project.findUnique.mockResolvedValue(null);

      await expect(
        handler(prisma, { projectId: 'non-existent', filePath: 'test.ts' })
      ).rejects.toThrow('Project not found: non-existent');
    });

    it('should throw error when file has not been analyzed', async () => {
      const mockProject = {
        id: 'proj-test-001',
        name: 'Test Project',
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(null);

      await expect(
        handler(prisma, {
          projectId: mockProject.id,
          filePath: 'unanalyzed-file.ts',
        })
      ).rejects.toThrow('File "unanalyzed-file.ts" not found or not analyzed');
    });
  });

  /**
   * ST-28 CRITICAL TEST: Verify stored risk score is used (BR-CALC-002)
   * This is the PRIMARY acceptance criterion for ST-28
   */
  describe('Risk Score Retrieval (ST-28 BR-CALC-002)', () => {
    const mockProject = {
      id: 'proj-test-001',
      name: 'Test Project',
    };

    it('should use stored risk score from database (not recalculate)', async () => {
      // This test validates the ST-28 fix: MCP tool should READ stored value
      const mockMetric = {
        filePath: 'backend/src/auth/auth.service.ts',
        linesOfCode: 150,
        cyclomaticComplexity: 20,
        cognitiveComplexity: 30,
        maintainabilityIndex: 60,
        testCoverage: 85,
        churnRate: 5,
        churnCount: 15,
        riskScore: 100, // Stored value (canonical formula result)
        codeSmellCount: 3,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      // CRITICAL ASSERTION: Should use stored value (100)
      expect(data.risk.score).toBe(100);

      // Should NOT use old formula result (40)
      const oldFormulaResult = Math.min(
        100,
        (mockMetric.cyclomaticComplexity *
          mockMetric.churnRate *
          (100 - mockMetric.maintainabilityIndex)) /
          100
      );
      expect(oldFormulaResult).toBe(40); // Old formula
      expect(data.risk.score).not.toBe(oldFormulaResult); // Verify different from old
    });

    it('should fallback to calculation only if riskScore is NULL (BR-CALC-003)', async () => {
      // Test backward compatibility: Legacy records with NULL riskScore
      const mockMetric = {
        filePath: 'backend/src/legacy/old-file.ts',
        linesOfCode: 100,
        cyclomaticComplexity: 20,
        cognitiveComplexity: 25,
        maintainabilityIndex: 60,
        testCoverage: 50,
        churnRate: 5,
        churnCount: 10,
        riskScore: null, // Legacy record - not yet migrated
        codeSmellCount: 2,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      // Should recalculate using canonical formula when NULL
      // Expected: round((20 / 10) × 5 × 40) = round(400) = 400 → capped at 100
      expect(data.risk.score).toBe(100);
    });

    it('should use stored risk score of 0 without recalculation', async () => {
      // Edge case: File with legitimately zero risk (don't confuse with NULL)
      const mockMetric = {
        filePath: 'backend/src/simple/trivial.ts',
        linesOfCode: 10,
        cyclomaticComplexity: 1,
        cognitiveComplexity: 1,
        maintainabilityIndex: 100,
        testCoverage: 100,
        churnRate: 0,
        churnCount: 0,
        riskScore: 0, // Stored zero (not NULL)
        codeSmellCount: 0,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      // Should use stored zero, not recalculate
      expect(data.risk.score).toBe(0);
    });
  });

  /**
   * ST-28: Formula Consistency Tests
   * Verify MCP tool fallback formula matches worker formula exactly
   */
  describe('Formula Consistency (ST-28 BR-1)', () => {
    const mockProject = {
      id: 'proj-test-001',
      name: 'Test Project',
    };

    /**
     * Helper: Calculate expected risk score using canonical formula
     * This replicates the worker's calculation logic from code-analysis.processor.ts
     */
    function calculateExpectedRiskScore(
      complexity: number,
      churn: number,
      maintainability: number
    ): number {
      const rawRiskScore = Math.round(
        (complexity / 10) * churn * (100 - maintainability)
      );
      return Math.max(0, Math.min(100, rawRiskScore));
    }

    it('should calculate fallback risk score using canonical formula', async () => {
      // When riskScore is NULL, verify fallback calculation matches worker formula
      const testCases = [
        { c: 20, h: 5, m: 60, expected: 100 }, // Example from ST-28
        { c: 10, h: 2, m: 80, expected: 4 }, // Low risk
        { c: 50, h: 10, m: 30, expected: 100 }, // Capped at 100
        { c: 0, h: 5, m: 60, expected: 0 }, // Zero complexity
        { c: 20, h: 0, m: 60, expected: 0 }, // Zero churn
      ];

      for (const { c, h, m, expected } of testCases) {
        const mockMetric = {
          filePath: `test-${c}-${h}-${m}.ts`,
          linesOfCode: 100,
          cyclomaticComplexity: c,
          cognitiveComplexity: 15,
          maintainabilityIndex: m,
          testCoverage: 80,
          churnRate: h,
          churnCount: h * 3,
          riskScore: null, // Force fallback calculation
          codeSmellCount: 1,
          criticalIssues: 0,
          lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
          metadata: {},
        };

        mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
        mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

        const result = await handler(prisma, {
          projectId: mockProject.id,
          filePath: mockMetric.filePath,
        });

        const data = JSON.parse(result.content[0].text);

        // Verify fallback calculation matches canonical formula
        expect(data.risk.score).toBe(expected);
        expect(data.risk.score).toBe(calculateExpectedRiskScore(c, h, m));
      }
    });

    it('should cap fallback risk score at 100 for extreme values', async () => {
      const mockMetric = {
        filePath: 'backend/src/complex/extremely-risky.ts',
        linesOfCode: 1000,
        cyclomaticComplexity: 50, // Very high
        cognitiveComplexity: 80,
        maintainabilityIndex: 0, // Worst case
        testCoverage: 0,
        churnRate: 20, // Frequent changes
        churnCount: 60,
        riskScore: null, // Force calculation
        codeSmellCount: 30,
        criticalIssues: 10,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      // Raw calculation: (50/10) × 20 × 100 = 10,000
      // Should be capped at 100
      expect(data.risk.score).toBe(100);
      expect(data.risk.score).toBeLessThanOrEqual(100);
    });
  });

  /**
   * ST-28: Edge Case Tests (from baAnalysis)
   */
  describe('Edge Cases (ST-28)', () => {
    const mockProject = {
      id: 'proj-test-001',
      name: 'Test Project',
    };

    it('should handle zero churn edge case (BR Edge Case 3)', async () => {
      const mockMetric = {
        filePath: 'backend/src/new/fresh-file.ts',
        linesOfCode: 100,
        cyclomaticComplexity: 20,
        cognitiveComplexity: 25,
        maintainabilityIndex: 60,
        testCoverage: 80,
        churnRate: 0, // New file, no history
        churnCount: 0,
        riskScore: 0, // Worker calculated zero
        codeSmellCount: 1,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      // Zero churn = zero risk (regardless of complexity)
      expect(data.risk.score).toBe(0);
      expect(data.risk.level).toBe('LOW');
    });

    it('should handle perfect maintainability edge case (BR Edge Case 1)', async () => {
      const mockMetric = {
        filePath: 'backend/src/perfect/well-maintained.ts',
        linesOfCode: 80,
        cyclomaticComplexity: 5,
        cognitiveComplexity: 8,
        maintainabilityIndex: 100, // Perfect
        testCoverage: 100,
        churnRate: 3,
        churnCount: 9,
        riskScore: 0, // (5/10) × 3 × 0 = 0
        codeSmellCount: 0,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      // Perfect maintainability = zero risk contribution from maintainability
      expect(data.risk.score).toBe(0);
    });

    it('should handle test files correctly (BR Edge Case 4)', async () => {
      const mockMetric = {
        filePath: 'backend/src/auth/__tests__/auth.service.test.ts',
        linesOfCode: 200,
        cyclomaticComplexity: 15, // Tests can be complex
        cognitiveComplexity: 20,
        maintainabilityIndex: 70,
        testCoverage: 0, // Tests themselves aren't tested
        churnRate: 4,
        churnCount: 12,
        riskScore: 18, // Moderate risk despite complexity
        codeSmellCount: 5,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      // Test files should still have risk scores calculated
      expect(data.risk.score).toBe(18);
      expect(data.file.path).toContain('test.ts');
    });
  });

  /**
   * ST-28: Risk Level Classification Tests
   */
  describe('Risk Level Classification', () => {
    const mockProject = {
      id: 'proj-test-001',
      name: 'Test Project',
    };

    const createMockMetric = (riskScore: number) => ({
      filePath: `backend/src/test/risk-${riskScore}.ts`,
      linesOfCode: 100,
      cyclomaticComplexity: 10,
      cognitiveComplexity: 15,
      maintainabilityIndex: 70,
      testCoverage: 80,
      churnRate: 3,
      churnCount: 9,
      riskScore,
      codeSmellCount: 2,
      criticalIssues: 0,
      lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
      metadata: {},
    });

    it('should classify risk score 0-39 as LOW', async () => {
      const mockMetric = createMockMetric(30);

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      expect(data.risk.level).toBe('LOW');
      expect(data.risk.description).toBe('Acceptable risk');
    });

    it('should classify risk score 40-59 as MEDIUM', async () => {
      const mockMetric = createMockMetric(50);

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      expect(data.risk.level).toBe('MEDIUM');
      expect(data.risk.description).toBe('Refactor soon');
    });

    it('should classify risk score 60-79 as HIGH', async () => {
      const mockMetric = createMockMetric(70);

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      expect(data.risk.level).toBe('HIGH');
      expect(data.risk.description).toBe('Refactor before changes');
    });

    it('should classify risk score 80-100 as CRITICAL', async () => {
      const mockMetric = createMockMetric(90);

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      expect(data.risk.level).toBe('CRITICAL');
      expect(data.risk.description).toBe('Immediate refactoring required');
    });
  });

  /**
   * ST-28: Insights and Recommendations Tests
   */
  describe('Insights Generation', () => {
    const mockProject = {
      id: 'proj-test-001',
      name: 'Test Project',
    };

    it('should generate critical risk insight for risk score >= 80', async () => {
      const mockMetric = {
        filePath: 'backend/src/critical/high-risk.ts',
        linesOfCode: 500,
        cyclomaticComplexity: 25,
        cognitiveComplexity: 40,
        maintainabilityIndex: 40,
        testCoverage: 30,
        churnRate: 12,
        churnCount: 48,
        riskScore: 85,
        codeSmellCount: 15,
        criticalIssues: 5,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {
          codeSmells: [
            { type: 'long-function', severity: 'critical', message: 'Function exceeds 100 lines' },
          ],
        },
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      expect(data.insights).toContainEqual(
        expect.stringContaining('CRITICAL RISK')
      );
      expect(data.insights).toContainEqual(
        expect.stringContaining('immediate refactoring')
      );
    });

    it('should generate complexity warning for cyclomatic complexity > 10', async () => {
      const mockMetric = {
        filePath: 'backend/src/complex/high-complexity.ts',
        linesOfCode: 200,
        cyclomaticComplexity: 18,
        cognitiveComplexity: 25,
        maintainabilityIndex: 65,
        testCoverage: 70,
        churnRate: 4,
        churnCount: 12,
        riskScore: 45,
        codeSmellCount: 5,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      expect(data.insights).toContainEqual(
        expect.stringContaining('HIGH COMPLEXITY')
      );
      expect(data.insights).toContainEqual(
        expect.stringContaining('Cyclomatic complexity 18')
      );
    });

    it('should generate churn warning for churn rate > 5', async () => {
      const mockMetric = {
        filePath: 'backend/src/unstable/high-churn.ts',
        linesOfCode: 150,
        cyclomaticComplexity: 8,
        cognitiveComplexity: 12,
        maintainabilityIndex: 75,
        testCoverage: 80,
        churnRate: 8,
        churnCount: 24,
        riskScore: 20,
        codeSmellCount: 2,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      expect(data.insights).toContainEqual(expect.stringContaining('HIGH CHURN'));
      expect(data.insights).toContainEqual(
        expect.stringContaining('Modified 8 times')
      );
    });
  });

  /**
   * ST-28: Response Structure Tests
   */
  describe('Response Structure', () => {
    const mockProject = {
      id: 'proj-test-001',
      name: 'Test Project',
    };

    it('should return complete response structure', async () => {
      const mockMetric = {
        filePath: 'backend/src/auth/auth.service.ts',
        linesOfCode: 150,
        cyclomaticComplexity: 12,
        cognitiveComplexity: 18,
        maintainabilityIndex: 72,
        testCoverage: 85,
        churnRate: 4,
        churnCount: 12,
        riskScore: 45,
        codeSmellCount: 3,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      // Verify complete structure
      expect(data).toHaveProperty('file');
      expect(data.file).toHaveProperty('path');
      expect(data.file).toHaveProperty('folder');
      expect(data.file).toHaveProperty('loc');
      expect(data.file).toHaveProperty('lastAnalyzed');

      expect(data).toHaveProperty('project');
      expect(data.project).toHaveProperty('id');
      expect(data.project).toHaveProperty('name');

      expect(data).toHaveProperty('risk');
      expect(data.risk).toHaveProperty('score');
      expect(data.risk).toHaveProperty('level');
      expect(data.risk).toHaveProperty('description');

      expect(data).toHaveProperty('metrics');
      expect(data.metrics).toHaveProperty('complexity');
      expect(data.metrics).toHaveProperty('maintainability');
      expect(data.metrics).toHaveProperty('churn');
      expect(data.metrics).toHaveProperty('codeSmells');

      expect(data).toHaveProperty('functions');
      expect(data).toHaveProperty('insights');
      expect(data).toHaveProperty('recommendations');
      expect(data).toHaveProperty('analysis');
    });

    it('should include analysis metadata', async () => {
      const mockMetric = {
        filePath: 'backend/src/test.ts',
        linesOfCode: 100,
        cyclomaticComplexity: 10,
        cognitiveComplexity: 15,
        maintainabilityIndex: 70,
        testCoverage: 80,
        churnRate: 3,
        churnCount: 9,
        riskScore: 30,
        codeSmellCount: 2,
        criticalIssues: 0,
        lastAnalyzedAt: new Date('2025-01-15T10:00:00Z'),
        metadata: {},
      };

      mockPrismaClient.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaClient.codeMetrics.findUnique.mockResolvedValue(mockMetric);

      const result = await handler(prisma, {
        projectId: mockProject.id,
        filePath: mockMetric.filePath,
      });

      const data = JSON.parse(result.content[0].text);

      expect(data.analysis.analyzedBy).toBe('CodeAnalysisWorker');
      expect(data.analysis.dataSource).toBe('code_metrics table');
      expect(data.analysis.lastUpdate).toBe('2025-01-15T10:00:00.000Z');
    });
  });
});
