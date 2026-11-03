import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class NewsletterFeedbackDiffDto {
  @ApiProperty({
    description: 'Beehiiv post ID to retrieve published version from',
    example: 'post_12345678',
  })
  @IsString()
  postId: string;

  @ApiProperty({
    description: 'Original staged draft content (markdown or HTML) to compare against published version',
    example: '## 1. Top Picks\n\n- **Big Something** @ Lincoln Theatre...',
  })
  @IsString()
  draftContent: string;

  @ApiProperty({
    description: 'Optional Beehiiv publication ID override',
    required: false,
    example: 'pub_83e3968e-2648-46bd-b71b-ac9a35e4bab4',
  })
  @IsOptional()
  @IsString()
  publicationId?: string;
}
