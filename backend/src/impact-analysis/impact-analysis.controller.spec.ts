import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ImpactAnalysisController } from './impact-analysis.controller';
import { ImpactAnalysisService } from './impact-analysis.service';
import { MappingSource } from '@prisma/client';

describe('ImpactAnalysisController', () => {
  let controller: ImpactAnalysisController;
  let service: ImpactAnalysisService;

  const mockImpactAnalysisService = {
    getAffectedUseCases: jest.fn(),
    getImplementingFiles: jest.fn(),
    createOrUpdateMapping: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImpactAnalysisController],
      providers: [
        {
          provide: ImpactAnalysisService,
          useValue: mockImpactAnalysisService,
        },
      ],
    }).compile();

    controller = module.get<ImpactAnalysisController>(
      ImpactAnalysisController,
    );
    service = module.get<ImpactAnalysisService>(ImpactAnalysisService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAffectedUseCases', () => {
    it('should throw BadRequestException when projectId is missing', async () => {
      await expect(
        controller.getAffectedUseCases(undefined, 'file1.ts'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.getAffectedUseCases(undefined, 'file1.ts'),
      ).rejects.toThrow('projectId is required');
    });

    it('should throw BadRequestException when filePaths is missing', async () => {
      await expect(
        controller.getAffectedUseCases('proj-1', undefined),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.getAffectedUseCases('proj-1', undefined),
      ).rejects.toThrow('filePaths is required');
    });

    it('should call service with correct parameters', async () => {
      const mockResult = {
        projectId: 'proj-1',
        filesAnalyzed: ['file1.ts', 'file2.ts'],
        affectedUseCases: [],
        summary: {
          totalUseCases: 0,
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 0,
          avgConfidence: 0,
          recommendation: 'No use cases affected.',
        },
      };

      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue(
        mockResult,
      );

      const result = await controller.getAffectedUseCases(
        'proj-1',
        'file1.ts,file2.ts',
      );

      expect(service.getAffectedUseCases).toHaveBeenCalledWith({
        projectId: 'proj-1',
        filePaths: ['file1.ts', 'file2.ts'],
        minConfidence: 0.5,
        includeIndirect: false,
      });
      expect(result).toEqual(mockResult);
    });

    it('should parse minConfidence parameter correctly', async () => {
      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue({
        projectId: 'proj-1',
        filesAnalyzed: ['file1.ts'],
        affectedUseCases: [],
        summary: {} as any,
      });

      await controller.getAffectedUseCases(
        'proj-1',
        'file1.ts',
        '0.75',
        undefined,
      );

      expect(service.getAffectedUseCases).toHaveBeenCalledWith({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
        minConfidence: 0.75,
        includeIndirect: false,
      });
    });

    it('should parse includeIndirect parameter correctly', async () => {
      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue({
        projectId: 'proj-1',
        filesAnalyzed: ['file1.ts'],
        affectedUseCases: [],
        summary: {} as any,
      });

      await controller.getAffectedUseCases(
        'proj-1',
        'file1.ts',
        undefined,
        'true',
      );

      expect(service.getAffectedUseCases).toHaveBeenCalledWith({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
        minConfidence: 0.5,
        includeIndirect: true,
      });
    });

    it('should trim whitespace from file paths', async () => {
      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue({
        projectId: 'proj-1',
        filesAnalyzed: [],
        affectedUseCases: [],
        summary: {} as any,
      });

      await controller.getAffectedUseCases(
        'proj-1',
        ' file1.ts , file2.ts , file3.ts ',
      );

      expect(service.getAffectedUseCases).toHaveBeenCalledWith(
        expect.objectContaining({
          filePaths: ['file1.ts', 'file2.ts', 'file3.ts'],
        }),
      );
    });
  });

  describe('getImplementingFiles', () => {
    it('should throw BadRequestException when projectId is missing', async () => {
      await expect(
        controller.getImplementingFiles(undefined, 'uc-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when both useCaseId and useCaseKey are missing', async () => {
      await expect(
        controller.getImplementingFiles('proj-1', undefined, undefined),
      ).rejects.toThrow('useCaseId or useCaseKey is required');
    });

    it('should call service with useCaseId', async () => {
      const mockResult = {
        projectId: 'proj-1',
        useCase: {
          id: 'uc-1',
          key: 'UC-001',
          title: 'Test',
          area: null,
        },
        implementingFiles: [],
        relatedUseCases: [],
        stories: [],
        summary: {} as any,
      };

      mockImpactAnalysisService.getImplementingFiles.mockResolvedValue(
        mockResult,
      );

      const result = await controller.getImplementingFiles('proj-1', 'uc-1');

      expect(service.getImplementingFiles).toHaveBeenCalledWith({
        projectId: 'proj-1',
        useCaseId: 'uc-1',
        useCaseKey: undefined,
        minConfidence: 0.5,
        includeMetrics: true,
      });
      expect(result).toEqual(mockResult);
    });

    it('should call service with useCaseKey', async () => {
      const mockResult = {
        projectId: 'proj-1',
        useCase: {
          id: 'uc-1',
          key: 'UC-001',
          title: 'Test',
          area: null,
        },
        implementingFiles: [],
        relatedUseCases: [],
        stories: [],
        summary: {} as any,
      };

      mockImpactAnalysisService.getImplementingFiles.mockResolvedValue(
        mockResult,
      );

      const result = await controller.getImplementingFiles(
        'proj-1',
        undefined,
        'UC-001',
      );

      expect(service.getImplementingFiles).toHaveBeenCalledWith({
        projectId: 'proj-1',
        useCaseId: undefined,
        useCaseKey: 'UC-001',
        minConfidence: 0.5,
        includeMetrics: true,
      });
      expect(result).toEqual(mockResult);
    });

    it('should parse includeMetrics parameter correctly', async () => {
      mockImpactAnalysisService.getImplementingFiles.mockResolvedValue({
        projectId: 'proj-1',
        useCase: {} as any,
        implementingFiles: [],
        relatedUseCases: [],
        stories: [],
        summary: {} as any,
      });

      await controller.getImplementingFiles(
        'proj-1',
        'uc-1',
        undefined,
        undefined,
        'false',
      );

      expect(service.getImplementingFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          includeMetrics: false,
        }),
      );
    });
  });

  describe('batchAnalysis', () => {
    it('should throw BadRequestException when projectId is missing', async () => {
      await expect(
        controller.batchAnalysis({
          projectId: undefined,
          filePaths: ['file1.ts'],
        } as any),
      ).rejects.toThrow('projectId is required');
    });

    it('should throw BadRequestException when filePaths is missing', async () => {
      await expect(
        controller.batchAnalysis({
          projectId: 'proj-1',
          filePaths: undefined,
        } as any),
      ).rejects.toThrow('filePaths is required');
    });

    it('should throw BadRequestException when filePaths is empty', async () => {
      await expect(
        controller.batchAnalysis({
          projectId: 'proj-1',
          filePaths: [],
        }),
      ).rejects.toThrow('filePaths is required');
    });

    it('should perform batch analysis with high risk assessment', async () => {
      const mockServiceResult = {
        projectId: 'proj-1',
        filesAnalyzed: ['file1.ts'],
        affectedUseCases: [
          {
            useCaseKey: 'UC-AUTH-001',
            title: 'User Login',
            riskLevel: 'high' as const,
            area: 'Authentication',
            testCoverage: 65,
          },
        ],
        summary: {
          totalUseCases: 1,
          highRisk: 1,
          mediumRisk: 0,
          lowRisk: 0,
          avgConfidence: 0.85,
          recommendation: 'High impact',
        },
      };

      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue(
        mockServiceResult,
      );

      const result = await controller.batchAnalysis({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
        context: {
          prNumber: 123,
          branch: 'feature/test',
          author: 'test@example.com',
        },
      });

      expect(result.analysisId).toBeDefined();
      expect(result.riskAssessment.overallRisk).toBe('high');
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations).toContain(
        'Review and update test cases for high-risk use cases',
      );
      expect(result.recommendations).toContain(
        'Run full regression suite before deployment',
      );
      expect(result.context).toEqual({
        prNumber: 123,
        branch: 'feature/test',
        author: 'test@example.com',
      });
    });

    it('should assess medium risk correctly', async () => {
      const mockServiceResult = {
        projectId: 'proj-1',
        filesAnalyzed: ['file1.ts'],
        affectedUseCases: [
          {
            useCaseKey: 'UC-001',
            title: 'Test',
            riskLevel: 'medium' as const,
            area: null,
            testCoverage: 80,
          },
        ],
        summary: {
          totalUseCases: 1,
          highRisk: 0,
          mediumRisk: 1,
          lowRisk: 0,
          avgConfidence: 0.7,
          recommendation: 'Medium impact',
        },
      };

      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue(
        mockServiceResult,
      );

      const result = await controller.batchAnalysis({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
      });

      expect(result.riskAssessment.overallRisk).toBe('medium');
    });

    it('should assess low risk correctly', async () => {
      const mockServiceResult = {
        projectId: 'proj-1',
        filesAnalyzed: ['file1.ts'],
        affectedUseCases: [
          {
            useCaseKey: 'UC-001',
            title: 'Test',
            riskLevel: 'low' as const,
            area: null,
            testCoverage: 90,
          },
        ],
        summary: {
          totalUseCases: 1,
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 1,
          avgConfidence: 0.8,
          recommendation: 'Low impact',
        },
      };

      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue(
        mockServiceResult,
      );

      const result = await controller.batchAnalysis({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
      });

      expect(result.riskAssessment.overallRisk).toBe('low');
      expect(result.recommendations).toEqual([
        'Standard review process recommended',
      ]);
    });

    it('should recommend tests for low test coverage', async () => {
      const mockServiceResult = {
        projectId: 'proj-1',
        filesAnalyzed: ['file1.ts'],
        affectedUseCases: [
          {
            useCaseKey: 'UC-AUTH-001',
            title: 'User Login',
            riskLevel: 'medium' as const,
            area: 'Authentication',
            testCoverage: 45, // Low coverage
          },
          {
            useCaseKey: 'UC-AUTH-002',
            title: 'Session',
            riskLevel: 'medium' as const,
            area: 'Authentication',
            testCoverage: 50,
          },
        ],
        summary: {
          totalUseCases: 2,
          highRisk: 0,
          mediumRisk: 2,
          lowRisk: 0,
          avgConfidence: 0.7,
          recommendation: '',
        },
      };

      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue(
        mockServiceResult,
      );

      const result = await controller.batchAnalysis({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
      });

      expect(result.riskAssessment.factors).toContain(
        '2 use case(s) with low test coverage',
      );
      expect(result.recommendations.some((r) => r.includes('Improve test coverage'))).toBe(true);
      expect(result.recommendations.some((r) => r.includes('UC-AUTH-001, UC-AUTH-002'))).toBe(true);
    });

    it('should identify low confidence mappings', async () => {
      const mockServiceResult = {
        projectId: 'proj-1',
        filesAnalyzed: ['file1.ts'],
        affectedUseCases: [],
        summary: {
          totalUseCases: 0,
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 0,
          avgConfidence: 0.4, // Low confidence
          recommendation: '',
        },
      };

      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue(
        mockServiceResult,
      );

      const result = await controller.batchAnalysis({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
      });

      expect(result.riskAssessment.factors).toContain(
        'Low confidence in file-to-usecase mappings',
      );
      expect(result.recommendations).toContain(
        'Verify affected use cases manually due to low confidence',
      );
    });

    it('should suggest breaking up large changes', async () => {
      const mockServiceResult = {
        projectId: 'proj-1',
        filesAnalyzed: ['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts'],
        affectedUseCases: [
          { useCaseKey: 'UC-001', riskLevel: 'low' as const },
          { useCaseKey: 'UC-002', riskLevel: 'low' as const },
          { useCaseKey: 'UC-003', riskLevel: 'low' as const },
          { useCaseKey: 'UC-004', riskLevel: 'low' as const },
        ],
        summary: {
          totalUseCases: 4,
          highRisk: 0,
          mediumRisk: 0,
          lowRisk: 4,
          avgConfidence: 0.8,
          recommendation: '',
        },
      };

      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue(
        mockServiceResult,
      );

      const result = await controller.batchAnalysis({
        projectId: 'proj-1',
        filePaths: ['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts'],
      });

      expect(result.riskAssessment.factors).toContain(
        'Multiple use cases affected',
      );
      expect(result.recommendations).toContain(
        'Consider breaking changes into smaller PRs',
      );
    });

    it('should require security team review for auth/security changes', async () => {
      const mockServiceResult = {
        projectId: 'proj-1',
        filesAnalyzed: ['file1.ts'],
        affectedUseCases: [
          {
            useCaseKey: 'UC-AUTH-001',
            title: 'Login',
            riskLevel: 'medium' as const,
            area: 'Authentication',
            testCoverage: 80,
          },
        ],
        summary: {
          totalUseCases: 1,
          highRisk: 0,
          mediumRisk: 1,
          lowRisk: 0,
          avgConfidence: 0.8,
          recommendation: '',
        },
      };

      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue(
        mockServiceResult,
      );

      const result = await controller.batchAnalysis({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
      });

      expect(result.requiredReviewers).toContainEqual({
        email: 'security-team@example.com',
        reason: 'Security-related changes',
      });
    });

    it('should require QA lead review for high-risk changes', async () => {
      const mockServiceResult = {
        projectId: 'proj-1',
        filesAnalyzed: ['file1.ts'],
        affectedUseCases: [
          {
            useCaseKey: 'UC-001',
            title: 'Critical Feature',
            riskLevel: 'high' as const,
            area: null,
            testCoverage: 60,
          },
        ],
        summary: {
          totalUseCases: 1,
          highRisk: 1,
          mediumRisk: 0,
          lowRisk: 0,
          avgConfidence: 0.9,
          recommendation: '',
        },
      };

      mockImpactAnalysisService.getAffectedUseCases.mockResolvedValue(
        mockServiceResult,
      );

      const result = await controller.batchAnalysis({
        projectId: 'proj-1',
        filePaths: ['file1.ts'],
      });

      expect(result.requiredReviewers).toContainEqual({
        email: 'qa-lead@example.com',
        reason: 'High risk changes',
      });
    });
  });

  describe('createMapping', () => {
    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        controller.createMapping({
          projectId: undefined,
          filePath: 'file1.ts',
          useCaseId: 'uc-1',
          source: MappingSource.MANUAL,
        } as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createMapping({
          projectId: 'proj-1',
          filePath: undefined,
          useCaseId: 'uc-1',
          source: MappingSource.MANUAL,
        } as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createMapping({
          projectId: 'proj-1',
          filePath: 'file1.ts',
          useCaseId: undefined,
          source: MappingSource.MANUAL,
        } as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createMapping({
          projectId: 'proj-1',
          filePath: 'file1.ts',
          useCaseId: 'uc-1',
          source: undefined,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call service with correct parameters', async () => {
      mockImpactAnalysisService.createOrUpdateMapping.mockResolvedValue(
        undefined,
      );

      const result = await controller.createMapping({
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseId: 'uc-1',
        source: MappingSource.MANUAL,
        confidence: 0.95,
      });

      expect(service.createOrUpdateMapping).toHaveBeenCalledWith({
        projectId: 'proj-1',
        filePath: 'file1.ts',
        useCaseId: 'uc-1',
        source: MappingSource.MANUAL,
        confidence: 0.95,
      });

      expect(result).toEqual({
        success: true,
        message: 'Mapping created/updated successfully',
      });
    });

    it('should accept different mapping sources', async () => {
      mockImpactAnalysisService.createOrUpdateMapping.mockResolvedValue(
        undefined,
      );

      const sources = [
        MappingSource.MANUAL,
        MappingSource.COMMIT_DERIVED,
        MappingSource.AI_INFERRED,
        MappingSource.PATTERN_MATCHED,
        MappingSource.IMPORT_ANALYSIS,
      ];

      for (const source of sources) {
        await controller.createMapping({
          projectId: 'proj-1',
          filePath: 'file1.ts',
          useCaseId: 'uc-1',
          source,
        });

        expect(service.createOrUpdateMapping).toHaveBeenCalledWith(
          expect.objectContaining({
            source,
          }),
        );
      }
    });
  });
});
