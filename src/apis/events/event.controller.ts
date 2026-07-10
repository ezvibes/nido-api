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
import { EventService } from './event.service';
import { Event } from './entities/event.entity';
import { ListEventsDto } from './dto/list-events.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FirebaseAuthGuard } from '../../auth/firebase-auth/firebase-auth.guard';
import { AdminEmailGuard } from '../../auth/guards/admin-email.guard';

@Controller('events')
@ApiTags('Events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  @ApiOperation({ summary: 'List all events, optionally filtered by search query, venue, or date range' })
  @ApiOkResponse({ description: 'List of events', type: [EventResponseDto] })
  async findAll(@Query() query: ListEventsDto): Promise<Event[]> {
    return this.eventService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an event by ID' })
  @ApiOkResponse({ description: 'Event details', type: EventResponseDto })
  async findOne(@Param('id') id: string): Promise<Event> {
    return this.eventService.findOne(id);
  }

  @Post()
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new event (Admin only)' })
  @ApiCreatedResponse({ description: 'The event has been successfully created.', type: EventResponseDto })
  async create(@Body() createEventDto: CreateEventDto): Promise<Event> {
    return this.eventService.create(createEventDto);
  }

  @Put(':id')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an event by ID (Admin only)' })
  @ApiOkResponse({ description: 'The event has been successfully updated.', type: EventResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ): Promise<Event> {
    return this.eventService.update(id, updateEventDto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard, AdminEmailGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an event by ID (Admin only)' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.eventService.remove(id);
  }
}
