import { IsString, IsOptional, IsUrl, MinLength, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';

export class UpdateProjectDto {
  @ApiPropertyOptional({
    description: 'Project name',
    example: 'AI Studio',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Project description',
    example: 'AI Studio MCP Control Plane for managing AI-assisted development',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Project repository URL',
    example: 'https://github.com/username/project',
  })
  @IsUrl()
  @IsOptional()
  repositoryUrl?: string;

  @ApiPropertyOptional({
    description: 'Project status',
    enum: ProjectStatus,
  })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;
}
