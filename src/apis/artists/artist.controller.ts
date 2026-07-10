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
import { ArtistService } from './artist.service';
import { Artist } from './entities/artist.entity';
import { ListArtistsDto } from './dto/list-artists.dto';
import { ArtistResponseDto } from './dto/artist-response.dto';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';

@Controller('artists')
@ApiTags('Artists')
export class ArtistController {
  constructor(private readonly artistService: ArtistService) {}

  @Get()
  @ApiOperation({ summary: 'List all artists, optionally filtered by search or genre tag' })
  @ApiOkResponse({ description: 'List of artists', type: [ArtistResponseDto] })
  async findAll(@Query() query: ListArtistsDto): Promise<Artist[]> {
    return this.artistService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an artist by ID' })
  @ApiOkResponse({ description: 'Artist details', type: ArtistResponseDto })
  async findOne(@Param('id') id: string): Promise<Artist> {
    return this.artistService.findOne(id);
  }

  @Get(':slug/slug')
  @ApiOperation({ summary: 'Get an artist by URL-friendly slug' })
  @ApiOkResponse({ description: 'Artist details', type: ArtistResponseDto })
  async findBySlug(@Param('slug') slug: string): Promise<Artist> {
    return this.artistService.findBySlug(slug);
  }

  @Post()
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new artist profile (Admin only)' })
  @ApiCreatedResponse({ description: 'The artist profile has been successfully created.', type: ArtistResponseDto })
  async create(@Body() createArtistDto: CreateArtistDto): Promise<Artist> {
    return this.artistService.create(createArtistDto);
  }

  @Put(':id')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an artist profile by ID (Admin only)' })
  @ApiOkResponse({ description: 'The artist profile has been successfully updated.', type: ArtistResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateArtistDto: UpdateArtistDto,
  ): Promise<Artist> {
    return this.artistService.update(id, updateArtistDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an artist profile by ID (Admin only)' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.artistService.remove(id);
  }
}
