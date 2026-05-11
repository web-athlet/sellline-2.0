import { IsEnum, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum PulseTab {
  FOLLOWUPS = 'followups',
  MISSED = 'missed',
  OPPORTUNITIES = 'opportunities',
}

export class QueryPulseFeedDto {
  @IsISO8601({ strict: true })
  @IsOptional()
  date?: string;

  @IsEnum(PulseTab)
  @IsOptional()
  tab?: PulseTab = PulseTab.FOLLOWUPS;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
