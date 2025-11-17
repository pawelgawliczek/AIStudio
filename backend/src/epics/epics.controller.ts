import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateEpicDto, UpdateEpicDto, FilterEpicDto } from './dto';
import { EpicsService } from './epics.service';

@ApiTags('epics')
@Controller('epics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class EpicsController {
  constructor(private readonly epicsService: EpicsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all epics with filters' })
  @ApiResponse({ status: 200, description: 'Return filtered epics' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(@Query() filterDto: FilterEpicDto) {
    return this.epicsService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get epic by ID' })
  @ApiResponse({ status: 200, description: 'Return epic details with stories' })
  @ApiResponse({ status: 404, description: 'Epic not found' })
  findOne(@Param('id') id: string) {
    return this.epicsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.pm, UserRole.architect)
  @ApiOperation({ summary: 'Create a new epic (Admin, PM, Architect)' })
  @ApiResponse({ status: 201, description: 'Epic successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  create(@Body() createEpicDto: CreateEpicDto) {
    return this.epicsService.create(createEpicDto);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.pm, UserRole.architect)
  @ApiOperation({ summary: 'Update epic (Admin, PM, Architect)' })
  @ApiResponse({ status: 200, description: 'Epic successfully updated' })
  @ApiResponse({ status: 404, description: 'Epic not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  update(@Param('id') id: string, @Body() updateEpicDto: UpdateEpicDto) {
    return this.epicsService.update(id, updateEpicDto);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.pm)
  @ApiOperation({ summary: 'Delete epic (Admin, PM)' })
  @ApiResponse({ status: 200, description: 'Epic successfully deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete epic with stories' })
  @ApiResponse({ status: 404, description: 'Epic not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  remove(@Param('id') id: string) {
    return this.epicsService.remove(id);
  }

  @Patch(':id/priority')
  @Roles(UserRole.admin, UserRole.pm, UserRole.architect)
  @ApiOperation({ summary: 'Update epic priority (Admin, PM, Architect)' })
  @ApiResponse({ status: 200, description: 'Epic priority successfully updated' })
  @ApiResponse({ status: 404, description: 'Epic not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  updatePriority(@Param('id') id: string, @Body('priority') priority: number) {
    return this.epicsService.updatePriority(id, priority);
  }

  @Get('planning/overview')
  @ApiOperation({ summary: 'Get planning overview with all epics and stories' })
  @ApiResponse({ status: 200, description: 'Return planning overview' })
  @ApiQuery({ name: 'projectId', required: false })
  getPlanningOverview(@Query('projectId') projectId?: string) {
    return this.epicsService.getPlanningOverview(projectId);
  }
}
