import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class AuditableEventDto {
  @ApiProperty({ description: 'Artist or band name', example: 'Big Something' })
  @IsString()
  artistName: string;

  @ApiProperty({ description: 'Venue name', example: 'Lincoln Theatre' })
  @IsString()
  venueName: string;

  @ApiProperty({ description: 'City', example: 'Raleigh', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ description: 'Genres', example: ['Jam', 'Funk'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @ApiProperty({ description: 'Date string', example: '2026-11-06', required: false })
  @IsOptional()
  @IsString()
  date?: string;
}

export class AuditDistributionDto {
  @ApiProperty({
    description: 'Array of candidate concerts to audit for distribution balance',
    type: [AuditableEventDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuditableEventDto)
  events: AuditableEventDto[];
}
