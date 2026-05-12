import { ActivityType, Priority } from '@nextgen/db';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  registerDecorator,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'hasLinkedEntity', async: false })
export class HasLinkedEntityConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const obj = args.object as Record<string, unknown>;
    return !!(obj['dealId'] || obj['personId'] || obj['orgId']);
  }
  defaultMessage(): string {
    return 'Bitte verknüpfen Sie diese Aktivität mit einem Deal, einer Person oder einer Organisation.';
  }
}

function HasLinkedEntity() {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: { always: true },
      constraints: [],
      validator: HasLinkedEntityConstraint,
    });
  };
}

export class CreateActivityDto {
  @IsEnum(ActivityType)
  type!: ActivityType;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsUUID()
  dealId?: string;

  @IsOptional()
  @IsUUID()
  personId?: string;

  @IsOptional()
  @IsUUID()
  orgId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  // Cross-field validator: at least one of dealId / personId / orgId must be set.
  @HasLinkedEntity()
  readonly _linkedEntity: undefined = undefined;
}
