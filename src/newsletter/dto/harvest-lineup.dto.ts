import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum HarvestSourceType {
  SUPPORT_ACT = 'support_act',
  FESTIVAL_LINEUP = 'festival_lineup',
}

export class HarvestLineupDto {
  @ApiProperty({
    enum: HarvestSourceType,
    description: 'Source type: support acts from concert titles or multi-band festival rosters',
    example: HarvestSourceType.SUPPORT_ACT,
  })
  @IsEnum(HarvestSourceType)
  sourceType: HarvestSourceType;

  @ApiProperty({
    description: 'Raw text to parse (e.g. "Big Something w/ The Fritz" or multiline festival roster)',
    example: 'Big Something w/ The Fritz, Marvelous Funkshun',
  })
  @IsString()
  rawText: string;

  @ApiProperty({
    description: 'Optional festival name or headliner title context',
    example: 'Shakori Hills Grassroots Festival',
    required: false,
  })
  @IsOptional()
  @IsString()
  sourceTitle?: string;

  @ApiProperty({
    description: 'Whether to auto-register newly discovered bands into the catalog database',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  autoCreateInDb?: boolean;
}
