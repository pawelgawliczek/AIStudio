import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateTestCaseDto,
  UpdateTestCaseDto,
  TestCaseSearchDto,
  TestCaseResponseDto
} from './dto';
import { TestCasesService } from './test-cases.service';

@ApiTags('Test Cases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('test-cases')
export class TestCasesController {
  constructor(private readonly testCasesService: TestCasesService) {}

  @Post()
  @Roles('admin', 'pm', 'ba', 'qa')
  @ApiOperation({ summary: 'Create a new test case' })
  @ApiResponse({ status: 201, description: 'Test case created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Project or use case not found' })
  @ApiResponse({ status: 409, description: 'Test case key already exists' })
  async create(@Body() dto: CreateTestCaseDto, @Request() req): Promise<TestCaseResponseDto> {
    return this.testCasesService.create(dto, req.user.sub);
  }

  @Get()
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get all test cases with filters' })
  @ApiResponse({ status: 200, description: 'List of test cases with pagination' })
  async findAll(@Query() searchDto: TestCaseSearchDto) {
    return this.testCasesService.findAll(searchDto);
  }

  @Get('use-case/:useCaseId/coverage')
  @Roles('admin', 'pm', 'ba', 'architect', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get test coverage for a specific use case' })
  @ApiResponse({ status: 200, description: 'Use case test coverage details' })
  @ApiResponse({ status: 404, description: 'Use case not found' })
  async getUseCaseCoverage(@Param('useCaseId', ParseUUIDPipe) useCaseId: string) {
    return this.testCasesService.getUseCaseCoverage(useCaseId);
  }

  @Get('use-case/:useCaseId/gaps')
  @Roles('admin', 'pm', 'ba', 'architect', 'qa')
  @ApiOperation({ summary: 'Identify coverage gaps for a use case' })
  @ApiResponse({ status: 200, description: 'Coverage gaps identified' })
  @ApiResponse({ status: 404, description: 'Use case not found' })
  async getCoverageGaps(@Param('useCaseId', ParseUUIDPipe) useCaseId: string) {
    return this.testCasesService.getCoverageGaps(useCaseId);
  }

  @Get('project/:projectId/component-coverage')
  @Roles('admin', 'pm', 'architect', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get component-level test coverage for a project' })
  @ApiResponse({ status: 200, description: 'Component test coverage' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getComponentCoverage(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('component') component?: string
  ) {
    return this.testCasesService.getComponentCoverage(projectId, component);
  }

  @Get(':id')
  @Roles('admin', 'pm', 'ba', 'architect', 'dev', 'qa', 'viewer')
  @ApiOperation({ summary: 'Get a test case by ID' })
  @ApiResponse({ status: 200, description: 'Test case details' })
  @ApiResponse({ status: 404, description: 'Test case not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<TestCaseResponseDto> {
    return this.testCasesService.findOne(id);
  }

  @Put(':id')
  @Roles('admin', 'pm', 'ba', 'qa')
  @ApiOperation({ summary: 'Update a test case' })
  @ApiResponse({ status: 200, description: 'Test case updated successfully' })
  @ApiResponse({ status: 404, description: 'Test case not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTestCaseDto
  ): Promise<TestCaseResponseDto> {
    return this.testCasesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'pm')
  @ApiOperation({ summary: 'Delete a test case' })
  @ApiResponse({ status: 200, description: 'Test case deleted successfully' })
  @ApiResponse({ status: 404, description: 'Test case not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.testCasesService.remove(id);
  }
}
