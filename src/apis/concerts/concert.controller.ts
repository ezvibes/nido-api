import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ConcertService } from './concert.service';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { ListConcertsDto } from './dto/list-concerts.dto';
import { UserService } from '../users/user.service';
import {
  ConcertEngagementResponseDto,
  ConcertListResponseDto,
  ConcertResponseDto,
} from './dto/concert-response.dto';

@Controller('concerts')
@UseGuards(FirebaseAuthGuard)
@ApiTags('Concerts')
@ApiBearerAuth()
export class ConcertController {
  constructor(
    private readonly concertService: ConcertService,
    private readonly userService: UserService,
  ) {}

  private async ensureOwner(decodedToken: DecodedIdToken) {
    return this.userService.syncFromToken(decodedToken);
  }

  @Get()
  @ApiOperation({
    summary: 'List concerts for the shared discovery feed',
    description:
      'Returns paginated upcoming concert records for the shared /events discovery feed. Results include concerts created manually, published from approved uploads, or produced by calendar sync across all users. Engagement state such as upvotedByMe is scoped to the signed-in user. Example: GET /concerts?sort=soonest&startsAfter=2026-07-03T19:04:08.267Z&pageSize=100.',
  })
  @ApiQuery({ name: 'q', required: false, example: 'doctor s' })
  @ApiQuery({ name: 'genre', required: false, example: 'Electronic' })
  @ApiQuery({
    name: 'startsAfter',
    required: false,
    example: '2026-06-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'startsBefore',
    required: false,
    example: '2026-07-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['soonest', 'featured', 'top_picks', 'trending_week'],
    example: 'soonest',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiOkResponse({ type: ConcertListResponseDto })
  async listConcerts(
    @CurrentUser() user: DecodedIdToken,
    @Query() query: ListConcertsDto,
  ) {
    const currentUser = await this.ensureOwner(user);
    return this.concertService.findAll(query, currentUser);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'List concerts owned by the current user',
    description:
      'Returns paginated concert records created by, uploaded by, or synced for the signed-in user. This preserves the private My Concerts contract while GET /concerts serves the shared discovery feed. Example: GET /concerts/mine?sort=soonest&pageSize=20.',
  })
  @ApiQuery({ name: 'q', required: false, example: 'doctor s' })
  @ApiQuery({ name: 'genre', required: false, example: 'Electronic' })
  @ApiQuery({
    name: 'startsAfter',
    required: false,
    example: '2026-06-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'startsBefore',
    required: false,
    example: '2026-07-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['soonest', 'featured', 'top_picks', 'trending_week'],
    example: 'soonest',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiOkResponse({ type: ConcertListResponseDto })
  async listMyConcerts(
    @CurrentUser() user: DecodedIdToken,
    @Query() query: ListConcertsDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertService.findAllForOwner(owner, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a concert manually',
    description:
      'Creates a normalized concert record owned by the current user. Calendar sync jobs use the same concert shape internally.',
  })
  @ApiBody({ type: CreateConcertDto })
  @ApiCreatedResponse({ type: ConcertResponseDto })
  async createConcert(
    @CurrentUser() user: DecodedIdToken,
    @Body() body: CreateConcertDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertService.createForOwner(owner, body);
  }

  @Post(':id/upvote')
  @ApiOperation({ summary: 'Upvote a concert for the current user' })
  @ApiParam({ name: 'id', description: 'Concert id', example: 'concert-uuid' })
  @ApiCreatedResponse({ type: ConcertEngagementResponseDto })
  async upvoteConcert(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertService.upvote(id, owner);
  }

  @Delete(':id/upvote')
  @ApiOperation({ summary: 'Remove the current user upvote from a concert' })
  @ApiParam({ name: 'id', description: 'Concert id', example: 'concert-uuid' })
  @ApiOkResponse({ type: ConcertEngagementResponseDto })
  async removeConcertUpvote(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertService.removeUpvote(id, owner);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one concert by id' })
  @ApiParam({ name: 'id', description: 'Concert id', example: 'concert-uuid' })
  @ApiOkResponse({ type: ConcertResponseDto })
  async getConcert(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertService.findOneForOwner(id, owner);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update one concert by id' })
  @ApiParam({ name: 'id', description: 'Concert id', example: 'concert-uuid' })
  @ApiBody({ type: UpdateConcertDto })
  @ApiOkResponse({ type: ConcertResponseDto })
  async updateConcert(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
    @Body() body: UpdateConcertDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertService.updateForOwner(id, owner, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete one concert by id' })
  @ApiParam({ name: 'id', description: 'Concert id', example: 'concert-uuid' })
  @ApiNoContentResponse({ description: 'Concert deleted.' })
  async deleteConcert(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ) {
    const owner = await this.ensureOwner(user);
    await this.concertService.removeForOwner(id, owner);
  }
}
