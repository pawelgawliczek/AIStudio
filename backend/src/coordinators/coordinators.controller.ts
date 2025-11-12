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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CoordinatorsService } from './coordinators.service';
import { CreateCoordinatorDto, UpdateCoordinatorDto, CoordinatorResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('coordinators')
@Controller('api/projects/:projectId/coordinators')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CoordinatorsController {
  constructor(private readonly coordinatorsService: CoordinatorsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new coordinator' })
  @ApiResponse({ status: 201, description: 'Coordinator created successfully', type: CoordinatorResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async create(
    @Param('projectId') projectId: string,
    @Body() createCoordinatorDto: CreateCoordinatorDto,
  ): Promise<CoordinatorResponseDto> {
    return this.coordinatorsService.create(projectId, createCoordinatorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all coordinators for a project' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiQuery({ name: 'domain', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Coordinators retrieved successfully', type: [CoordinatorResponseDto] })
  async findAll(
    @Param('projectId') projectId: string,
    @Query('active') active?: string,
    @Query('domain') domain?: string,
    @Query('search') search?: string,
  ): Promise<CoordinatorResponseDto[]> {
    const options: any = {};

    if (active !== undefined) {
      options.active = active === 'true';
    }

    if (domain) {
      options.domain = domain;
    }

    if (search) {
      options.search = search;
    }

    return this.coordinatorsService.findAll(projectId, options);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a coordinator by ID' })
  @ApiQuery({ name: 'includeStats', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Coordinator retrieved successfully', type: CoordinatorResponseDto })
  @ApiResponse({ status: 404, description: 'Coordinator not found' })
  async findOne(
    @Param('id') id: string,
    @Query('includeStats') includeStats?: string,
  ): Promise<CoordinatorResponseDto> {
    return this.coordinatorsService.findOne(id, includeStats === 'true');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a coordinator' })
  @ApiResponse({ status: 200, description: 'Coordinator updated successfully', type: CoordinatorResponseDto })
  @ApiResponse({ status: 404, description: 'Coordinator not found' })
  async update(
    @Param('id') id: string,
    @Body() updateCoordinatorDto: UpdateCoordinatorDto,
  ): Promise<CoordinatorResponseDto> {
    return this.coordinatorsService.update(id, updateCoordinatorDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a coordinator' })
  @ApiResponse({ status: 204, description: 'Coordinator deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete coordinator with execution history' })
  @ApiResponse({ status: 404, description: 'Coordinator not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.coordinatorsService.remove(id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a coordinator' })
  @ApiResponse({ status: 200, description: 'Coordinator deactivated successfully', type: CoordinatorResponseDto })
  @ApiResponse({ status: 404, description: 'Coordinator not found' })
  async deactivate(@Param('id') id: string): Promise<CoordinatorResponseDto> {
    return this.coordinatorsService.deactivate(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a coordinator' })
  @ApiResponse({ status: 200, description: 'Coordinator activated successfully', type: CoordinatorResponseDto })
  @ApiResponse({ status: 404, description: 'Coordinator not found' })
  async activate(@Param('id') id: string): Promise<CoordinatorResponseDto> {
    return this.coordinatorsService.activate(id);
  }
}
