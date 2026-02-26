import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsArray,
  ArrayNotEmpty,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { SanitizeString } from '../../common/sanitizer';

export class CreateVoteDto {
  @IsOptional()
  @IsUUID()
  blindTokenId?: string;

  @IsOptional()
  @IsUUID()
  optionId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayNotEmpty()
  selectedOptionIds?: string[];

  @IsOptional()
  @IsInt()
  // Min/Max can be dynamic based on poll, but basic validation here
  ratingValue?: number;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @ArrayNotEmpty()
  rankedOptionIds?: string[];

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Text response cannot be empty or only whitespace' })
  @MaxLength(5000) // Align with VoteForm
  @SanitizeString()
  textResponse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000) // Align with VoteForm
  @SanitizeString()
  comment?: string;
}
