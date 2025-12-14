import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateProjectDto, UpdateProjectDto } from './dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller('projects')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all projects' })
  @ApiResponse({ status: 200, description: 'Return all projects' })
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiResponse({ status: 200, description: 'Return project details' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.pm, UserRole.architect)
  @ApiOperation({ summary: 'Create a new project (Admin, PM, Architect)' })
  @ApiResponse({ status: 201, description: 'Project successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request - project already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.pm, UserRole.architect)
  @ApiOperation({ summary: 'Update project (Admin, PM, Architect)' })
  @ApiResponse({ status: 200, description: 'Project successfully updated' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Delete project (Admin only)' })
  @ApiResponse({ status: 200, description: 'Project successfully deleted' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  // Taxonomy Management Endpoints
  @Get(':id/taxonomy')
  @ApiOperation({ summary: 'List taxonomy areas for a project' })
  @ApiResponse({ status: 200, description: 'Return taxonomy areas with usage counts' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  listTaxonomy(@Param('id') projectId: string) {
    return this.projectsService.listTaxonomy(projectId);
  }

  @Post(':id/taxonomy')
  @Roles(UserRole.admin, UserRole.pm, UserRole.architect, UserRole.ba)
  @ApiOperation({ summary: 'Add a new taxonomy area (Admin, PM, Architect, BA)' })
  @ApiResponse({ status: 201, description: 'Taxonomy area successfully added' })
  @ApiResponse({ status: 400, description: 'Bad request - area already exists or similar area found' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  addTaxonomyArea(
    @Param('id') projectId: string,
    @Body('area') area: string,
    @Body('force') force?: boolean,
  ) {
    return this.projectsService.addTaxonomyArea(projectId, area, force);
  }

  @Delete(':id/taxonomy/:area')
  @Roles(UserRole.admin, UserRole.pm, UserRole.architect)
  @ApiOperation({ summary: 'Remove a taxonomy area (Admin, PM, Architect)' })
  @ApiResponse({ status: 200, description: 'Taxonomy area successfully removed' })
  @ApiResponse({ status: 400, description: 'Bad request - area has use cases' })
  @ApiResponse({ status: 404, description: 'Project or area not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  removeTaxonomyArea(
    @Param('id') projectId: string,
    @Param('area') area: string,
    @Query('force') force?: string,
  ) {
    return this.projectsService.removeTaxonomyArea(projectId, area, force === 'true');
  }

  @Patch(':id/taxonomy/:area')
  @Roles(UserRole.admin, UserRole.pm, UserRole.architect, UserRole.ba)
  @ApiOperation({ summary: 'Rename a taxonomy area (Admin, PM, Architect, BA)' })
  @ApiResponse({ status: 200, description: 'Taxonomy area successfully renamed' })
  @ApiResponse({ status: 400, description: 'Bad request - new name already exists' })
  @ApiResponse({ status: 404, description: 'Project or area not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  renameTaxonomyArea(
    @Param('id') projectId: string,
    @Param('area') area: string,
    @Body('newName') newName: string,
  ) {
    return this.projectsService.renameTaxonomyArea(projectId, area, newName);
  }

  @Post(':id/taxonomy/merge')
  @Roles(UserRole.admin, UserRole.pm, UserRole.architect)
  @ApiOperation({ summary: 'Merge multiple taxonomy areas (Admin, PM, Architect)' })
  @ApiResponse({ status: 200, description: 'Taxonomy areas successfully merged' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid areas or target' })
  @ApiResponse({ status: 404, description: 'Project or areas not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  mergeTaxonomyAreas(
    @Param('id') projectId: string,
    @Body('sourceAreas') sourceAreas: string[],
    @Body('targetArea') targetArea: string,
  ) {
    return this.projectsService.mergeTaxonomyAreas(projectId, sourceAreas, targetArea);
  }

  @Post(':id/taxonomy/validate')
  @ApiOperation({ summary: 'Validate a taxonomy area name' })
  @ApiResponse({ status: 200, description: 'Return validation result with suggestions' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  validateTaxonomyArea(
    @Param('id') projectId: string,
    @Body('area') area: string,
  ) {
    return this.projectsService.validateTaxonomyArea(projectId, area);
  }

  @Get(':id/taxonomy/suggest')
  @ApiOperation({ summary: 'Get similar taxonomy areas for a given input' })
  @ApiResponse({ status: 200, description: 'Return similar areas' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  suggestTaxonomyAreas(
    @Param('id') projectId: string,
    @Query('area') area: string,
  ) {
    return this.projectsService.suggestTaxonomyAreas(projectId, area);
  }
}
