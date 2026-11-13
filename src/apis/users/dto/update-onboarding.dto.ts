import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdateOnboardingDto {
  @IsOptional()
  @IsUUID()
  claimedVenueId?: string | null;

  @IsOptional()
  @IsBoolean()
  skipAsFan?: boolean;
}
