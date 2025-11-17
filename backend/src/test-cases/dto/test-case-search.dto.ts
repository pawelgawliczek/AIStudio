import { ApiPropertyOptional } from '@nestjs/swagger';
import { TestCaseType, TestPriority, TestCaseStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsOptional, IsEnum, IsUUID, IsInt, Min } from 'class-validator';

export class TestCaseSearchDto {
  @ApiPropertyOptional({ description: 'Project ID filter' })
  @IsUUID()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Use case ID filter' })
  @IsUUID()
  @IsOptional()
  useCaseId?: string;

  @ApiPropertyOptional({
    description: 'Test level filter',
    enum: TestCaseType
  })
  @IsEnum(TestCaseType)
  @IsOptional()
  testLevel?: TestCaseType;

  @ApiPropertyOptional({
    description: 'Priority filter',
    enum: TestPriority
  })
  @IsEnum(TestPriority)
  @IsOptional()
  priority?: TestPriority;

  @ApiPropertyOptional({
    description: 'Status filter',
    enum: TestCaseStatus
  })
  @IsEnum(TestCaseStatus)
  @IsOptional()
  status?: TestCaseStatus;

  @ApiPropertyOptional({ description: 'Assigned to user ID filter' })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Include related entities', default: false })
  @IsOptional()
  includeRelations?: boolean;

  @ApiPropertyOptional({ description: 'Page number (starting from 1)', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
