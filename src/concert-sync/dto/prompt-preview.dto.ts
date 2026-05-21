import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromptPreviewDto {
  @ApiProperty({
    description: 'Calendar event payload to preview after sanitization.',
    example: {
      id: 'preview-evt-1',
      summary: 'Rooftop Set with Neon Tide',
      description:
        'Contact artist@example.com https://tickets.example.com +1 (212) 555-9876',
      location: 'Skyline Loft, Brooklyn, NY',
      start: { dateTime: '2026-06-15T20:00:00.000Z' },
    },
  })
  @IsObject()
  event: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiPrompt?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiContext?: string;
}
