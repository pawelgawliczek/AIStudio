import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ImpactAnalysisService,
  FileToUseCasesQuery,
  UseCaseToFilesQuery,
} from './impact-analysis.service';
import { MappingSource } from '@prisma/client';

@Controller('api/impact-analysis')
@UseGuards(JwtAuthGuard)
export class ImpactAnalysisController {
  constructor(private readonly impactAnalysisService: ImpactAnalysisService) {}

  /**
   * GET /api/impact-analysis/files-to-usecases
   *
   * Get use cases affected by file changes
   *
   * Query params:
   * - projectId: Project UUID (required)
   * - filePaths: Comma-separated file paths (required)
   * - minConfidence: Minimum confidence threshold (optional, default 0.5)
   * - includeIndirect: Include indirectly related use cases (optional, default false)
   */
  @Get('files-to-usecases')
  async getAffectedUseCases(
    @Query('projectId') projectId: string,
    @Query('filePaths') filePaths: string,
    @Query('minConfidence') minConfidence?: string,
    @Query('includeIndirect') includeIndirect?: string,
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }
    if (!filePaths) {
      throw new BadRequestException('filePaths is required');
    }

    const query: FileToUseCasesQuery = {
      projectId,
      filePaths: filePaths.split(',').map((p) => p.trim()),
      minConfidence: minConfidence ? parseFloat(minConfidence) : 0.5,
      includeIndirect: includeIndirect === 'true',
    };

    return this.impactAnalysisService.getAffectedUseCases(query);
  }

  /**
   * GET /api/impact-analysis/usecase-to-files
   *
   * Get files that implement a use case
   *
   * Query params:
   * - projectId: Project UUID (required)
   * - useCaseId or useCaseKey: Use case identifier (required)
   * - minConfidence: Minimum confidence threshold (optional, default 0.5)
   * - includeMetrics: Include code metrics (optional, default true)
   */
  @Get('usecase-to-files')
  async getImplementingFiles(
    @Query('projectId') projectId: string,
    @Query('useCaseId') useCaseId?: string,
    @Query('useCaseKey') useCaseKey?: string,
    @Query('minConfidence') minConfidence?: string,
    @Query('includeMetrics') includeMetrics?: string,
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }
    if (!useCaseId && !useCaseKey) {
      throw new BadRequestException('useCaseId or useCaseKey is required');
    }

    const query: UseCaseToFilesQuery = {
      projectId,
      useCaseId,
      useCaseKey,
      minConfidence: minConfidence ? parseFloat(minConfidence) : 0.5,
      includeMetrics: includeMetrics !== 'false',
    };

    return this.impactAnalysisService.getImplementingFiles(query);
  }

  /**
   * POST /api/impact-analysis/batch
   *
   * Bulk impact analysis for multiple files
   * Useful for analyzing PRs or branches
   *
   * Body:
   * {
   *   projectId: string,
   *   filePaths: string[],
   *   minConfidence?: number,
   *   includeIndirect?: boolean,
   *   context?: {
   *     prNumber?: number,
   *     branch?: string,
   *     author?: string
   *   }
   * }
   */
  @Post('batch')
  async batchAnalysis(
    @Body()
    body: {
      projectId: string;
      filePaths: string[];
      minConfidence?: number;
      includeIndirect?: boolean;
      context?: {
        prNumber?: number;
        branch?: string;
        author?: string;
      };
    },
  ) {
    if (!body.projectId) {
      throw new BadRequestException('projectId is required');
    }
    if (!body.filePaths || body.filePaths.length === 0) {
      throw new BadRequestException('filePaths is required');
    }

    const result = await this.impactAnalysisService.getAffectedUseCases({
      projectId: body.projectId,
      filePaths: body.filePaths,
      minConfidence: body.minConfidence || 0.5,
      includeIndirect: body.includeIndirect || false,
    });

    // Generate analysis ID for tracking
    const analysisId = `analysis-${Date.now()}`;

    // Determine overall risk
    let overallRisk: 'low' | 'medium' | 'high' = 'low';
    if (result.summary.highRisk > 0) {
      overallRisk = 'high';
    } else if (result.summary.mediumRisk > 0) {
      overallRisk = 'medium';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    const factors: string[] = [];

    if (result.summary.highRisk > 0) {
      factors.push(
        `${result.summary.highRisk} high-risk use case(s) affected`,
      );
      recommendations.push(
        `Review and update test cases for high-risk use cases`,
      );
      recommendations.push(`Run full regression suite before deployment`);
    }

    if (result.summary.avgConfidence < 0.6) {
      factors.push('Low confidence in file-to-usecase mappings');
      recommendations.push(
        'Verify affected use cases manually due to low confidence',
      );
    }

    const lowCoverageUseCases = result.affectedUseCases.filter(
      (uc) => uc.testCoverage && uc.testCoverage < 70,
    );
    if (lowCoverageUseCases.length > 0) {
      factors.push(`${lowCoverageUseCases.length} use case(s) with low test coverage`);
      recommendations.push(
        `Improve test coverage for: ${lowCoverageUseCases.map((uc) => uc.useCaseKey).join(', ')}`,
      );
    }

    if (result.affectedUseCases.length > 3) {
      factors.push('Multiple use cases affected');
      recommendations.push('Consider breaking changes into smaller PRs');
    }

    // Determine required reviewers based on affected areas
    const requiredReviewers: { email: string; reason: string }[] = [];
    const affectedAreas = new Set(
      result.affectedUseCases.map((uc) => uc.area).filter(Boolean),
    );

    if (affectedAreas.has('Authentication') || affectedAreas.has('Security')) {
      requiredReviewers.push({
        email: 'security-team@example.com',
        reason: 'Security-related changes',
      });
    }

    if (overallRisk === 'high') {
      requiredReviewers.push({
        email: 'qa-lead@example.com',
        reason: 'High risk changes',
      });
    }

    return {
      analysisId,
      projectId: body.projectId,
      filesAnalyzed: body.filePaths.length,
      affectedUseCases: result.affectedUseCases.length,
      riskAssessment: {
        overallRisk,
        criticalUseCases: result.summary.highRisk,
        highRiskUseCases: result.summary.highRisk,
        mediumRiskUseCases: result.summary.mediumRisk,
        factors:
          factors.length > 0 ? factors : ['Low impact change, minimal risk'],
      },
      useCases: result.affectedUseCases,
      recommendations:
        recommendations.length > 0
          ? recommendations
          : ['Standard review process recommended'],
      requiredReviewers,
      context: body.context,
      summary: result.summary,
    };
  }

  /**
   * POST /api/impact-analysis/create-mapping
   *
   * Manually create or update a file-to-usecase mapping
   *
   * Body:
   * {
   *   projectId: string,
   *   filePath: string,
   *   useCaseId: string,
   *   source: 'MANUAL' | 'COMMIT_DERIVED' | 'AI_INFERRED' | 'PATTERN_MATCHED' | 'IMPORT_ANALYSIS',
   *   confidence?: number
   * }
   */
  @Post('create-mapping')
  async createMapping(
    @Body()
    body: {
      projectId: string;
      filePath: string;
      useCaseId: string;
      source: MappingSource;
      confidence?: number;
    },
  ) {
    if (!body.projectId || !body.filePath || !body.useCaseId || !body.source) {
      throw new BadRequestException(
        'projectId, filePath, useCaseId, and source are required',
      );
    }

    await this.impactAnalysisService.createOrUpdateMapping(body);

    return {
      success: true,
      message: 'Mapping created/updated successfully',
    };
  }
}
