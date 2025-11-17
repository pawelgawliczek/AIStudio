import { ApiPropertyOptional } from '@nestjs/swagger';
import { TestCaseType, TestPriority, TestCaseStatus } from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';

export class UpdateTestCaseDto {
  @ApiPropertyOptional({ description: 'Test case title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Test case description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Test level',
    enum: TestCaseType
  })
  @IsEnum(TestCaseType)
  @IsOptional()
  testLevel?: TestCaseType;

  @ApiPropertyOptional({
    description: 'Priority level',
    enum: TestPriority
  })
  @IsEnum(TestPriority)
  @IsOptional()
  priority?: TestPriority;

  @ApiPropertyOptional({
    description: 'Test case status',
    enum: TestCaseStatus
  })
  @IsEnum(TestCaseStatus)
  @IsOptional()
  status?: TestCaseStatus;

  @ApiPropertyOptional({ description: 'Preconditions for test execution' })
  @IsString()
  @IsOptional()
  preconditions?: string;

  @ApiPropertyOptional({ description: 'Test steps (markdown or plain text)' })
  @IsString()
  @IsOptional()
  testSteps?: string;

  @ApiPropertyOptional({ description: 'Expected results' })
  @IsString()
  @IsOptional()
  expectedResults?: string;

  @ApiPropertyOptional({ description: 'Test data (JSON object)', type: 'object' })
  @IsOptional()
  testData?: any;

  @ApiPropertyOptional({ description: 'Path to test file in repository' })
  @IsString()
  @IsOptional()
  testFilePath?: string;

  @ApiPropertyOptional({ description: 'User ID assigned to implement this test' })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;
}
