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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request as ExpressRequest } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateUseCaseDto,
  UpdateUseCaseDto,
  SearchUseCasesDto,
  LinkUseCaseToStoryDto,
  UseCaseResponse,
} from './dto';
import { UseCasesService } from './use-cases.service';

@ApiTags('Use Cases')
@Controller('use-cases')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UseCasesController {
  constructor(private readonly useCasesService: UseCasesService) {}

  @Post()
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba)
  @ApiOperation({ summary: 'Create a new use case' })
  @ApiResponse({ status: 201, description: 'Use case created successfully', type: UseCaseResponse })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async create(@Request() req: ExpressRequest & { user: any }, @Body() createUseCaseDto: CreateUseCaseDto): Promise<UseCaseResponse> {
    return this.useCasesService.create(createUseCaseDto, req.user.userId);
  }

  @Get()
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba, UserRole.architect, UserRole.dev, UserRole.qa, UserRole.viewer)
  @ApiOperation({ summary: 'Get all use cases' })
  @ApiQuery({ name: 'projectId', required: false, description: 'Filter by project ID' })
  @ApiQuery({ name: 'area', required: false, description: 'Filter by area' })
  @ApiResponse({ status: 200, description: 'List of use cases', type: [UseCaseResponse] })
  async findAll(
    @Query('projectId') projectId?: string,
    @Query('area') area?: string,
  ): Promise<UseCaseResponse[]> {
    return this.useCasesService.findAll(projectId, area);
  }

  @Get('search')
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba, UserRole.architect, UserRole.dev, UserRole.qa, UserRole.viewer)
  @ApiOperation({ summary: 'Search use cases using different modes (semantic, text, component)' })
  @ApiResponse({ status: 200, description: 'Search results', type: [UseCaseResponse] })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async search(@Query() searchDto: SearchUseCasesDto): Promise<UseCaseResponse[]> {
    return this.useCasesService.search(searchDto);
  }

  @Get(':id')
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba, UserRole.architect, UserRole.dev, UserRole.qa, UserRole.viewer)
  @ApiOperation({ summary: 'Get a use case by ID' })
  @ApiResponse({ status: 200, description: 'Use case details', type: UseCaseResponse })
  @ApiResponse({ status: 404, description: 'Use case not found' })
  async findOne(@Param('id') id: string): Promise<UseCaseResponse> {
    return this.useCasesService.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba)
  @ApiOperation({ summary: 'Update a use case (creates new version)' })
  @ApiResponse({ status: 200, description: 'Use case updated successfully', type: UseCaseResponse })
  @ApiResponse({ status: 404, description: 'Use case not found' })
  async update(
    @Request() req: ExpressRequest & { user: any },
    @Param('id') id: string,
    @Body() updateUseCaseDto: UpdateUseCaseDto,
  ): Promise<UseCaseResponse> {
    return this.useCasesService.update(id, updateUseCaseDto, req.user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.pm)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a use case' })
  @ApiResponse({ status: 204, description: 'Use case deleted successfully' })
  @ApiResponse({ status: 404, description: 'Use case not found' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.useCasesService.remove(id);
  }

  @Post('link')
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba, UserRole.dev)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link a use case to a story' })
  @ApiResponse({ status: 200, description: 'Use case linked to story successfully' })
  @ApiResponse({ status: 404, description: 'Use case or story not found' })
  async linkToStory(@Body() linkDto: LinkUseCaseToStoryDto): Promise<{ message: string }> {
    await this.useCasesService.linkToStory(linkDto);
    return { message: 'Use case linked to story successfully' };
  }

  @Delete('link/:useCaseId/:storyId')
  @Roles(UserRole.admin, UserRole.pm, UserRole.ba, UserRole.dev)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink a use case from a story' })
  @ApiResponse({ status: 204, description: 'Use case unlinked from story successfully' })
  async unlinkFromStory(
    @Param('useCaseId') useCaseId: string,
    @Param('storyId') storyId: string,
  ): Promise<void> {
    return this.useCasesService.unlinkFromStory(useCaseId, storyId);
  }

  @Post('regenerate-embeddings')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate embeddings for all use cases (admin only)' })
  @ApiResponse({ status: 200, description: 'Embeddings regeneration started' })
  async regenerateEmbeddings(): Promise<{ message: string }> {
    // This should ideally be handled by a background job
    // For now, we'll allow manual trigger by admin
    this.useCasesService.regenerateAllEmbeddings();
    return { message: 'Embeddings regeneration started in background' };
  }
}
