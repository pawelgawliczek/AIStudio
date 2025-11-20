import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateUseCaseDto {
  @ApiPropertyOptional({
    description: 'Updated use case title',
    example: 'User Login with 2FA',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated feature area',
    example: 'Authentication',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  area?: string;

  @ApiPropertyOptional({
    description: 'Updated use case content (markdown)',
    example: '## Main Flow\n1. User enters credentials...',
  })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({
    description: 'Updated summary',
    example: 'Handles user login with email, password, and 2FA',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  summary?: string;
}
