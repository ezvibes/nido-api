import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PromptPreviewDto {
  @IsObject()
  event: Record<string, unknown>;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiPrompt?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiContext?: string;
}
