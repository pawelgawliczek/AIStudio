import { Readable } from 'stream';
import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  StreamableFile,
  Header,
} from '@nestjs/common';
import {
  AnalyticsQueryDto,
  ExecutionHistoryQueryDto,
  ExportQueryDto,
  ComponentUsageAnalytics,
  CoordinatorUsageAnalytics,
  WorkflowUsageAnalytics,
  ExecutionHistory,
  WorkflowUsage,
  ComponentUsageDetail,
  ComponentBreakdown,
} from '../dtos/analytics.dto';
import { AnalyticsService } from '../services/analytics.service';

@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  // ============================================================================
  // COMPONENT ANALYTICS ENDPOINTS
  // ============================================================================

  @Get('components/:componentId')
  async getComponentAnalytics(
    @Param('componentId') componentId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<ComponentUsageAnalytics> {
    this.logger.log(
      `Getting analytics for component ${componentId}, version: ${query.versionId}, range: ${query.timeRange}`,
    );

    return this.analyticsService.getComponentAnalytics(
      componentId,
      query.versionId,
      query.timeRange,
    );
  }

  @Get('components/:componentId/executions')
  async getComponentExecutionHistory(
    @Param('componentId') componentId: string,
    @Query() query: ExecutionHistoryQueryDto,
  ): Promise<ExecutionHistory[]> {
    this.logger.log(
      `Getting execution history for component ${componentId}, version: ${query.versionId}, range: ${query.timeRange}`,
    );

    return this.analyticsService.getComponentExecutionHistory(
      componentId,
      query.versionId,
      query.timeRange,
      query.limit || 100,
      query.offset || 0,
    );
  }

  @Get('components/:componentId/workflows')
  async getComponentWorkflowsUsing(
    @Param('componentId') componentId: string,
    @Query('versionId') versionId?: string,
  ): Promise<WorkflowUsage[]> {
    this.logger.log(
      `Getting workflows using component ${componentId}, version: ${versionId}`,
    );

    return this.analyticsService.getWorkflowsUsingComponent(componentId, versionId);
  }

  @Get('components/:componentId/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="component-analytics.csv"')
  async exportComponentAnalytics(
    @Param('componentId') componentId: string,
    @Query() query: ExportQueryDto,
  ): Promise<StreamableFile> {
    this.logger.log(
      `Exporting analytics for component ${componentId}, format: ${query.format || 'csv'}`,
    );

    const executionHistory = await this.analyticsService.getComponentExecutionHistory(
      componentId,
      query.versionId,
      query.timeRange,
      1000, // Max export limit
      0,
    );

    if (query.format === 'json') {
      const json = JSON.stringify(executionHistory, null, 2);
      const stream = Readable.from([json]);
      return new StreamableFile(stream);
    }

    // Default to CSV
    const csv = this.convertExecutionHistoryToCSV(executionHistory);
    const stream = Readable.from([csv]);
    return new StreamableFile(stream);
  }

  // ============================================================================
  // COORDINATOR ANALYTICS ENDPOINTS
  // ============================================================================

  @Get('coordinators/:coordinatorId')
  async getCoordinatorAnalytics(
    @Param('coordinatorId') coordinatorId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<CoordinatorUsageAnalytics> {
    this.logger.log(
      `Getting analytics for coordinator ${coordinatorId}, version: ${query.versionId}, range: ${query.timeRange}`,
    );

    return this.analyticsService.getCoordinatorAnalytics(
      coordinatorId,
      query.versionId,
      query.timeRange,
    );
  }

  @Get('coordinators/:coordinatorId/executions')
  async getCoordinatorExecutionHistory(
    @Param('coordinatorId') coordinatorId: string,
    @Query() query: ExecutionHistoryQueryDto,
  ): Promise<ExecutionHistory[]> {
    this.logger.log(
      `Getting execution history for coordinator ${coordinatorId}, version: ${query.versionId}, range: ${query.timeRange}`,
    );

    return this.analyticsService.getCoordinatorExecutionHistory(
      coordinatorId,
      query.versionId,
      query.timeRange,
      query.limit || 100,
      query.offset || 0,
    );
  }

  @Get('coordinators/:coordinatorId/workflows')
  async getCoordinatorWorkflowsUsing(
    @Param('coordinatorId') coordinatorId: string,
    @Query('versionId') versionId?: string,
  ): Promise<WorkflowUsage[]> {
    this.logger.log(
      `Getting workflows using coordinator ${coordinatorId}, version: ${versionId}`,
    );

    return this.analyticsService.getWorkflowsUsingCoordinator(coordinatorId, versionId);
  }

  @Get('coordinators/:coordinatorId/components')
  async getCoordinatorComponentUsage(
    @Param('coordinatorId') coordinatorId: string,
    @Query('versionId') versionId?: string,
  ): Promise<ComponentUsageDetail[]> {
    this.logger.log(
      `Getting component usage for coordinator ${coordinatorId}, version: ${versionId}`,
    );

    return this.analyticsService.getCoordinatorComponentUsage(coordinatorId, versionId);
  }

  @Get('coordinators/:coordinatorId/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="coordinator-analytics.csv"')
  async exportCoordinatorAnalytics(
    @Param('coordinatorId') coordinatorId: string,
    @Query() query: ExportQueryDto,
  ): Promise<StreamableFile> {
    this.logger.log(
      `Exporting analytics for coordinator ${coordinatorId}, format: ${query.format || 'csv'}`,
    );

    const executionHistory = await this.analyticsService.getCoordinatorExecutionHistory(
      coordinatorId,
      query.versionId,
      query.timeRange,
      1000,
      0,
    );

    if (query.format === 'json') {
      const json = JSON.stringify(executionHistory, null, 2);
      const stream = Readable.from([json]);
      return new StreamableFile(stream);
    }

    const csv = this.convertExecutionHistoryToCSV(executionHistory);
    const stream = Readable.from([csv]);
    return new StreamableFile(stream);
  }

  // ============================================================================
  // WORKFLOW ANALYTICS ENDPOINTS
  // ============================================================================

  @Get('workflows/:workflowId')
  async getWorkflowAnalytics(
    @Param('workflowId') workflowId: string,
    @Query() query: AnalyticsQueryDto,
  ): Promise<WorkflowUsageAnalytics> {
    this.logger.log(
      `Getting analytics for workflow ${workflowId}, version: ${query.versionId}, range: ${query.timeRange}`,
    );

    return this.analyticsService.getWorkflowAnalytics(
      workflowId,
      query.versionId,
      query.timeRange,
    );
  }

  @Get('workflows/:workflowId/executions')
  async getWorkflowExecutionHistory(
    @Param('workflowId') workflowId: string,
    @Query() query: ExecutionHistoryQueryDto,
  ): Promise<ExecutionHistory[]> {
    this.logger.log(
      `Getting execution history for workflow ${workflowId}, version: ${query.versionId}, range: ${query.timeRange}`,
    );

    return this.analyticsService.getWorkflowExecutionHistory(
      workflowId,
      query.versionId,
      query.timeRange,
      query.limit || 100,
      query.offset || 0,
    );
  }

  @Get('workflows/:workflowId/component-breakdown')
  async getWorkflowComponentBreakdown(
    @Param('workflowId') workflowId: string,
    @Query('versionId') versionId?: string,
  ): Promise<ComponentBreakdown[]> {
    this.logger.log(
      `Getting component breakdown for workflow ${workflowId}, version: ${versionId}`,
    );

    return this.analyticsService.getWorkflowComponentBreakdown(workflowId, versionId);
  }

  @Get('workflows/:workflowId/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="workflow-analytics.csv"')
  async exportWorkflowAnalytics(
    @Param('workflowId') workflowId: string,
    @Query() query: ExportQueryDto,
  ): Promise<StreamableFile> {
    this.logger.log(
      `Exporting analytics for workflow ${workflowId}, format: ${query.format || 'csv'}`,
    );

    const executionHistory = await this.analyticsService.getWorkflowExecutionHistory(
      workflowId,
      query.versionId,
      query.timeRange,
      1000,
      0,
    );

    if (query.format === 'json') {
      const json = JSON.stringify(executionHistory, null, 2);
      const stream = Readable.from([json]);
      return new StreamableFile(stream);
    }

    const csv = this.convertExecutionHistoryToCSV(executionHistory);
    const stream = Readable.from([csv]);
    return new StreamableFile(stream);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private convertExecutionHistoryToCSV(history: ExecutionHistory[]): string {
    const headers = [
      'ID',
      'Workflow Run ID',
      'Workflow Name',
      'Status',
      'Start Time',
      'End Time',
      'Duration (s)',
      'Cost ($)',
      'Triggered By',
    ];

    const rows = history.map((h) => [
      h.id,
      h.workflowRunId,
      h.workflowName,
      h.status,
      h.startTime,
      h.endTime || '',
      h.duration?.toFixed(2) || '',
      h.cost?.toFixed(4) || '',
      h.triggeredBy,
    ]);

    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => this.escapeCsvCell(String(cell))).join(','),
      ),
    ];

    return csvRows.join('\n');
  }

  private escapeCsvCell(cell: string): string {
    // Escape double quotes and wrap in quotes if contains comma, quote, or newline
    if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }
}
