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
import { LayersService } from './layers.service';
import { CreateLayerDto, UpdateLayerDto, FilterLayerDto } from './dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';

@ApiTags('layers')
@Controller('layers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class LayersController {
  constructor(private readonly layersService: LayersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all layers with filters' })
  @ApiResponse({ status: 200, description: 'Return filtered layers' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(@Query() filterDto: FilterLayerDto) {
    return this.layersService.findAll(filterDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get layer by ID' })
  @ApiResponse({ status: 200, description: 'Return layer details' })
  @ApiResponse({ status: 404, description: 'Layer not found' })
  findOne(@Param('id') id: string) {
    return this.layersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.admin, UserRole.architect)
  @ApiOperation({ summary: 'Create a new layer (Admin, Architect)' })
  @ApiResponse({ status: 201, description: 'Layer successfully created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Layer name already exists' })
  create(@Body() createLayerDto: CreateLayerDto) {
    return this.layersService.create(createLayerDto);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.architect)
  @ApiOperation({ summary: 'Update layer (Admin, Architect)' })
  @ApiResponse({ status: 200, description: 'Layer successfully updated' })
  @ApiResponse({ status: 404, description: 'Layer not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Layer name already exists' })
  update(@Param('id') id: string, @Body() updateLayerDto: UpdateLayerDto) {
    return this.layersService.update(id, updateLayerDto);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.architect)
  @ApiOperation({ summary: 'Delete layer (Admin, Architect)' })
  @ApiResponse({ status: 200, description: 'Layer successfully deleted' })
  @ApiResponse({ status: 400, description: 'Cannot delete layer in use' })
  @ApiResponse({ status: 404, description: 'Layer not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  remove(@Param('id') id: string) {
    return this.layersService.remove(id);
  }
}
