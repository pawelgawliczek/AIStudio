import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';

export class FilterTestExecutionDto {
  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filter by test execution status', enum: ['pass', 'fail', 'skip', 'error'] })
  @IsOptional()
  @IsEnum(['pass', 'fail', 'skip', 'error'])
  status?: 'pass' | 'fail' | 'skip' | 'error';

  @ApiPropertyOptional({ description: 'Filter by test level', enum: ['unit', 'integration', 'e2e'] })
  @IsOptional()
  @IsEnum(['unit', 'integration', 'e2e'])
  testLevel?: 'unit' | 'integration' | 'e2e';

  @ApiPropertyOptional({ description: 'Filter by executed date from (ISO 8601)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by executed date to (ISO 8601)' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
