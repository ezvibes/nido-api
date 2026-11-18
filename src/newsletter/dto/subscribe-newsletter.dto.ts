import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubscribeNewsletterDto {
  @ApiProperty({
    description: 'Subscriber email address.',
    example: 'fan@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({
    description: 'UTM source attribution.',
    example: 'nido_web',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmSource?: string;

  @ApiPropertyOptional({
    description: 'UTM medium attribution.',
    example: 'organic',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmMedium?: string;

  @ApiPropertyOptional({
    description: 'UTM campaign attribution.',
    example: 'weekly_top_picks',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmCampaign?: string;
}
