import { ApiProperty } from '@nestjs/swagger';

export class ConcertGenreOptionResponseDto {
  @ApiProperty({
    description: 'Stable lowercase genre slug for future normalized references.',
    example: 'bluegrass',
  })
  slug: string;

  @ApiProperty({
    description: 'Human-readable genre label for selectors and display.',
    example: 'Bluegrass',
  })
  name: string;
}

export class ConcertGenresResponseDto {
  @ApiProperty({
    description:
      'Backward-compatible genre labels for current selectors. Values come from the controlled Genre catalog, not from existing Concert rows.',
    type: [String],
    example: ['Bluegrass', 'Electronic', 'Funk', 'Hip-Hop', 'Jazz', 'Rock'],
  })
  genres: string[];

  @ApiProperty({
    description:
      'Stable controlled genre options for new clients and future normalized catalog references.',
    type: [ConcertGenreOptionResponseDto],
  })
  options: ConcertGenreOptionResponseDto[];
}
