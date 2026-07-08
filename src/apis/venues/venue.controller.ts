import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VenueService } from './venue.service';
import { Venue } from './entities/venue.entity';
import { ListVenuesDto } from './dto/list-venues.dto';
import { VenueResponseDto } from './dto/venue-response.dto';

@Controller('venues')
@ApiTags('Venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Get()
  @ApiOperation({ summary: 'List all venues, optionally filtered by city or region slug' })
  @ApiOkResponse({ description: 'List of venues', type: [VenueResponseDto] })
  async findAll(@Query() query: ListVenuesDto): Promise<Venue[]> {
    if (query.citySlug) {
      return this.venueService.findByCity(query.citySlug);
    }
    // Note: Future extension can implement regionSlug filtering in VenueService
    return this.venueService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a venue by ID' })
  @ApiOkResponse({ description: 'Venue details', type: VenueResponseDto })
  async findOne(@Param('id') id: string): Promise<Venue> {
    return this.venueService.findOne(id);
  }
}
