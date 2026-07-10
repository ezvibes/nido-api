import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VenueResponseDto } from '../../venues/dto/venue-response.dto';

export class EventResponseDto {
  @ApiProperty({ description: 'The unique UUID of the event', example: 'd3b07384-d113-41e8-ae36-418ae1688d35' })
  id: string;

  @ApiProperty({ description: 'The title of the event', example: 'The Floozies Live at Cat\'s Cradle' })
  title: string;

  @ApiPropertyOptional({ description: 'Detailed description of the event', example: 'An evening of live electronic funk music.', nullable: true })
  description?: string | null;

  @ApiProperty({ description: 'ISO date and time of the event start', example: '2026-07-24T19:00:00.000Z' })
  dateTime: string;

  @ApiPropertyOptional({ description: 'URL to purchase tickets', example: 'https://example.com/tickets', nullable: true })
  ticketUrl?: string | null;

  @ApiProperty({ description: 'The unique UUID of the venue', example: '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e' })
  venueId: string;

  @ApiProperty({ description: 'The linked venue profile details', type: VenueResponseDto })
  venue: VenueResponseDto;

  @ApiProperty({ description: 'Record creation timestamp', example: '2026-06-16T01:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ description: 'Record update timestamp', example: '2026-06-16T01:00:00.000Z' })
  updatedAt: string;
}
