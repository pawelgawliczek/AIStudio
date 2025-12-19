/**
 * TranscriptsController - ST-329 REST API for Transcript Lines
 *
 * STUB IMPLEMENTATION - Will be implemented in next phase
 */

import { Controller, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TranscriptsService } from './transcripts.service';

@Controller('transcripts')
@UseGuards(JwtAuthGuard)
export class TranscriptsController {
  constructor(private readonly transcriptsService: TranscriptsService) {}

  @Get(':runId/lines')
  async getTranscriptLines(
    @Param('runId') runId: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('sessionIndex') sessionIndex?: string,
    @Request() req?: any,
  ) {
    throw new Error('NOT IMPLEMENTED - ST-329');
  }
}
