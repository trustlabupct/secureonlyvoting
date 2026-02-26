import {
  IsInt,
  Min,
  ValidateNested,
  IsObject,
  IsString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SanitizeString } from '../../common/sanitizer';

class LabelsDto {
  @IsString()
  @SanitizeString()
  min!: string;

  @IsString()
  @SanitizeString()
  max!: string;

  @IsOptional()
  @IsString()
  @SanitizeString()
  mid?: string;
}

export class RatingScaleDto {
  @IsInt()
  @Min(0)
  min!: number;

  @IsInt()
  @Min(1)
  max!: number;

  @IsInt()
  @Min(1)
  step!: number;

  @ValidateNested()
  @Type(() => LabelsDto)
  @IsObject()
  labels!: LabelsDto;
}
