import { IsString, IsOptional, IsUrl, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({
    description: 'Project name',
    example: 'AI Studio',
    minLength: 2,
  })
  @IsString()
  @MinLength(2)
  name: string;

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
}
