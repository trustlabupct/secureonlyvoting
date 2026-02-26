import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
  IsInt,
  Min,
  Max,
  ValidateIf,
  IsObject,
  IsNumber,
  ValidationOptions,
  registerDecorator,
  ValidationArguments,
  IsBoolean,
  IsEnum,
  IsDate,
  ArrayMinSize,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RatingScaleDto } from './rating-scale.dto';
import { PollVisibility, ShowResultsTo } from './poll.entity';
import { SanitizeString } from '../../common/sanitizer';

// Custom validator: IsGreaterThan
function IsGreaterThan(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isGreaterThan',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          // Ensure both values are numbers before comparing
          if (typeof value !== 'number' || typeof relatedValue !== 'number') {
            return false;
          }
          return value > relatedValue;
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          return `${args.property} must be greater than ${relatedPropertyName}`;
        },
      },
    });
  };
}

// Basic structure for an option if provided during creation
export class OptionDto {
  @IsString()
  @SanitizeString()
  name!: string;

  @IsString()
  @IsOptional()
  @SanitizeString()
  description?: string;
}

export class CreatePollDto {
  @IsNotEmpty()
  @IsString()
  @SanitizeString()
  name: string;

  @IsOptional()
  @IsString()
  @SanitizeString()
  description?: string;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  startTime: Date;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  endTime: Date;

  @IsOptional()
  @IsString()
  @SanitizeString()
  votingMechanism?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RatingScaleDto)
  ratingScale?: RatingScaleDto;

  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @IsEnum(PollVisibility)
  @IsOptional()
  visibility?: PollVisibility;

  @IsOptional()
  @ValidateIf((o) => o.visibility === PollVisibility.SPECIFIC_GROUPS)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  allowedGroups?: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ShowResultsTo, { each: true })
  @IsOptional()
  showResultsTo?: ShowResultsTo[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  @IsOptional()
  options?: OptionDto[];

  @IsBoolean()
  @IsOptional()
  anonymous?: boolean;

  @IsBoolean()
  @IsOptional()
  showResults?: boolean;
}
