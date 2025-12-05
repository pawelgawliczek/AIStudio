/**
 * DTOs for Transcript Streaming Subscriptions (ST-176)
 */

import { IsNotEmpty, IsUUID } from 'class-validator';

export class TranscriptSubscriptionDto {
  @IsNotEmpty({ message: 'componentRunId is required' })
  @IsUUID('4', { message: 'Invalid componentRunId format' })
  componentRunId: string;
}
