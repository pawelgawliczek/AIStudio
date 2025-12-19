/**
 * Unit tests for MetadataAggregationService
 * ST-355: Add unit tests for top 20 uncovered backend files
 */

import { PrismaClient } from '@prisma/client';
import { MetadataAggregationService } from '../metadata-aggregation.service';

describe('MetadataAggregationService', () => {
  let service: MetadataAggregationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      componentRun: {
        findMany: jest.fn(),
      },
    };

    service = new MetadataAggregationService(mockPrisma as PrismaClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('aggregateWorkflowMetadata', () => {
    it('should aggregate metadata from component runs', async () => {
      const mockComponentRuns = [
        {
          id: 'run-1',
          workflowRunId: 'workflow-1',
          executionOrder: 1,
          component: { name: 'Developer' },
          metadata: {
            output: {
              filesModified: [
                {
                  filePath: 'test.ts',
                  changeType: 'modified',
                  locAdded: 10,
                  locDeleted: 5,
                },
              ],
              commits: [
                {
                  hash: 'abc123',
                  message: 'test commit',
                  author: 'dev',
                  timestamp: '2024-01-01',
                  filesChanged: 1,
                },
              ],
            },
          },
          startedAt: new Date(),
          finishedAt: new Date(),
          success: true,
        },
      ];

      mockPrisma.componentRun.findMany.mockResolvedValue(mockComponentRuns);

      const result = await service.aggregateWorkflowMetadata('workflow-1');

      expect(result.workflowRunId).toBe('workflow-1');
      expect(result.version).toBe('1.0');
      expect(result.implementationSummary).toBeDefined();
      expect(result.qaStatus).toBeDefined();
      expect(result.concernsAnalysis).toBeDefined();
      expect(result.deployment).toBeDefined();
    });

    it('should handle empty component runs', async () => {
      mockPrisma.componentRun.findMany.mockResolvedValue([]);

      const result = await service.aggregateWorkflowMetadata('workflow-1');

      expect(result.implementationSummary.totalFilesModified).toBe(0);
      expect(result.implementationSummary.totalCommits).toBe(0);
      expect(result.qaStatus.status).toBe('not_started');
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.componentRun.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.aggregateWorkflowMetadata('workflow-1'),
      ).rejects.toThrow('Database error');
    });
  });

  describe('extractImplementationSummary', () => {
    it('should extract files and commits from developer runs', () => {
      const componentRuns = [
        {
          component: { name: 'Developer' },
          metadata: {
            output: {
              filesModified: [
                {
                  filePath: 'test.ts',
                  changeType: 'added',
                  locAdded: 100,
                  locDeleted: 0,
                },
              ],
              commits: [
                {
                  hash: 'abc123',
                  message: 'Add test',
                  author: 'dev',
                  timestamp: '2024-01-01',
                  filesChanged: 1,
                },
              ],
            },
          },
        },
      ];

      const result = service.extractImplementationSummary(componentRuns as any);

      expect(result.filesModified).toHaveLength(1);
      expect(result.commits).toHaveLength(1);
      expect(result.totalLocAdded).toBe(100);
      expect(result.totalLocDeleted).toBe(0);
      expect(result.totalFilesModified).toBe(1);
      expect(result.totalCommits).toBe(1);
      expect(result.implementedBy).toContain('Developer');
    });

    it('should handle implementer component runs', () => {
      const componentRuns = [
        {
          component: { name: 'Implementer' },
          metadata: {
            output: {
              filesModified: [
                {
                  filePath: 'test.ts',
                  changeType: 'modified',
                  locAdded: 50,
                  locDeleted: 20,
                },
              ],
              commits: [],
            },
          },
        },
      ];

      const result = service.extractImplementationSummary(componentRuns as any);

      expect(result.totalLocAdded).toBe(50);
      expect(result.totalLocDeleted).toBe(20);
    });

    it('should handle full-stack developer component', () => {
      const componentRuns = [
        {
          component: { name: 'Full-Stack Developer' },
          metadata: {
            output: {
              filesModified: [{ filePath: 'test.ts', locAdded: 10, locDeleted: 5 }],
              commits: [],
            },
          },
        },
      ];

      const result = service.extractImplementationSummary(componentRuns as any);

      expect(result.implementedBy).toContain('Full-Stack Developer');
    });

    it('should return empty arrays when no developer runs exist', () => {
      const componentRuns = [
        {
          component: { name: 'QA' },
          metadata: {},
        },
      ];

      const result = service.extractImplementationSummary(componentRuns as any);

      expect(result.filesModified).toEqual([]);
      expect(result.commits).toEqual([]);
      expect(result.totalLocAdded).toBe(0);
      expect(result.totalLocDeleted).toBe(0);
    });

    it('should handle metadata without output field', () => {
      const componentRuns = [
        {
          component: { name: 'Developer' },
          metadata: {
            filesModified: [{ filePath: 'test.ts', locAdded: 10, locDeleted: 0 }],
          },
        },
      ];

      const result = service.extractImplementationSummary(componentRuns as any);

      expect(result.filesModified).toHaveLength(1);
    });
  });

  describe('extractQAStatus', () => {
    it('should extract QA status from QA component runs', () => {
      const componentRuns = [
        {
          component: { name: 'QA' },
          success: true,
          startedAt: new Date('2024-01-01'),
          finishedAt: new Date('2024-01-02'),
          metadata: {
            output: {
              qaStatus: 'passed',
              testCoverage: 85,
              coverageGaps: [],
              checklistItems: [
                { text: 'Unit tests', completed: true },
              ],
              testResults: {
                totalTests: 10,
                passed: 10,
                failed: 0,
                skipped: 0,
              },
            },
          },
        },
      ];

      const result = service.extractQAStatus(componentRuns as any);

      expect(result.status).toBe('passed');
      expect(result.testCoverage).toBe(85);
      expect(result.signedOffBy).toBe('QA');
      expect(result.testResults.totalTests).toBe(10);
    });

    it('should return not_started when no QA runs exist', () => {
      const componentRuns = [
        {
          component: { name: 'Developer' },
          metadata: {},
        },
      ];

      const result = service.extractQAStatus(componentRuns as any);

      expect(result.status).toBe('not_started');
      expect(result.testCoverage).toBe(0);
      expect(result.coverageGaps).toEqual([]);
      expect(result.checklistItems).toEqual([]);
    });

    it('should handle test component runs', () => {
      const componentRuns = [
        {
          component: { name: 'Test Engineer' },
          success: false,
          startedAt: new Date(),
          finishedAt: null,
          metadata: {
            output: {
              testCoverage: 60,
            },
          },
        },
      ];

      const result = service.extractQAStatus(componentRuns as any);

      expect(result.status).toBe('failed');
      expect(result.testCoverage).toBe(60);
    });

    it('should use most recent QA run', () => {
      const componentRuns = [
        {
          component: { name: 'QA' },
          success: false,
          metadata: { output: { testCoverage: 50 } },
          startedAt: new Date('2024-01-01'),
          finishedAt: null,
        },
        {
          component: { name: 'QA' },
          success: true,
          metadata: { output: { testCoverage: 90 } },
          startedAt: new Date('2024-01-02'),
          finishedAt: new Date('2024-01-03'),
        },
      ];

      const result = service.extractQAStatus(componentRuns as any);

      expect(result.testCoverage).toBe(90);
      expect(result.status).toBe('passed');
    });
  });

  describe('extractConcernsAnalysis', () => {
    it('should extract concerns from architect and QA runs', () => {
      const componentRuns = [
        {
          component: { name: 'Architect' },
          metadata: {
            output: {
              riskScore: 7,
              riskFactors: [
                {
                  category: 'complexity',
                  description: 'High complexity',
                  impact: 'high',
                },
              ],
              issues: [
                {
                  id: 'issue-1',
                  type: 'bug',
                  severity: 'medium',
                  description: 'Potential bug',
                  status: 'open',
                },
              ],
            },
          },
        },
      ];

      const result = service.extractConcernsAnalysis(componentRuns as any);

      expect(result.riskScore).toBe(7);
      expect(result.factors).toHaveLength(1);
      expect(result.issues).toHaveLength(1);
      expect(result.analyzedBy).toContain('Architect');
    });

    it('should aggregate risk score from multiple components', () => {
      const componentRuns = [
        {
          component: { name: 'Architect' },
          metadata: {
            output: {
              riskScore: 5,
              factors: [],
            },
          },
        },
        {
          component: { name: 'QA' },
          metadata: {
            output: {
              riskScore: 8,
              factors: [],
            },
          },
        },
      ];

      const result = service.extractConcernsAnalysis(componentRuns as any);

      expect(result.riskScore).toBe(8);
    });

    it('should extract breaking changes', () => {
      const componentRuns = [
        {
          component: { name: 'Architect' },
          metadata: {
            output: {
              breakingChanges: [
                {
                  description: 'API change',
                  affectedAreas: ['frontend'],
                  migrationRequired: true,
                },
              ],
            },
          },
        },
      ];

      const result = service.extractConcernsAnalysis(componentRuns as any);

      expect(result.breakingChanges).toHaveLength(1);
      expect(result.breakingChanges[0].migrationRequired).toBe(true);
    });

    it('should calculate implementation coverage', () => {
      const componentRuns = [
        {
          component: { name: 'Architect' },
          metadata: {
            output: {
              uncoveredCriteria: [
                { text: 'Criterion 1', reason: 'Not implemented' },
                { text: 'Criterion 2', reason: 'Deferred' },
              ],
            },
          },
        },
      ];

      const result = service.extractConcernsAnalysis(componentRuns as any);

      expect(result.implementationCoverage).toBe(80);
      expect(result.uncoveredCriteria).toHaveLength(2);
    });

    it('should handle empty component runs', () => {
      const result = service.extractConcernsAnalysis([]);

      expect(result.riskScore).toBe(0);
      expect(result.factors).toEqual([]);
      expect(result.issues).toEqual([]);
      expect(result.implementationCoverage).toBe(100);
    });
  });

  describe('extractDeploymentData', () => {
    it('should extract deployment data from devops runs', () => {
      const componentRuns = [
        {
          id: 'run-1',
          component: { name: 'DevOps' },
          finishedAt: new Date('2024-01-01'),
          success: true,
          durationSeconds: 120,
          metadata: {
            output: {
              deployment: {
                status: 'success',
                duration: 120,
                testUrl: 'https://test.example.com',
                testResults: {
                  passed: 10,
                  failed: 0,
                  skipped: 0,
                },
              },
            },
          },
        },
      ];

      const result = service.extractDeploymentData(componentRuns as any);

      expect(result.lastDeployment).toBeDefined();
      expect(result.lastDeployment.status).toBe('success');
      expect(result.lastDeployment.testUrl).toBe('https://test.example.com');
      expect(result.deploymentHistory).toHaveLength(1);
    });

    it('should handle deploy component runs', () => {
      const componentRuns = [
        {
          id: 'run-1',
          component: { name: 'Deployment Agent' },
          finishedAt: new Date(),
          success: false,
          metadata: {
            output: {
              deployment: {
                status: 'failed',
                errorMessage: 'Build failed',
              },
            },
          },
        },
      ];

      const result = service.extractDeploymentData(componentRuns as any);

      expect(result.lastDeployment.status).toBe('failed');
      expect(result.lastDeployment.errorMessage).toBe('Build failed');
    });

    it('should return most recent deployment as last', () => {
      const componentRuns = [
        {
          id: 'run-1',
          component: { name: 'DevOps' },
          finishedAt: new Date('2024-01-01'),
          success: true,
          metadata: {
            output: {
              deployment: {
                status: 'success',
                duration: 100,
              },
            },
          },
        },
        {
          id: 'run-2',
          component: { name: 'DevOps' },
          finishedAt: new Date('2024-01-02'),
          success: true,
          metadata: {
            output: {
              deployment: {
                status: 'success',
                duration: 90,
              },
            },
          },
        },
      ];

      const result = service.extractDeploymentData(componentRuns as any);

      expect(result.lastDeployment.duration).toBe(90);
      expect(result.deploymentHistory).toHaveLength(2);
    });

    it('should return empty deployment when no devops runs', () => {
      const componentRuns = [
        {
          component: { name: 'Developer' },
          metadata: {},
        },
      ];

      const result = service.extractDeploymentData(componentRuns as any);

      expect(result.lastDeployment).toBeUndefined();
      expect(result.deploymentHistory).toEqual([]);
    });
  });
});
