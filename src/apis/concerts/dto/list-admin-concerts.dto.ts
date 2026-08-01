import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ListConcertsDto } from './list-concerts.dto';
import { ConcertCatalogStatus } from '../entities/concert.entity';

export enum AdminConcertCatalogFilter {
  ALL = 'all',
  ACTIVE = ConcertCatalogStatus.ACTIVE,
  HIDDEN = ConcertCatalogStatus.HIDDEN,
  ARCHIVED = ConcertCatalogStatus.ARCHIVED,
}

export class ListAdminConcertsDto extends ListConcertsDto {
  @ApiPropertyOptional({
    enum: AdminConcertCatalogFilter,
    default: AdminConcertCatalogFilter.ALL,
  })
  @IsOptional()
  @IsEnum(AdminConcertCatalogFilter)
  catalogStatus: AdminConcertCatalogFilter = AdminConcertCatalogFilter.ALL;

  @ApiPropertyOptional({
    description: 'Filter by manual editorial feature state.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isFeatured?: boolean;
}
