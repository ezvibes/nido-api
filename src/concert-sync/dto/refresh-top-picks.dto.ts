import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class RefreshTopPicksDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  horizonDays?: number = 90;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  limit?: number = 100;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  onlyUpcoming?: boolean = true;
}
