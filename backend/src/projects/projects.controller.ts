import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all projects' })
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  create(@Body() body: { name: string; description?: string; repositoryUrl?: string }) {
    return this.projectsService.create(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update project' })
  update(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; description: string; status: string }>,
  ) {
    return this.projectsService.update(id, body);
  }
}
