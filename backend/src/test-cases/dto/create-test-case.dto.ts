import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestCaseType, TestPriority } from '@prisma/client';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsJSON } from 'class-validator';

export class CreateTestCaseDto {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ description: 'Use case ID this test case covers' })
  @IsUUID()
  @IsNotEmpty()
  useCaseId: string;

  @ApiProperty({ description: 'Test case key (e.g., TC-AUTH-101)', example: 'TC-AUTH-101' })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({ description: 'Test case title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Test case description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Test level',
    enum: TestCaseType,
    example: 'unit'
  })
  @IsEnum(TestCaseType)
  @IsNotEmpty()
  testLevel: TestCaseType;

  @ApiPropertyOptional({
    description: 'Priority level',
    enum: TestPriority,
    default: 'medium'
  })
  @IsEnum(TestPriority)
  @IsOptional()
  priority?: TestPriority;

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
