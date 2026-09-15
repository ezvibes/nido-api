import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum NewsletterEditionTypeEnum {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

export class GenerateNewsletterDto {
  @ApiPropertyOptional({
    description:
      'ISO start date string. If omitted, defaults to upcoming Tuesday 00:00:00 EST.',
    example: '2026-09-08T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'ISO end date string. If omitted, defaults to upcoming Sunday 23:59:59 EST.',
    example: '2026-09-13T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: NewsletterEditionTypeEnum,
    default: NewsletterEditionTypeEnum.WEEKLY,
  })
  @IsOptional()
  @IsEnum(NewsletterEditionTypeEnum)
  editionType?: NewsletterEditionTypeEnum;

  @ApiPropertyOptional({
    description: 'Human-readable date range label for prompt title header.',
    example: 'Tuesday, Sep 8 - Sunday, Sep 13, 2026',
  })
  @IsOptional()
  @IsString()
  dateRangeLabel?: string;

  @ApiPropertyOptional({
    description: 'Optional personal recap notes from recent shows or weekend events.',
    example: 'Great crowd at Cat\'s Cradle last Friday!',
  })
  @IsOptional()
  @IsString()
  weekendRecap?: string;

  @ApiPropertyOptional({
    description: 'Optional featured show highlight.',
    example: 'Papadosio at Lincoln Theatre',
  })
  @IsOptional()
  @IsString()
  featuredShow?: string;

  @ApiPropertyOptional({
    description: 'Optional featured festival highlight.',
    example: 'Grassroots Festival',
  })
  @IsOptional()
  @IsString()
  featuredFestival?: string;

  @ApiPropertyOptional({
    description:
      'If true, automatically converts generated markdown to HTML and pushes a draft to Beehiiv API v2.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoPushToBeehiiv?: boolean;

  @ApiPropertyOptional({
    description: 'Optional Beehiiv Post Template ID to override environment default.',
    example: 'tpl_123456',
  })
  @IsOptional()
  @IsString()
  postTemplateId?: string;
}
