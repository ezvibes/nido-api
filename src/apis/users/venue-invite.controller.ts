import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';
import { CreateVenueInviteDto } from './dto/create-venue-invite.dto';
import { VenuePartnerInvite } from './entities/venue-partner-invite.entity';
import { UserService } from './user.service';

@Controller('admin/venue-invites')
@ApiTags('Admin Venue Invites')
@UseGuards(FirebaseAuthGuard, AdminEmailGuard)
@ApiBearerAuth()
export class VenueInviteController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'List all venue partner invites (Admin only)' })
  async listInvites(): Promise<VenuePartnerInvite[]> {
    return this.userService.listVenueInvites();
  }

  @Post()
  @ApiOperation({
    summary: 'Generate a new venue partner invite code (Admin only)',
  })
  async createInvite(
    @CurrentUser() user: DecodedIdToken,
    @Body() body: CreateVenueInviteDto,
  ): Promise<VenuePartnerInvite> {
    const creator = user ? await this.userService.syncFromToken(user) : null;
    return this.userService.createVenueInvite(body, creator);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a venue partner invite code (Admin only)' })
  async revokeInvite(@Param('id') id: string): Promise<VenuePartnerInvite> {
    return this.userService.revokeVenueInvite(id);
  }
}
