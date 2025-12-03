/**
 * Call Tool DTO (Tasks 1.2, 1.2a)
 *
 * Request body for executing an MCP tool.
 * Includes strict validation to prevent injection attacks.
 *
 * @see ST-163 Task 1.2: Implement DTOs
 * @see ST-163 Task 1.2a: Define Detailed Input Validation Rules
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, Matches, MaxLength } from 'class-validator';

export class CallToolDto {
  @ApiProperty({
    description: 'MCP tool name (alphanumeric, hyphens, underscores only)',
    example: 'list_projects',
    pattern: '^[a-zA-Z0-9_-]+$',
    maxLength: 100,
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Tool name must contain only alphanumeric characters, hyphens, and underscores',
  })
  @MaxLength(100, {
    message: 'Tool name must not exceed 100 characters',
  })
  toolName: string;

  @ApiProperty({
    description: 'Tool arguments as key-value pairs',
    example: { projectId: '550e8400-e29b-41d4-a716-446655440000' },
    type: 'object',
  })
  @IsObject()
  // Note: Don't use @ValidateNested() here - it causes forbidNonWhitelisted
  // to reject all properties since Object has no defined properties.
  // Tool-specific validation is handled by the tool handlers themselves.
  arguments: Record<string, any>;

  @ApiProperty({
    description: 'Session ID (UUID format with sess_ prefix)',
    example: 'sess_550e8400e29b41d4a716446655440000',
  })
  @IsString()
  @Matches(/^sess_[a-f0-9]{32}$/, {
    message: 'Invalid session ID format. Expected: sess_{32-char hex}',
  })
  sessionId: string;
}
