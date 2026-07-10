import { IsNotEmpty, IsOptional, IsString, IsDateString, IsUUID, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({ description: 'The title of the event', example: 'The Floozies Live at Cat\'s Cradle' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Detailed description of the event', example: 'An evening of live electronic funk music.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'ISO date and time of the event start', example: '2026-07-24T19:00:00.000Z' })
  @IsDateString()
  dateTime: string;

  @ApiPropertyOptional({ description: 'URL to purchase tickets', example: 'https://example.com/tickets' })
  @IsOptional()
  @IsUrl()
  ticketUrl?: string;

  @ApiProperty({ description: 'The unique UUID of the venue', example: '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e' })
  @IsUUID()
  venueId: string;
}
