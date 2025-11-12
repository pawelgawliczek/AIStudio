import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/swagger';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ComponentsService } from './components.service';
import { CreateComponentDto, UpdateComponentDto, ComponentResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('components')
@Controller('api/projects/:projectId/components')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ComponentsController {
  constructor(private readonly componentsService: ComponentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new component' })
  @ApiResponse({ status: 201, description: 'Component created successfully', type: ComponentResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async create(
    @Param('projectId') projectId: string,
    @Body() createComponentDto: CreateComponentDto,
  ): Promise<ComponentResponseDto> {
    return this.componentsService.create(projectId, createComponentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all components for a project' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiQuery({ name: 'tags', required: false, type: [String] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Components retrieved successfully', type: [ComponentResponseDto] })
  async findAll(
    @Param('projectId') projectId: string,
    @Query('active') active?: string,
    @Query('tags') tags?: string,
    @Query('search') search?: string,
  ): Promise<ComponentResponseDto[]> {
    const options: any = {};

    if (active !== undefined) {
      options.active = active === 'true';
    }

    if (tags) {
      options.tags = Array.isArray(tags) ? tags : [tags];
    }

    if (search) {
      options.search = search;
    }

    return this.componentsService.findAll(projectId, options);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a component by ID' })
  @ApiQuery({ name: 'includeStats', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Component retrieved successfully', type: ComponentResponseDto })
  @ApiResponse({ status: 404, description: 'Component not found' })
  async findOne(
    @Param('id') id: string,
    @Query('includeStats') includeStats?: string,
  ): Promise<ComponentResponseDto> {
    return this.componentsService.findOne(id, includeStats === 'true');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a component' })
  @ApiResponse({ status: 200, description: 'Component updated successfully', type: ComponentResponseDto })
  @ApiResponse({ status: 404, description: 'Component not found' })
  async update(
    @Param('id') id: string,
    @Body() updateComponentDto: UpdateComponentDto,
  ): Promise<ComponentResponseDto> {
    return this.componentsService.update(id, updateComponentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a component' })
  @ApiResponse({ status: 204, description: 'Component deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete component with execution history' })
  @ApiResponse({ status: 404, description: 'Component not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.componentsService.remove(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a component' })
  @ApiResponse({ status: 200, description: 'Component deactivated successfully', type: ComponentResponseDto })
  @ApiResponse({ status: 404, description: 'Component not found' })
  async deactivate(@Param('id') id: string): Promise<ComponentResponseDto> {
    return this.componentsService.deactivate(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a component' })
  @ApiResponse({ status: 200, description: 'Component activated successfully', type: ComponentResponseDto })
  @ApiResponse({ status: 404, description: 'Component not found' })
  async activate(@Param('id') id: string): Promise<ComponentResponseDto> {
    return this.componentsService.activate(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test a component with sample data (sandbox execution)' })
  @ApiResponse({ status: 200, description: 'Test execution completed' })
  @ApiResponse({ status: 404, description: 'Component not found' })
  async test(
    @Param('id') id: string,
    @Body() testInput: any,
  ): Promise<any> {
    return this.componentsService.testComponent(id, testInput);
  }
}
