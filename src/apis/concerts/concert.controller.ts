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
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  extractClientIp,
  SlidingWindowIpRateLimiter,
} from '../../common/rate-limit/ip-rate-limiter';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { OptionalFirebaseAuthGuard } from '../../auth/firebase-auth/optional-firebase-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ConcertService } from './concert.service';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import {
  concertSortOptions,
  ListConcertsDto,
} from './dto/list-concerts.dto';
import { UserService } from '../users/user.service';
import {
  ConcertEngagementResponseDto,
  ConcertListResponseDto,
  ConcertResponseDto,
} from './dto/concert-response.dto';
import { ConcertGenresResponseDto } from './dto/concert-genres-response.dto';

const PUBLIC_READ_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const PUBLIC_READ_RATE_LIMIT_MAX_REQUESTS = 120;

@Controller('concerts')
@ApiTags('Concerts')
export class ConcertController {
  private readonly publicReadRateLimiter = new SlidingWindowIpRateLimiter({
    windowMs: PUBLIC_READ_RATE_LIMIT_WINDOW_MS,
    maxAttempts: PUBLIC_READ_RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many discovery requests. Please try again later.',
  });

  constructor(
    private readonly concertService: ConcertService,
    private readonly userService: UserService,
  ) {}

  resetPublicRateLimits(): void {
    this.publicReadRateLimiter.reset();
  }

  private async ensureOwner(decodedToken: DecodedIdToken) {
    return this.userService.syncFromToken(decodedToken);
  }

  @Get()
  @UseGuards(OptionalFirebaseAuthGuard)
  @ApiOperation({
    summary: 'List concerts for the shared discovery feed',
    description:
      'Returns paginated active, admin-approved concert records for the shared /concerts discovery feed. Authentication is optional; signed-in listeners also receive their upvotedByMe state. Unapproved uploads and calendar syncs remain available to their owners and admins, but are not public. Example: GET /concerts?sort=soonest&startsAfter=2026-07-03T19:04:08.267Z&pageSize=100.',
  })
  @ApiQuery({ name: 'q', required: false, example: 'doctor s' })
  @ApiQuery({ name: 'genre', required: false, example: 'Electronic' })
  @ApiQuery({ name: 'city', required: false, example: 'raleigh' })
  @ApiQuery({ name: 'region', required: false, example: 'nc' })
  @ApiQuery({
    name: 'venueId',
    required: false,
    example: '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e',
  })
  @ApiQuery({
    name: 'bandId',
    required: false,
    example: 'a91f4d62-4e82-47d2-b78c-1f542d4f0a21',
  })
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
    enum: concertSortOptions,
    example: 'soonest',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 20 })
  @ApiOkResponse({ type: ConcertListResponseDto })
  async listConcerts(
    @CurrentUser() user: DecodedIdToken | undefined,
    @Query() query: ListConcertsDto,
    @Req() req?: Request,
  ) {
    this.publicReadRateLimiter.enforce(extractClientIp(req));
    const currentUser = user
      ? await this.userService.findExistingFromToken(user)
      : null;
    return this.concertService.findAll(query, currentUser ?? undefined);
  }

  @Get('mine')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List concerts owned by the current user',
    description:
      'Returns paginated concert records created by, uploaded by, or synced for the signed-in user. This preserves the private My Concerts contract while GET /concerts serves the shared discovery feed. Example: GET /concerts/mine?sort=soonest&pageSize=20.',
  })
  @ApiQuery({ name: 'q', required: false, example: 'doctor s' })
  @ApiQuery({ name: 'genre', required: false, example: 'Electronic' })
  @ApiQuery({ name: 'city', required: false, example: 'raleigh' })
  @ApiQuery({ name: 'region', required: false, example: 'nc' })
  @ApiQuery({
    name: 'venueId',
    required: false,
    example: '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e',
  })
  @ApiQuery({
    name: 'bandId',
    required: false,
    example: 'a91f4d62-4e82-47d2-b78c-1f542d4f0a21',
  })
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
    enum: concertSortOptions,
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
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
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

  @Get('meta/genres')
  @ApiOperation({
    summary: 'List controlled concert genre options',
    description:
      'Returns active controlled genre options for upload, admin, discovery, newsletter, and future OCR selectors. The legacy genres array is preserved for existing clients; options includes stable slugs for new clients. Public endpoint; does not require authentication and does not synchronize or look up a user. Example: GET /concerts/meta/genres.',
  })
  @ApiOkResponse({ type: ConcertGenresResponseDto })
  async getAvailableGenres(@Req() req?: Request) {
    this.publicReadRateLimiter.enforce(extractClientIp(req));
    const options = await this.concertService.findAvailableGenres();
    return {
      genres: options.map((genre) => genre.name),
      options,
    };
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({
    summary: 'Public XML sitemap of active, admin-approved concerts',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  async getPublicSitemap(
    @Query('page') page?: string,
    @Req() req?: Request,
  ): Promise<string> {
    this.publicReadRateLimiter.enforce(extractClientIp(req));
    const parsedPage = page ? Number.parseInt(page, 10) : 1;
    return this.concertService.generatePublicSitemapXml(undefined, {
      page: Number.isNaN(parsedPage) ? 1 : parsedPage,
    });
  }

  @Get('sitemap-index.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({
    summary:
      'Public XML sitemap index partitioning active, admin-approved concerts across 1,000-URL pages',
  })
  async getPublicSitemapIndex(@Req() req?: Request): Promise<string> {
    this.publicReadRateLimiter.enforce(extractClientIp(req));
    return this.concertService.generatePublicSitemapIndexXml();
  }

  @Get(':id')
  @UseGuards(OptionalFirebaseAuthGuard)
  @ApiOperation({
    summary: 'Get one concert by id for public discovery or its owner',
  })
  @ApiParam({ name: 'id', description: 'Concert id', example: 'concert-uuid' })
  @ApiOkResponse({ type: ConcertResponseDto })
  async getConcert(
    @CurrentUser() user: DecodedIdToken | undefined,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: Request,
  ) {
    this.publicReadRateLimiter.enforce(extractClientIp(req));
    const currentUser = user
      ? await this.userService.findExistingFromToken(user)
      : null;
    return this.concertService.findOneForViewer(id, currentUser ?? undefined);
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
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
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
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

@Controller()
@ApiTags('Concerts')
export class SitemapController {
  private readonly publicReadRateLimiter = new SlidingWindowIpRateLimiter({
    windowMs: PUBLIC_READ_RATE_LIMIT_WINDOW_MS,
    maxAttempts: PUBLIC_READ_RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many sitemap requests. Please try again later.',
  });

  constructor(private readonly concertService: ConcertService) {}

  resetPublicRateLimits(): void {
    this.publicReadRateLimiter.reset();
  }

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({
    summary: 'Root XML sitemap of active, admin-approved concerts',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  async getRootSitemap(
    @Query('page') page?: string,
    @Req() req?: Request,
  ): Promise<string> {
    this.publicReadRateLimiter.enforce(extractClientIp(req));
    const parsedPage = page ? Number.parseInt(page, 10) : 1;
    return this.concertService.generatePublicSitemapXml(undefined, {
      page: Number.isNaN(parsedPage) ? 1 : parsedPage,
    });
  }

  @Get('sitemap-index.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({
    summary:
      'Root XML sitemap index partitioning active, admin-approved concerts across 1,000-URL pages',
  })
  async getRootSitemapIndex(@Req() req?: Request): Promise<string> {
    this.publicReadRateLimiter.enforce(extractClientIp(req));
    return this.concertService.generatePublicSitemapIndexXml();
  }
}
