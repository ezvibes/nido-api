import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface Venue {
  name: string;
  city?: string;
  state?: string;
  country?: string;
}

export class VenueDto implements Venue {
  @ApiProperty({
    description: 'Venue name, optionally including room or stage.',
    example: 'The Evening Muse',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Venue city.',
    example: 'Charlotte',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Venue state or region.',
    example: 'NC',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'Venue country.',
    example: 'US',
  })
  @IsOptional()
  @IsString()
  country?: string;
}
