import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { TestAnalyticsService } from './test-analytics.service';

@Controller('test-analytics')
export class TestAnalyticsController {
  constructor(private readonly testAnalyticsService: TestAnalyticsService) {}

  /**
   * Get flaky tests for a project
   * GET /test-analytics/project/:projectId/flaky-tests?days=30
   */
  @Get('project/:projectId/flaky-tests')
  async getFlakyTests(
    @Param('projectId') projectId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.testAnalyticsService.getFlakyTests(projectId, days);
  }

  /**
   * Get test performance trends for a project
   * GET /test-analytics/project/:projectId/performance?days=30
   */
  @Get('project/:projectId/performance')
  async getPerformanceTrends(
    @Param('projectId') projectId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.testAnalyticsService.getTestPerformanceTrends(projectId, days);
  }

  /**
   * Get use case coverage for a project
   * GET /test-analytics/project/:projectId/use-case-coverage
   */
  @Get('project/:projectId/use-case-coverage')
  async getUseCaseCoverage(@Param('projectId') projectId: string) {
    return this.testAnalyticsService.getUseCaseCoverage(projectId);
  }

  /**
   * Get test execution trends for a project
   * GET /test-analytics/project/:projectId/trends?days=30
   */
  @Get('project/:projectId/trends')
  async getExecutionTrends(
    @Param('projectId') projectId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.testAnalyticsService.getTestExecutionTrends(projectId, days);
  }

  /**
   * Get slowest tests for a project
   * GET /test-analytics/project/:projectId/slow-tests?limit=10
   */
  @Get('project/:projectId/slow-tests')
  async getSlowTests(
    @Param('projectId') projectId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.testAnalyticsService.getSlowTests(projectId, limit);
  }
}
