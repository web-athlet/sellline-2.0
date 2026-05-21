import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  billingFreq?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxPct?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  visibleFor?: string[];
}
