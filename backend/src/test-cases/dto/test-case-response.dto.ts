import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TestCaseType, TestPriority, TestCaseStatus } from '@prisma/client';

export class TestCaseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  useCaseId: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ enum: TestCaseType })
  testLevel: TestCaseType;

  @ApiProperty({ enum: TestPriority })
  priority: TestPriority;

  @ApiProperty({ enum: TestCaseStatus })
  status: TestCaseStatus;

  @ApiPropertyOptional()
  preconditions?: string | null;

  @ApiPropertyOptional()
  testSteps?: string | null;

  @ApiPropertyOptional()
  expectedResults?: string | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  testData?: any;

  @ApiPropertyOptional()
  testFilePath?: string | null;

  @ApiPropertyOptional()
  assignedToId?: string | null;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Optional included relations
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  useCase?: any;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  assignedTo?: any | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  createdBy?: any;

  @ApiPropertyOptional({ type: 'array' })
  executions?: any[];
}
