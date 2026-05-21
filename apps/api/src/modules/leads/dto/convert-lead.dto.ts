import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class ConvertLeadDto {
  @IsString()
  @MinLength(1)
  dealTitle!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  dealValue?: number;

  @IsUUID()
  pipelineId!: string;

  @IsUUID()
  stageId!: string;

  @IsUUID()
  ownerId!: string;
}
