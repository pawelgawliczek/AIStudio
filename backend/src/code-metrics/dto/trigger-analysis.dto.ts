import { IsBoolean, IsOptional } from 'class-validator';

export class TriggerAnalysisDto {
  @IsOptional()
  @IsBoolean()
  runCoverage?: boolean;
}
