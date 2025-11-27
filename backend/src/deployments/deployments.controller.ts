import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DeploymentStatus } from '@prisma/client';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DeploymentsService } from './deployments.service';

@ApiTags('deployments')
@Controller('deployments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all deployments with filters' })
  @ApiResponse({ status: 200, description: 'Return filtered deployments' })
  @ApiQuery({ name: 'status', required: false, enum: DeploymentStatus })
  @ApiQuery({ name: 'environment', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  findAll(
    @Query('status') status?: DeploymentStatus,
    @Query('environment') environment?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.deploymentsService.findAll({
      status,
      environment,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get deployment statistics' })
  @ApiResponse({ status: 200, description: 'Return deployment stats' })
  getStats() {
    return this.deploymentsService.getStats();
  }

  @Get('story/:storyId')
  @ApiOperation({ summary: 'Get deployments for a specific story' })
  @ApiResponse({ status: 200, description: 'Return story deployments' })
  findByStoryId(@Param('storyId') storyId: string) {
    return this.deploymentsService.findByStoryId(storyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deployment by ID' })
  @ApiResponse({ status: 200, description: 'Return deployment details' })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  async findOne(@Param('id') id: string) {
    const deployment = await this.deploymentsService.findById(id);
    if (!deployment) {
      throw new NotFoundException(`Deployment with ID ${id} not found`);
    }
    return deployment;
  }
}
