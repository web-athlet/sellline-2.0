import { IsObject, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MinLength(1)
  source!: string;

  @IsObject()
  dataJson!: Record<string, unknown>;

  @IsUUID()
  @IsOptional()
  formId?: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  emailDomain?: string;
}
