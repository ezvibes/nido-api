import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BandService } from './band.service';
import { Band } from './entities/band.entity';
import { ListBandsDto } from './dto/list-bands.dto';
import { BandResponseDto } from './dto/band-response.dto';
import { CreateBandDto } from './dto/create-band.dto';
import { UpdateBandDto } from './dto/update-band.dto';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';

@Controller('bands')
@ApiTags('Bands')
export class BandController {
  constructor(private readonly bandService: BandService) {}

  @Get()
  @ApiOperation({ summary: 'List all bands, optionally filtered by search query or genre tag' })
  @ApiOkResponse({ description: 'List of bands', type: [BandResponseDto] })
  async findAll(@Query() query: ListBandsDto): Promise<Band[]> {
    return this.bandService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a band by ID' })
  @ApiOkResponse({ description: 'Band details', type: BandResponseDto })
  async findOne(@Param('id') id: string): Promise<Band> {
    return this.bandService.findOne(id);
  }

  @Get(':slug/slug')
  @ApiOperation({ summary: 'Get a band by URL-friendly slug' })
  @ApiOkResponse({ description: 'Band details', type: BandResponseDto })
  async findBySlug(@Param('slug') slug: string): Promise<Band> {
    return this.bandService.findBySlug(slug);
  }

  @Post()
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new band profile (Admin only)' })
  @ApiCreatedResponse({ description: 'The band profile has been successfully created.', type: BandResponseDto })
  async create(@Body() createBandDto: CreateBandDto): Promise<Band> {
    return this.bandService.create(createBandDto);
  }

  @Put(':id')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a band profile by ID (Admin only)' })
  @ApiOkResponse({ description: 'The band profile has been successfully updated.', type: BandResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateBandDto: UpdateBandDto,
  ): Promise<Band> {
    return this.bandService.update(id, updateBandDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a band profile by ID (Admin only)' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.bandService.remove(id);
  }
}
