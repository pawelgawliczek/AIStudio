/**
 * Initialize Session DTO (Tasks 1.2, 1.2a)
 *
 * Request body for creating a new MCP session.
 * Includes comprehensive input validation to prevent injection attacks.
 *
 * @see ST-163 Task 1.2: Implement DTOs
 * @see ST-163 Task 1.2a: Define Detailed Input Validation Rules
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, Matches, MaxLength } from 'class-validator';

export class InitializeSessionDto {
  @ApiProperty({
    description: 'MCP protocol version (e.g., "mcp/1.0")',
    example: 'mcp/1.0',
    pattern: '^mcp\\/\\d+\\.\\d+$',
  })
  @IsString()
  @Matches(/^mcp\/\d+\.\d+$/, {
    message: 'Invalid protocol version format. Expected format: mcp/X.Y',
  })
  protocolVersion: string;

  @ApiProperty({
    description: 'Client information string (alphanumeric, spaces, hyphens, underscores, dots)',
    example: 'mcp-http-client v1.0.0',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200, {
    message: 'Client info exceeds maximum length of 200 characters',
  })
  @Matches(/^[a-zA-Z0-9\s\-_.]+$/, {
    message: 'Invalid client info format. Only alphanumeric characters, spaces, hyphens, underscores, and dots allowed',
  })
  clientInfo: string;

  @ApiProperty({
    description: 'List of client capabilities',
    example: ['tools', 'prompts', 'resources'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, {
    each: true,
    message: 'Each capability must not exceed 50 characters',
  })
  capabilities: string[];
}
