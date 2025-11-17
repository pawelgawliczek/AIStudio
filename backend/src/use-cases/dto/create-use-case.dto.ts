import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, MaxLength, IsNotEmpty } from 'class-validator';

export class CreateUseCaseDto {
  @ApiProperty({
    description: 'Project ID this use case belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({
    description: 'Use case key (unique within project, e.g., UC-AUTH-001)',
    example: 'UC-AUTH-001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  key: string;

  @ApiProperty({
    description: 'Use case title',
    example: 'User Login',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Feature area (screen/flow/feature area)',
    example: 'Authentication',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  area?: string;

  @ApiProperty({
    description: 'Use case content (markdown)',
    example: '## Main Flow\n1. User enters credentials...',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Summary of the use case',
    example: 'Handles user login with email and password',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  summary?: string;
}
