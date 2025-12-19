/**
 * TranscriptsService - ST-329 Business Logic for Transcript Lines
 *
 * STUB IMPLEMENTATION - Will be implemented in next phase
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TranscriptLinesOptions {
  offset?: number;
  limit?: number;
  sessionIndex?: number;
}

export interface TranscriptLinesResponse {
  lines: Array<{
    lineNumber: number;
    sessionIndex: number;
    content: string;
    createdAt: Date;
  }>;
  total: number;
  offset: number;
  limit: number;
}

@Injectable()
export class TranscriptsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTranscriptLines(
    runId: string,
    userId: string,
    options?: TranscriptLinesOptions,
  ): Promise<TranscriptLinesResponse> {
    throw new Error('NOT IMPLEMENTED - ST-329');
  }
}
