import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateBookingConfigDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(120)
  slotDuration?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  workdayStart?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  workdayEnd?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayUnique()
  activeDays?: number[];
}
