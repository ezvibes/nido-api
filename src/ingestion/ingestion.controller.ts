import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { memoryStorage } from 'multer';
import { UserService } from '../apis/users/user.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { CreateIngestionJobDto } from './dto/create-ingestion-job.dto';
import { CreateIngestionUploadDto } from './dto/create-ingestion-upload.dto';
import { IngestionService } from './ingestion.service';
import { UploadableFile } from './interfaces/uploadable-file.interface';

@Controller('ingestion')
@ApiTags('Ingestion')
export class IngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly userService: UserService,
  ) {}

  @Post('uploads')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a concert flyer/image for ingestion review' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        image: { type: 'string', format: 'binary' },
        city: { type: 'string' },
        state: { type: 'string' },
        source: { type: 'string', example: 'flyer_upload' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'image', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: 50 * 1024 * 1024,
        },
      },
    ),
  )
  async uploadImage(
    @UploadedFiles()
    files: {
      file?: UploadableFile[];
      image?: UploadableFile[];
    },
    @Body() body: CreateIngestionUploadDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const profile = await this.userService.syncFromToken(user);
    const file = files?.file?.[0] ?? files?.image?.[0];
    return this.ingestionService.uploadImage(file, body, user.uid, profile.id);
  }

  @Post('jobs')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an ingestion job for a previously uploaded asset' })
  @ApiBody({ type: CreateIngestionJobDto })
  async createJob(
    @Body() body: CreateIngestionJobDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    return this.ingestionService.createJob(
      body.concertUploadId ?? body.sourceAssetId,
      user.uid,
    );
  }

  @Get('uploads/:id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an uploaded ingestion asset' })
  @ApiParam({ name: 'id', description: 'Concert upload id' })
  async getUpload(
    @Param('id') id: string,
    @CurrentUser() user: DecodedIdToken,
  ) {
    return this.ingestionService.getConcertUpload(id, user.uid);
  }

  @Get('jobs/:id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an ingestion job' })
  @ApiParam({ name: 'id', description: 'Ingestion job id' })
  async getJob(
    @Param('id') id: string,
    @CurrentUser() user: DecodedIdToken,
  ) {
    return this.ingestionService.getJob(id, user.uid);
  }
}
