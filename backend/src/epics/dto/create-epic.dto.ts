import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export class CreateEpicDto {
  @ApiProperty({ description: 'Project ID' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ description: 'Epic title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Epic description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Priority (0-10)', minimum: 0, maximum: 10, default: 0 })
  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  priority?: number;
}
