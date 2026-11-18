import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateOnboardingDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  inviteCode?: string | null;

  @IsOptional()
  @IsUUID()
  claimedVenueId?: string | null;

  @IsOptional()
  @IsBoolean()
  skipAsFan?: boolean;
}
