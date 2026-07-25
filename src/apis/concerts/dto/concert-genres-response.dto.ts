import { ApiProperty } from '@nestjs/swagger';

export class ConcertGenresResponseDto {
  @ApiProperty({
    description:
      'Distinct, trimmed, non-empty Concert genre values currently in use, sorted alphabetically. Capitalization matches stored values so results remain compatible with the exact-match GET /concerts?genre= filter.',
    type: [String],
    example: ['Electronic', 'Indie Rock', 'Rock'],
  })
  genres: string[];
}
