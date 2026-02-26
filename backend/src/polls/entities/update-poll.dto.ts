import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsDate,
} from 'class-validator';
import { CreatePollDto, OptionDto as CreateOptionDto } from './create-poll.dto'; // Import OptionDto and alias it if needed, or adjust usage below
import { PartialType } from '@nestjs/mapped-types';
import { SanitizeString } from '../../common/sanitizer';

export class UpdateOptionDto {
  @IsUUID()
  @IsOptional()
  id?: string; // Keep option ID for identifying which to update

  @IsString()
  @IsNotEmpty()
  @SanitizeString()
  name: string;

  @IsString()
  @IsOptional()
  @SanitizeString()
  description?: string;
}

export class UpdatePollDto extends PartialType(CreatePollDto) {
  @IsString()
  @IsOptional()
  @SanitizeString()
  name?: string;

  @IsString()
  @IsOptional()
  @SanitizeString()
  description?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startTime?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endTime?: Date;

  @IsString()
  @IsOptional()
  @SanitizeString()
  votingMechanism?: string;

  // For updating existing options
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateOptionDto)
  options?: UpdateOptionDto[];

  // For adding new options
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  newOptions?: CreateOptionDto[];

  // For deleting options
  @IsArray()
  @IsOptional()
  @IsUUID(undefined, { each: true })
  deleteOptions?: string[];
}
