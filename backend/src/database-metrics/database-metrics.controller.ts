import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DatabaseMetricsService, DatabaseMetrics } from './database-metrics.service';

@ApiTags('database-metrics')
@Controller('database-metrics')
export class DatabaseMetricsController {
  constructor(private readonly databaseMetricsService: DatabaseMetricsService) {}

  @Get('connections')
  @ApiOperation({ summary: 'Get PostgreSQL connection pool metrics' })
  async getConnectionMetrics(): Promise<DatabaseMetrics> {
    return this.databaseMetricsService.getConnectionMetrics();
  }
}
