import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TestCasesModule } from '../test-cases/test-cases.module';
import { TestExecutionsModule } from '../test-executions/test-executions.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { TestAnalyticsController } from './test-analytics.controller';
import { TestAnalyticsService } from './test-analytics.service';
import { TestResultsReporterService } from './test-results-reporter.service';
import { TestResultsController } from './test-results.controller';

/**
 * Test Execution Module (ST-128)
 *
 * Provides real-time test execution reporting with WebSocket notifications.
 * Parses Jest and Playwright JSON results and broadcasts events to frontend.
 *
 * Key Features:
 * - Parse Jest unit/integration test results
 * - Parse Playwright e2e test results
 * - WebSocket broadcasts (test:started, test:completed)
 * - Test analytics and aggregation
 *
 * Usage:
 * - Called by report-test-results.ts script after test runs
 * - Provides real-time test execution tracking in frontend
 */
@Module({
  imports: [PrismaModule, WebSocketModule, TestExecutionsModule, TestCasesModule],
  controllers: [TestAnalyticsController, TestResultsController],
  providers: [TestResultsReporterService, TestAnalyticsService],
  exports: [TestResultsReporterService, TestAnalyticsService],
})
export class TestExecutionModule {}
