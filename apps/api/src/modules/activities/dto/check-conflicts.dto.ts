import { IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class CheckConflictsDto {
  @IsISO8601()
  startTime!: string;

  @IsISO8601()
  endTime!: string;

  @IsOptional()
  @IsUUID()
  excludeId?: string;
}
