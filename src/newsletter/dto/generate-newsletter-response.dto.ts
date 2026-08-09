import { ApiProperty } from '@nestjs/swagger';

export class GenerateNewsletterResponseDto {
  @ApiProperty({
    description: 'The generated markdown newsletter draft',
  })
  newsletterDraft: string;

  @ApiProperty({
    description: 'The number of concerts evaluated/included in the prompt',
  })
  concertsCount: number;

  @ApiProperty({
    description: 'The list of parsed and filtered concerts used in the generation',
  })
  concerts: any[];
}
