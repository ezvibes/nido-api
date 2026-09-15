import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsISO8601,
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
    description: 'Raw calendar feed data (can be an ICS URL, raw ICS string, or text/JSON dump)',
    example: 'https://calendar.google.com/calendar/ical/.../basic.ics',
  })
  @IsOptional()
  @IsString()
  rawCalendarData?: string;

  @ApiPropertyOptional({
    description: 'Whether to fetch and merge active, admin-approved concerts from the Nido database',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  useDatabase?: boolean = true;

  @ApiPropertyOptional({
    description: 'Restrict database concert inclusion to admin Featured concerts.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  featuredOnly?: boolean = false;

  @ApiPropertyOptional({
    description: 'Restrict database concert inclusion to calculated Top Pick concerts.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  topPicksOnly?: boolean = false;

  @ApiPropertyOptional({
    description:
      'Approved Nido concert ids to exclude from this newsletter run without changing catalog data.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeConcertIds?: string[];

  @ApiPropertyOptional({
    description: 'Optional list of cities to restrict database concert inclusion to',
    example: ['Raleigh', 'Durham'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @ApiPropertyOptional({
    description: 'Optional list of genres to restrict database concert inclusion to',
    example: ['funk', 'bluegrass'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @ApiPropertyOptional({
    description: 'Optional list of venue names to restrict database concert inclusion to',
    example: ['The Pour House Music Hall'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  venues?: string[];

  @ApiPropertyOptional({
    description: 'Optional region/state filter (e.g. "NC")',
    example: 'NC',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    description: 'Whether to enforce legacy strict genre & NC city filtering. Defaults to false so all active, approved DB concerts in range are included.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  strictFiltering?: boolean = false;

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
