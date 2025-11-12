import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { WebSocketModule } from '../websocket/websocket.module';

// Constants
import { QUEUE_NAMES } from './constants';

// Processors
// import { CodeAnalysisProcessor } from './processors/code-analysis.processor';
import { EmbeddingProcessor } from './processors/embedding.processor';
import { MetricsAggregatorProcessor } from './processors/metrics-aggregator.processor';
import { NotificationProcessor } from './processors/notification.processor';
// import { TestAnalyzerProcessor } from './processors/test-analyzer.processor';

// Services
import { WorkersService } from './workers.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL');

        // If REDIS_URL is set, parse it; otherwise use individual config
        if (redisUrl) {
          return {
            redis: redisUrl,
            defaultJobOptions: {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
              removeOnComplete: 100, // Keep last 100 completed jobs
              removeOnFail: 200, // Keep last 200 failed jobs
            },
          };
        }

        return {
          redis: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
            db: configService.get('REDIS_DB', 0),
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: 100, // Keep last 100 completed jobs
            removeOnFail: 200, // Keep last 200 failed jobs
          },
        };
      },
      inject: [ConfigService],
    }),
    // Register all queues
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CODE_ANALYSIS },
      { name: QUEUE_NAMES.EMBEDDING },
      { name: QUEUE_NAMES.METRICS_AGGREGATION },
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.TEST_ANALYSIS },
    ),
    PrismaModule,
    WebSocketModule,
  ],
  providers: [
    WorkersService,
    // CodeAnalysisProcessor,
    EmbeddingProcessor,
    MetricsAggregatorProcessor,
    NotificationProcessor,
    // TestAnalyzerProcessor,
  ],
  exports: [WorkersService, BullModule],
})
export class WorkersModule {}
