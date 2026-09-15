import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PushBeehiivDraftDto {
  @ApiProperty({
    description: 'Title of the Beehiiv draft post',
    example: 'EZ Vibes Top Picks: Tuesday, Sep 8 - Sunday, Sep 13, 2026',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'HTML content block string to push into the Beehiiv draft template',
    example: '<h1>Weekly Top Picks</h1><p>Check out upcoming shows!</p>',
  })
  @IsString()
  @IsNotEmpty()
  htmlContent: string;

  @ApiPropertyOptional({
    description: 'Optional Beehiiv Post Template ID to override default env configuration',
    example: 'tpl_beehiiv_123',
  })
  @IsOptional()
  @IsString()
  postTemplateId?: string;

  @ApiPropertyOptional({
    description: 'Optional Beehiiv Publication ID to override default env configuration',
    example: 'pub_beehiiv_456',
  })
  @IsOptional()
  @IsString()
  publicationId?: string;
}
