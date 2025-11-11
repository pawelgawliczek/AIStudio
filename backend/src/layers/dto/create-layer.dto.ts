import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsArray, IsInt, IsEnum } from 'class-validator';
import { LayerStatus } from '@prisma/client';

export class CreateLayerDto {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ description: 'Layer name (e.g., Frontend, Backend API)' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Layer description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Technology stack', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @ApiProperty({ description: 'Display order index' })
  @IsInt()
  orderIndex: number;

  @ApiPropertyOptional({ description: 'Color hex code' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Icon (emoji or name)' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Layer status', enum: LayerStatus })
  @IsOptional()
  @IsEnum(LayerStatus)
  status?: LayerStatus;
}
