import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ConcertCatalogStatus } from '../entities/concert.entity';

export class UpdateAdminConcertDto {
  @ApiProperty({
    description:
      'Version returned by the latest admin list or detail read. The API returns 409 instead of overwriting a newer record.',
    minimum: 1,
    example: 7,
  })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional({
    description: 'Public concert title. Trimmed before validation and storage.',
    maxLength: 255,
    example: 'Summer Jam at The Pour House',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Primary genre. Trimmed before validation and storage.',
    maxLength: 120,
    example: 'Indie Rock',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  genre?: string;

  @ApiPropertyOptional({
    description: 'Concert start timestamp in ISO-8601 format.',
    example: '2026-08-15T23:00:00.000Z',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Concert end timestamp, or null to clear it.',
    example: '2026-08-16T02:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  endsAt?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Venue UUID, or null to remove the venue assignment.',
  })
  @IsOptional()
  @IsUUID()
  venueId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Public description, or null to clear it.',
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    enum: ConcertCatalogStatus,
    description:
      'Authoritative public lifecycle state. Hidden and archived records are excluded from discovery.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(ConcertCatalogStatus)
  catalogStatus?: ConcertCatalogStatus;

  @ApiPropertyOptional({
    description:
      'Manual editorial Featured state. Only active concerts can be Featured.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description:
      'Allow future calendar sync runs to update source-managed content again.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  resumeSyncUpdates?: boolean;
}
