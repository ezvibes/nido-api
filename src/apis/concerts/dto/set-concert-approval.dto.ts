import { IsBoolean } from 'class-validator';

export class SetConcertApprovalDto {
  @IsBoolean()
  approved: boolean;
}
