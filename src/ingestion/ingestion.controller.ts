import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { CreateIngestionJobDto } from './dto/create-ingestion-job.dto';
import { CreateIngestionUploadDto } from './dto/create-ingestion-upload.dto';
import { IngestionService } from './ingestion.service';

@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('uploads')
  @UseGuards(FirebaseAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateIngestionUploadDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    return this.ingestionService.uploadImage(file, body, user.uid);
  }

  @Post('jobs')
  @UseGuards(FirebaseAuthGuard)
  async createJob(
    @Body() body: CreateIngestionJobDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    return this.ingestionService.createJob(body, user.uid);
  }

  @Get('jobs/:id')
  @UseGuards(FirebaseAuthGuard)
  async getJob(
    @Param('id') id: string,
    @CurrentUser() user: DecodedIdToken,
  ) {
    return this.ingestionService.getJob(id, user.uid);
  }

  @Get('candidates/:id')
  @UseGuards(FirebaseAuthGuard)
  async getCandidate(
    @Param('id') id: string,
    @CurrentUser() user: DecodedIdToken,
  ) {
    return this.ingestionService.getCandidate(id, user.uid);
  }
}
