/**
 * Queue Processor Module - NestJS module for background queue processing
 *
 * Wires up dependencies for the queue processor service:
 * - ScheduleModule: Enables @Interval decorator for periodic execution
 * - BullModule: Provides Redis connection for distributed locking
 * - PrismaModule: Database access for queue operations
 * - ConfigModule: Environment configuration
 */

import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { QUEUE_NAMES } from './constants';
import { QueueProcessorService } from './queue-processor.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable NestJS scheduling
    BullModule.registerQueue({ name: QUEUE_NAMES.CODE_ANALYSIS }), // For Redis access
    ConfigModule,
    PrismaModule,
  ],
  providers: [QueueProcessorService],
  exports: [QueueProcessorService],
})
export class QueueProcessorModule {}
