import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetConcertApprovalDto {
  @ApiProperty({
    description:
      'Whether this concert is approved for public discovery when active and eligible for Top Picks scoring.',
    example: true,
  })
  @IsBoolean()
  approved: boolean;
}
