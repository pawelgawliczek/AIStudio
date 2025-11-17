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
import { CreateSubtaskDto, UpdateSubtaskDto, FilterSubtaskDto } from './dto';
import { SubtasksService } from './subtasks.service';

@ApiTags('subtasks')
@Controller('subtasks')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class SubtasksController {
  constructor(private readonly subtasksService: SubtasksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all subtasks with filters' })
  @ApiResponse({ status: 200, description: 'Return filtered subtasks' })
  @ApiQuery({ name: 'storyId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'layer', required: false })
  findAll(@Query() filterDto: FilterSubtaskDto) {
    return this.subtasksService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subtask by ID' })
  @ApiResponse({ status: 200, description: 'Return subtask details' })
  @ApiResponse({ status: 404, description: 'Subtask not found' })
  findOne(@Param('id') id: string) {
    return this.subtasksService.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba, UserRole.architect, UserRole.dev)
  @ApiOperation({ summary: 'Create a new subtask' })
  @ApiResponse({ status: 201, description: 'Subtask successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  create(@Body() createSubtaskDto: CreateSubtaskDto) {
    return this.subtasksService.create(createSubtaskDto);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba, UserRole.architect, UserRole.dev, UserRole.qa)
  @ApiOperation({ summary: 'Update subtask' })
  @ApiResponse({ status: 200, description: 'Subtask successfully updated' })
  @ApiResponse({ status: 404, description: 'Subtask not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  update(@Param('id') id: string, @Body() updateSubtaskDto: UpdateSubtaskDto) {
    return this.subtasksService.update(id, updateSubtaskDto);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.pm, UserRole.architect)
  @ApiOperation({ summary: 'Delete subtask' })
  @ApiResponse({ status: 200, description: 'Subtask successfully deleted' })
  @ApiResponse({ status: 404, description: 'Subtask not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  remove(@Param('id') id: string) {
    return this.subtasksService.remove(id);
  }
}
