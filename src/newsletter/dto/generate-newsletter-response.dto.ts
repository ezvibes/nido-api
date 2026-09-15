import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BeehiivDraftSummaryDto {
  @ApiProperty({ example: 'post_12345abc' })
  id: string;

  @ApiProperty({ example: 'EZ Vibes Top Picks: Tuesday, Sep 8 - Sunday, Sep 13, 2026' })
  title: string;

  @ApiProperty({ example: 'draft' })
  status: string;

  @ApiPropertyOptional({ example: 'https://beehiiv.com/posts/post_12345abc' })
  web_url?: string;
}

export class GenerateNewsletterResponseDto {
  @ApiProperty({
    description: 'The generated markdown newsletter draft content',
  })
  newsletterDraft: string;

  @ApiProperty({
    description: 'Total number of approved concerts included in prompt context',
    example: 12,
  })
  concertsCount: number;

  @ApiPropertyOptional({
    description: 'Beehiiv draft response details if autoPushToBeehiiv was set to true',
    type: BeehiivDraftSummaryDto,
  })
  beehiivDraft?: BeehiivDraftSummaryDto;
}
