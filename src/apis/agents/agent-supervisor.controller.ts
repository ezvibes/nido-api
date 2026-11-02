import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Observable } from 'rxjs';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserService } from '../users/user.service';
import { AgentSupervisorService } from './agent-supervisor.service';
import {
  ListAgentRunsQueryDto,
  ResolveAgentActionItemDto,
  SteerAgentDto,
} from './dto/agent-supervisor.dto';

@Controller(['api/agents', 'admin/agents'])
@UseGuards(FirebaseAuthGuard, AdminEmailGuard)
@ApiTags('Admin Agent Supervisor')
@ApiBearerAuth()
export class AgentSupervisorController {
  constructor(
    private readonly supervisorService: AgentSupervisorService,
    private readonly userService: UserService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary:
      'Get full multi-agent fleet roster, active runs, KPIs, and pending HITL action items',
  })
  @ApiQuery({
    name: 'fixture',
    required: false,
    description: 'Set to true in non-production to inspect sanitized demo fixtures',
  })
  async getStatus(@Query('fixture') fixture?: string) {
    return this.supervisorService.getSupervisorStatus({ fixture });
  }

  @Get('runs')
  @ApiOperation({
    summary: 'List recent agent workflow executions with pagination and filters',
  })
  async listRuns(@Query() query: ListAgentRunsQueryDto) {
    return this.supervisorService.listRuns(query);
  }

  @Get('runs/:id')
  @ApiOperation({
    summary:
      'Get a single agent run with ordered tool trace events and approval state',
  })
  @ApiParam({ name: 'id', description: 'Agent run or session ID' })
  @ApiQuery({ name: 'fixture', required: false })
  async getRun(
    @Param('id') id: string,
    @Query('fixture') fixture?: string,
  ) {
    return this.supervisorService.getRunById(id, { fixture });
  }

  @Get('action-items')
  @ApiOperation({
    summary:
      'List pending Human-in-the-Loop (HITL) action items across Venezia and Firenze',
  })
  @ApiQuery({ name: 'fixture', required: false })
  async getActionItems(@Query('fixture') fixture?: string) {
    return this.supervisorService.getActionItems({ fixture });
  }

  @Post('action-items/:id/resolve')
  @ApiOperation({
    summary:
      'Resolve a pending HITL action item (approve/stage newsletter draft, publish/link/merge/reject poster candidate)',
  })
  @ApiParam({ name: 'id', description: 'Action item ID' })
  async resolveActionItem(
    @Param('id') id: string,
    @Body() dto: ResolveAgentActionItemDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const profile = await this.userService.syncFromToken(user);
    return this.supervisorService.resolveActionItem(id, dto, profile.id);
  }

  @Post(':agentKey/steer')
  @ApiOperation({
    summary:
      'Send a bounded steering instruction or operator note to an agent',
  })
  @ApiParam({
    name: 'agentKey',
    description: 'Canonical agent key (e.g. firenze, venezia, frankfurt)',
  })
  async steerAgent(
    @Param('agentKey') agentKey: string,
    @Body() dto: SteerAgentDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    return this.supervisorService.steerAgent(
      agentKey,
      dto,
      user?.uid || 'admin',
    );
  }

  @Sse('stream')
  @ApiOperation({
    summary:
      'Server-Sent Events (SSE) stream for live agent state transitions and tool call traces',
  })
  streamEvents(): Observable<MessageEvent> {
    return this.supervisorService.getStream();
  }
}
