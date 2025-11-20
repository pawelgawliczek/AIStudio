import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportTestExecutionDto, TestExecutionResponseDto } from './dto';
import { TestExecutionsService } from './test-executions.service';

@ApiTags('Test Executions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('test-executions')
export class TestExecutionsController {
  constructor(private readonly testExecutionsService: TestExecutionsService) {}

  @Post('report')
  @Roles('admin', 'qa', 'dev')
  @ApiOperation({
    summary: 'Report a test execution result (called by CI/CD)',
    description: 'This endpoint is called by CI/CD pipelines to report test execution results'
  })
  @ApiResponse({ status: 201, description: 'Test execution reported successfully' })
  @ApiResponse({ status: 404, description: 'Test case or story not found' })
  async reportExecution(@Body() dto: ReportTestExecutionDto): Promise<TestExecutionResponseDto> {
    return this.testExecutionsService.reportExecution(dto);
  }

  @Get('test-case/:testCaseId')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get test executions for a test case' })
  @ApiResponse({ status: 200, description: 'List of test executions' })
  @ApiResponse({ status: 404, description: 'Test case not found' })
  async getExecutionsByTestCase(
    @Param('testCaseId', ParseUUIDPipe) testCaseId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20
  ) {
    return this.testExecutionsService.getExecutionsByTestCase(testCaseId, limit);
  }

  @Get('story/:storyId')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get test executions for a story' })
  @ApiResponse({ status: 200, description: 'List of test executions' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getExecutionsByStory(
    @Param('storyId', ParseUUIDPipe) storyId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50
  ) {
    return this.testExecutionsService.getExecutionsByStory(storyId, limit);
  }

  @Get('test-case/:testCaseId/statistics')
  @Roles('admin', 'pm', 'ba', 'architect', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get execution statistics for a test case' })
  @ApiResponse({ status: 200, description: 'Test case execution statistics' })
  @ApiResponse({ status: 404, description: 'Test case not found' })
  async getTestCaseStatistics(@Param('testCaseId', ParseUUIDPipe) testCaseId: string) {
    return this.testExecutionsService.getTestCaseStatistics(testCaseId);
  }

  @Get(':id')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get a single test execution by ID' })
  @ApiResponse({ status: 200, description: 'Test execution details' })
  @ApiResponse({ status: 404, description: 'Test execution not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TestExecutionResponseDto> {
    return this.testExecutionsService.findOne(id);
  }
}
