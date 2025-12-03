/**
 * Session Response DTO (Task 1.2)
 *
 * Response structure for session creation and retrieval.
 *
 * @see ST-163 Task 1.2: Implement DTOs
 */

import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({
    description: 'Unique session identifier',
    example: 'sess_550e8400e29b41d4a716446655440000',
  })
  sessionId: string;

  @ApiProperty({
    description: 'Server information',
    example: { name: 'vibestudio-mcp-server', version: '1.0.0' },
  })
  serverInfo: {
    name: string;
    version: string;
  };

  @ApiProperty({
    description: 'Server capabilities',
    example: ['tools', 'prompts', 'resources'],
    type: [String],
  })
  capabilities: string[];

  @ApiProperty({
    description: 'Session expiration timestamp (ISO 8601)',
    example: '2025-12-03T14:30:00.000Z',
  })
  expiresAt: string;

  @ApiProperty({
    description: 'Protocol version',
    example: 'mcp/1.0',
  })
  protocolVersion: string;
}
