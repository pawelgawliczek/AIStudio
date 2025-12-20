/**
 * Transcript Cleanup Module - NestJS module for transcript line retention management
 *
 * Wires up dependencies for the transcript cleanup service:
 * - ScheduleModule: Enables @Cron decorator for daily execution
 * - ConfigModule: Environment configuration for retention period
 * - PrismaModule: Database access for transcript line deletion
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { TranscriptCleanupService } from './transcript-cleanup.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable NestJS scheduling
    ConfigModule,
    PrismaModule,
  ],
  providers: [TranscriptCleanupService],
  exports: [TranscriptCleanupService],
})
export class TranscriptCleanupModule {}
