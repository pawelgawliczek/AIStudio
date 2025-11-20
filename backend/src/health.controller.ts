import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { QueueProcessorService } from './workers/queue-processor.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly queueProcessor: QueueProcessorService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'aistudio-backend',
    };
  }

  @Get('queue-processor')
  @ApiOperation({ summary: 'Queue processor health check' })
  async queueProcessorHealth() {
    return this.queueProcessor.getHealthStatus();
  }
}
