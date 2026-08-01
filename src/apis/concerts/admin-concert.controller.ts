import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UserService } from '../users/user.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';
import { ConcertService } from './concert.service';
import { SetConcertApprovalDto } from './dto/set-concert-approval.dto';
import {
  AdminConcertListResponseDto,
  AdminConcertResponseDto,
} from './dto/concert-response.dto';
import { ListAdminConcertsDto } from './dto/list-admin-concerts.dto';
import { UpdateAdminConcertDto } from './dto/update-admin-concert.dto';

@Controller('admin/concerts')
@UseGuards(FirebaseAuthGuard, AdminEmailGuard)
@ApiTags('Admin Concerts')
@ApiBearerAuth()
export class AdminConcertController {
  constructor(
    private readonly concertService: ConcertService,
    private readonly userService: UserService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List concerts for catalog administration',
    description:
      'Returns active, hidden, and archived concerts to authenticated admins. Defaults to all catalog states.',
  })
  @ApiOkResponse({ type: AdminConcertListResponseDto })
  async list(@Query() query: ListAdminConcertsDto) {
    return this.concertService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a concert for catalog administration' })
  @ApiParam({ name: 'id', description: 'Concert id' })
  @ApiOkResponse({ type: AdminConcertResponseDto })
  async get(@Param('id') id: string) {
    return this.concertService.findOneAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edit concert content and editorial catalog state',
    description:
      'Uses expectedVersion to reject stale admin edits. Editing source-managed content pauses future calendar overwrites until explicitly resumed.',
  })
  @ApiParam({ name: 'id', description: 'Concert id' })
  @ApiBody({ type: UpdateAdminConcertDto })
  @ApiOkResponse({ type: AdminConcertResponseDto })
  async update(@Param('id') id: string, @Body() body: UpdateAdminConcertDto) {
    return this.concertService.updateAdmin(id, body);
  }

  @Put(':id/approval')
  @ApiOperation({
    summary: 'Approve or unapprove a concert for Top Picks eligibility',
    description:
      'Admin-only endpoint. Approved concerts can participate in internal Top Picks scoring after sync jobs refresh rankings.',
  })
  @ApiParam({ name: 'id', description: 'Concert id', example: 'concert-uuid' })
  @ApiBody({ type: SetConcertApprovalDto })
  @ApiOkResponse({ type: AdminConcertResponseDto })
  async setApproval(
    @Param('id') id: string,
    @Body() body: SetConcertApprovalDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const reviewer = await this.userService.syncFromToken(user);
    return this.concertService.setAdminApproval(id, reviewer, body.approved);
  }
}
