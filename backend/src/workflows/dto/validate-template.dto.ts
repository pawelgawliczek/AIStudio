import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsArray, ValidateNested } from 'class-validator';

export class ComponentAssignmentInput {
  @ApiProperty({ description: 'Component name', example: 'Fullstack Developer' })
  @IsString()
  componentName: string;

  @ApiProperty({ description: 'Component UUID' })
  @IsString()
  componentId: string;

  @ApiProperty({ description: 'Version UUID' })
  @IsString()
  versionId: string;

  @ApiProperty({ description: 'Version string', example: 'v0.2' })
  @IsString()
  version: string;
}

export class ValidateTemplateDto {
  @ApiProperty({ description: 'Coordinator instructions with {{template}} references' })
  @IsString()
  instructions: string;

  @ApiProperty({
    description: 'Component assignments for validation',
    type: [ComponentAssignmentInput],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentAssignmentInput)
  componentAssignments: ComponentAssignmentInput[];
}

export class TemplateReferenceDto {
  @ApiProperty({ description: 'Component name referenced' })
  name: string;

  @ApiProperty({ description: 'Start index in the instructions string' })
  startIndex: number;

  @ApiProperty({ description: 'End index in the instructions string' })
  endIndex: number;
}

export class TemplateErrorDto {
  @ApiProperty({ description: 'Invalid component reference' })
  reference: string;

  @ApiProperty({ description: 'Error message' })
  message: string;

  @ApiProperty({ description: 'Start index of the error' })
  startIndex: number;

  @ApiProperty({ description: 'End index of the error' })
  endIndex: number;
}

export class ValidateTemplateResponseDto {
  @ApiProperty({ description: 'Whether the template is valid' })
  valid: boolean;

  @ApiProperty({ description: 'All references found in the template', type: [TemplateReferenceDto] })
  references: TemplateReferenceDto[];

  @ApiProperty({ description: 'Validation errors', type: [TemplateErrorDto] })
  errors: TemplateErrorDto[];

  @ApiProperty({ description: 'List of missing component names', type: [String] })
  missingComponents: string[];
}
