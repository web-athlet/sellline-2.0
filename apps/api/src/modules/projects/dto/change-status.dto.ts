import { IsEnum } from 'class-validator';
import { ProjectStatus } from '@nextgen/db';

export class ChangeStatusDto {
  @IsEnum(ProjectStatus)
  status!: ProjectStatus;
}
