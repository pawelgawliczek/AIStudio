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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ComponentsService } from './components.service';
import { CreateComponentDto, UpdateComponentDto, FilterComponentDto } from './dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';

@ApiTags('components')
@Controller('components')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class ComponentsController {
  constructor(private readonly componentsService: ComponentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all components with filters' })
  @ApiResponse({ status: 200, description: 'Return filtered components' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'layerId', required: false })
  findAll(@Query() filterDto: FilterComponentDto) {
    return this.componentsService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get component by ID' })
  @ApiResponse({ status: 200, description: 'Return component details' })
  @ApiResponse({ status: 404, description: 'Component not found' })
  findOne(@Param('id') id: string) {
    return this.componentsService.findOne(id);
  }

  @Get(':id/use-cases')
  @ApiOperation({ summary: 'Get component with all use cases (for BA workflow)' })
  @ApiResponse({ status: 200, description: 'Return component with use cases' })
  @ApiResponse({ status: 404, description: 'Component not found' })
  findWithUseCases(@Param('id') id: string) {
    return this.componentsService.findWithUseCases(id);
  }

  @Get(':id/stories')
  @ApiOperation({ summary: 'Get component with all related stories' })
  @ApiResponse({ status: 200, description: 'Return component with stories' })
  @ApiResponse({ status: 404, description: 'Component not found' })
  findWithStories(@Param('id') id: string) {
    return this.componentsService.findWithStories(id);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.architect)
  @ApiOperation({ summary: 'Create a new component (Admin, Architect)' })
  @ApiResponse({ status: 201, description: 'Component successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Component name already exists' })
  create(@Body() createComponentDto: CreateComponentDto) {
    return this.componentsService.create(createComponentDto);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.architect)
  @ApiOperation({ summary: 'Update component (Admin, Architect)' })
  @ApiResponse({ status: 200, description: 'Component successfully updated' })
  @ApiResponse({ status: 404, description: 'Component not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Component name already exists' })
  update(@Param('id') id: string, @Body() updateComponentDto: UpdateComponentDto) {
    return this.componentsService.update(id, updateComponentDto);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.architect)
  @ApiOperation({ summary: 'Delete component (Admin, Architect)' })
  @ApiResponse({ status: 200, description: 'Component successfully deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete component in use' })
  @ApiResponse({ status: 404, description: 'Component not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  remove(@Param('id') id: string) {
    return this.componentsService.remove(id);
  }
}
