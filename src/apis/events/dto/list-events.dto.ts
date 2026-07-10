import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';

export class ListEventsDto {
  @ApiPropertyOptional({ description: 'Fuzzy search by event title or description' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by specific venue ID' })
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({ description: 'Filter events starting after this ISO date' })
  @IsOptional()
  @IsDateString()
  startsAfter?: string;

  @ApiPropertyOptional({ description: 'Filter events starting before this ISO date' })
  @IsOptional()
  @IsDateString()
  startsBefore?: string;
}
