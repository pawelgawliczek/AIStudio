import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestExecutionStatus, TestCaseType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsUUID, IsNotEmpty, IsEnum, IsInt, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';

export class ReportTestExecutionDto {
  @ApiProperty({ description: 'Project ID (required for auto-creating test cases)' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ description: 'Test case key (e.g., TC-AUTH-001, TC-AUTO-XXX)' })
  @IsString()
  @IsNotEmpty()
  testCaseKey: string;

  @ApiProperty({ description: 'Test case title/name' })
  @IsString()
  @IsNotEmpty()
  testCaseTitle: string;

  @ApiProperty({
    description: 'Test level (unit, integration, e2e)',
    enum: TestCaseType,
    example: 'unit'
  })
  @IsEnum(TestCaseType)
  @IsNotEmpty()
  testLevel: TestCaseType;

  @ApiPropertyOptional({ description: 'Story ID that triggered this test' })
  @IsUUID()
  @IsOptional()
  storyId?: string;

  @ApiPropertyOptional({ description: 'Commit hash that triggered this test' })
  @IsString()
  @IsOptional()
  commitHash?: string;

  @ApiProperty({
    description: 'Test execution status',
    enum: TestExecutionStatus,
    example: 'pass'
  })
  @IsEnum(TestExecutionStatus)
  @IsNotEmpty()
  status: TestExecutionStatus;

  @ApiPropertyOptional({ description: 'Test duration in milliseconds' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  durationMs?: number;

  @ApiPropertyOptional({ description: 'Error message if test failed' })
  @IsString()
  @IsOptional()
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Coverage percentage (0-100)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  coveragePercentage?: number;

  @ApiPropertyOptional({ description: 'Number of lines covered' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  linesCovered?: number;

  @ApiPropertyOptional({ description: 'Total number of lines' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  linesTotal?: number;

  @ApiPropertyOptional({ description: 'CI/CD run ID' })
  @IsString()
  @IsOptional()
  ciRunId?: string;

  @ApiPropertyOptional({ description: 'Environment (dev, staging, prod, docker)' })
  @IsString()
  @IsOptional()
  environment?: string;
}
