import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';

@Controller('venues')
@ApiTags('Venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Get()
  @ApiOperation({ summary: 'List all venues, optionally filtered by city slug' })
  @ApiQuery({ name: 'citySlug', required: false, type: String })
  @ApiOkResponse({ description: 'List of venues', type: [Venue] })
  async findAll(@Query('citySlug') citySlug?: string): Promise<Venue[]> {
    if (citySlug) {
      return this.venueService.findByCity(citySlug);
    }
    return this.venueService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a venue by ID' })
  @ApiOkResponse({ description: 'Venue details', type: Venue })
  async findOne(@Param('id') id: string): Promise<Venue> {
    return this.venueService.findOne(id);
  }
}
