import {
  IsEmail,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateVenueInviteDto {
  @IsUUID()
  venueId: string;

  @IsOptional()
  @IsEmail()
  invitedEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
