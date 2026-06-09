import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetConcertApprovalDto {
  @ApiProperty({
    description:
      'Whether this concert is admin-approved for Top Picks eligibility.',
    example: true,
  })
  @IsBoolean()
  approved: boolean;
}
