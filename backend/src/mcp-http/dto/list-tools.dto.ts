/**
 * List Tools DTO (Tasks 1.2, 1.2a)
 *
 * Request parameters for listing available MCP tools.
 * Includes validation for optional filter parameters.
 *
 * @see ST-163 Task 1.2: Implement DTOs
 * @see ST-163 Task 1.2a: Define Detailed Input Validation Rules
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Matches, MaxLength } from 'class-validator';

export class ListToolsDto {
  @ApiProperty({
    description: 'Filter by tool category',
    example: 'projects',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, {
    message: 'Category must not exceed 50 characters',
  })
  category?: string;

  @ApiProperty({
    description: 'Search query to filter tools by name or description',
    example: 'project',
    required: false,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, {
    message: 'Query must not exceed 200 characters',
  })
  query?: string;

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
