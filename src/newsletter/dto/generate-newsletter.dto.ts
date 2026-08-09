import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, IsBoolean } from 'class-validator';

export class GenerateNewsletterDto {
  @ApiProperty({
    description: 'Start date of the target week',
    example: '2026-08-11T00:00:00.000Z',
  })
  @IsISO8601()
  startDate: string;

  @ApiProperty({
    description: 'End date of the target week',
    example: '2026-08-16T23:59:59.999Z',
  })
  @IsISO8601()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Human-readable date range label (e.g. "Tuesday, Aug 11 - Sunday, Aug 16, 2026"). Automatically generated if omitted.',
    example: 'Tuesday, Aug 11 - Sunday, Aug 16, 2026',
  })
  @IsOptional()
  @IsString()
  dateRangeLabel?: string;

  @ApiPropertyOptional({
    description: 'Personal notes or reflections about the past weekend to include in the update section',
    example: 'We had an amazing time at the Pour House last Friday...',
  })
  @IsOptional()
  @IsString()
  weekendRecap?: string;

  @ApiPropertyOptional({
    description: 'Details/notes for the featured show of the week',
    example: 'Dr. Bacon is playing at the Pour House on Friday night. Expect high energy funk-rock...',
  })
  @IsOptional()
  @IsString()
  featuredShow?: string;

  @ApiPropertyOptional({
    description: 'Details/notes for the featured festival of the week',
    example: 'Shakori Hills GrassRoots Festival is happening this weekend...',
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
}
