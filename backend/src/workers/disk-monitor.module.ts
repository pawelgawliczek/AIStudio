/**
 * Disk Monitor Module - NestJS module for disk space monitoring and alerting
 *
 * Wires up dependencies for the disk monitor service:
 * - ScheduleModule: Enables @Cron decorator for hourly/weekly execution
 * - ConfigModule: Environment configuration for thresholds
 * - PrismaModule: Database access for alerts and reports
 * - WorkersModule: Notification queue for sending alerts
 */

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkersModule } from './workers.module';
import { DiskMonitorService } from './disk-monitor.service';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable NestJS scheduling
    ConfigModule,
    PrismaModule,
    WorkersModule, // For notification queue
  ],
  providers: [DiskMonitorService],
  exports: [DiskMonitorService],
})
export class DiskMonitorModule {}
