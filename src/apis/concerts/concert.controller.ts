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

@Controller('concerts')
@UseGuards(FirebaseAuthGuard)
export class ConcertController {
  constructor(
    private readonly concertService: ConcertService,
    private readonly userService: UserService,
  ) {}

  private async ensureOwner(decodedToken: DecodedIdToken) {
    return this.userService.syncFromToken(decodedToken);
  }

  @Get()
  async listConcerts(
    @CurrentUser() user: DecodedIdToken,
    @Query() query: ListConcertsDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertService.findAllForOwner(owner, query);
  }

  @Post()
  async createConcert(
    @CurrentUser() user: DecodedIdToken,
    @Body() body: CreateConcertDto,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertService.createForOwner(owner, body);
  }

  @Get(':id')
  async getConcert(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ) {
    const owner = await this.ensureOwner(user);
    return this.concertService.findOneForOwner(id, owner);
  }

  @Patch(':id')
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
  async deleteConcert(
    @CurrentUser() user: DecodedIdToken,
    @Param('id') id: string,
  ) {
    const owner = await this.ensureOwner(user);
    await this.concertService.removeForOwner(id, owner);
  }
}
