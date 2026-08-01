import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ConcertCatalogStatus } from '../entities/concert.entity';

export class UpdateAdminConcertDto {
  @ApiProperty({
    description: 'Version returned by the latest admin read.',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  genre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsISO8601()
  endsAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  venueId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ enum: ConcertCatalogStatus })
  @IsOptional()
  @IsEnum(ConcertCatalogStatus)
  catalogStatus?: ConcertCatalogStatus;

  @ApiPropertyOptional({ description: 'Manual editorial feature state.' })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description:
      'Allow future calendar sync runs to update source-managed content again.',
  })
  @IsOptional()
  @IsBoolean()
  resumeSyncUpdates?: boolean;
}
