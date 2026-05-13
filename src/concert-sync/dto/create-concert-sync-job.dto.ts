import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateConcertSyncJobDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  calendarId?: string;

  @ValidateIf((dto) => !Array.isArray(dto.sampleEvents) || !dto.sampleEvents.length)
  @IsString()
  googleAccessToken?: string;

  @IsISO8601()
  @IsOptional()
  fromDate?: string;

  @IsISO8601()
  @IsOptional()
  toDate?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  refreshTopPicks?: boolean = true;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiPrompt?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiContext?: string;

  @IsArray()
  @IsObject({ each: true })
  @IsOptional()
  sampleEvents?: Array<Record<string, unknown>>;
}
