import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

export class QueryMetricsDto {
  @ApiProperty({ required: false, description: 'Time range in days', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  timeRangeDays?: number = 30;

  @ApiProperty({ required: false, description: 'Programming language filter' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ required: false, description: 'Epic ID filter' })
  @IsOptional()
  @IsString()
  epicId?: string;

  @ApiProperty({ required: false, description: 'Story ID filter' })
  @IsOptional()
  @IsString()
  storyId?: string;

  @ApiProperty({ required: false, description: 'Cache-busting timestamp (ignored)' })
  @IsOptional()
  @IsString()
  _t?: string;
}

export class GetHotspotsDto {
  @ApiProperty({ required: false, description: 'Limit number of results', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @ApiProperty({ required: false, description: 'Minimum risk score threshold', example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  minRiskScore?: number = 50;

  @ApiProperty({ required: false, description: 'Cache-busting timestamp (ignored)' })
  @IsOptional()
  @IsString()
  _t?: string;
}
