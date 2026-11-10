import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsBoolean, IsUUID } from 'class-validator';

export class BulkConcertApprovalDto {
  @ApiProperty({
    description: 'Array of concert IDs to approve or unapprove.',
    type: [String],
    example: [
      '87c28620-0a38-4187-89c8-c83a0246e828',
      '99c28620-0a38-4187-89c8-c83a0246e829',
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  concertIds: string[];

  @ApiProperty({
    description: 'Target approval state: true to approve, false to revoke.',
    example: true,
  })
  @IsBoolean()
  approved: boolean;
}
