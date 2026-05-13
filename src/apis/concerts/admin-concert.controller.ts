import { Body, Controller, Param, Put, UseGuards } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UserService } from '../users/user.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';
import { ConcertService } from './concert.service';
import { SetConcertApprovalDto } from './dto/set-concert-approval.dto';

@Controller('admin/concerts')
@UseGuards(FirebaseAuthGuard, AdminEmailGuard)
export class AdminConcertController {
  constructor(
    private readonly concertService: ConcertService,
    private readonly userService: UserService,
  ) {}

  @Put(':id/approval')
  async setApproval(
    @Param('id') id: string,
    @Body() body: SetConcertApprovalDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const reviewer = await this.userService.syncFromToken(user);
    return this.concertService.setAdminApproval(id, reviewer, body.approved);
  }
}
