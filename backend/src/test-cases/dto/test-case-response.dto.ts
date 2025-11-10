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
  description?: string;

  @ApiProperty({ enum: TestCaseType })
  testLevel: TestCaseType;

  @ApiProperty({ enum: TestPriority })
  priority: TestPriority;

  @ApiProperty({ enum: TestCaseStatus })
  status: TestCaseStatus;

  @ApiPropertyOptional()
  preconditions?: string;

  @ApiPropertyOptional()
  testSteps?: string;

  @ApiPropertyOptional()
  expectedResults?: string;

  @ApiPropertyOptional({ type: 'object' })
  testData?: any;

  @ApiPropertyOptional()
  testFilePath?: string;

  @ApiPropertyOptional()
  assignedToId?: string;

  @ApiProperty()
  createdById: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Optional included relations
  @ApiPropertyOptional({ type: 'object' })
  useCase?: any;

  @ApiPropertyOptional({ type: 'object' })
  assignedTo?: any;

  @ApiPropertyOptional({ type: 'object' })
  createdBy?: any;

  @ApiPropertyOptional({ type: 'array' })
  executions?: any[];
}
