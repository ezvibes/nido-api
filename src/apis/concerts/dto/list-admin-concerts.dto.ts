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

export enum AdminConcertApprovalFilter {
  ALL = 'all',
  APPROVED = 'approved',
  PENDING = 'pending',
}

export class ListAdminConcertsDto extends ListConcertsDto {
  @ApiPropertyOptional({
    description:
      'Catalog lifecycle state. Use all to include active, hidden, and archived records.',
    enum: AdminConcertCatalogFilter,
    default: AdminConcertCatalogFilter.ALL,
  })
  @IsOptional()
  @IsEnum(AdminConcertCatalogFilter)
  catalogStatus: AdminConcertCatalogFilter = AdminConcertCatalogFilter.ALL;

  @ApiPropertyOptional({
    description:
      'Filter concerts by admin approval status: all (default), approved, or pending (unapproved).',
    enum: AdminConcertApprovalFilter,
    default: AdminConcertApprovalFilter.ALL,
  })
  @IsOptional()
  @IsEnum(AdminConcertApprovalFilter)
  approvalStatus?: AdminConcertApprovalFilter = AdminConcertApprovalFilter.ALL;

  @ApiPropertyOptional({
    description:
      'When true, return only concerts selected for manual Featured placement.',
    example: true,
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
