import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  ParseUUIDPipe,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  extractClientIp,
  SlidingWindowIpRateLimiter,
} from '../../common/rate-limit/ip-rate-limiter';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';
import { ListVenuesDto } from './dto/list-venues.dto';
import { VenueResponseDto } from './dto/venue-response.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';

@Controller('venues')
@ApiTags('Venues')
export class VenueController {
  private readonly publicReadRateLimiter = new SlidingWindowIpRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 120,
    message: 'Too many venue discovery requests. Please try again later.',
  });

  constructor(private readonly venueService: VenueService) {}

  resetPublicRateLimits(): void {
    this.publicReadRateLimiter.reset();
  }

  @Get()
  @ApiOperation({
    summary: 'List all venues, optionally filtered by city or region slug',
  })
  @ApiOkResponse({ description: 'List of venues', type: [VenueResponseDto] })
  async findAll(
    @Query() query: ListVenuesDto,
    @Req() req?: Request,
  ): Promise<Venue[]> {
    this.publicReadRateLimiter.enforce(extractClientIp(req));
    if (query.citySlug && !query.regionSlug && !query.verificationState) {
      return this.venueService.findByCity(query.citySlug);
    }
    return this.venueService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a venue by ID' })
  @ApiOkResponse({ description: 'Venue details', type: VenueResponseDto })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: Request,
  ): Promise<Venue> {
    this.publicReadRateLimiter.enforce(extractClientIp(req));
    return this.venueService.findOne(id);
  }

  @Post()
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new venue (Admin only)' })
  @ApiCreatedResponse({
    description: 'The venue has been successfully created.',
    type: VenueResponseDto,
  })
  async create(@Body() createVenueDto: CreateVenueDto): Promise<Venue> {
    return this.venueService.create(createVenueDto);
  }

  @Put(':id')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a venue by ID (Admin only)' })
  @ApiOkResponse({
    description: 'The venue has been successfully updated.',
    type: VenueResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateVenueDto: UpdateVenueDto,
  ): Promise<Venue> {
    return this.venueService.update(id, updateVenueDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a venue by ID (Admin only)' })
  @ApiOkResponse({ description: 'The venue has been successfully deleted.' })
  async delete(@Param('id') id: string): Promise<void> {
    return this.venueService.delete(id);
  }
}
