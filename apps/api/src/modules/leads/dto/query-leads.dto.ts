import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { EnrichmentStatus } from '@nextgen/db';

export class QueryLeadsDto {
  @IsOptional()
  @IsEnum(EnrichmentStatus)
  enrichmentStatus?: EnrichmentStatus;

  @IsOptional()
  @IsUUID()
  formId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
