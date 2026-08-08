import { ApiProperty } from '@nestjs/swagger';

export class ConcertGenresResponseDto {
  @ApiProperty({
    description:
      'Configured genre options merged with distinct, trimmed, non-empty Concert genre values currently in use. Results are de-duplicated case-insensitively and sorted alphabetically.',
    type: [String],
    example: ['Bluegrass', 'Electronic', 'Funk', 'Hip-Hop', 'Jazz', 'Rock'],
  })
  genres: string[];
}
