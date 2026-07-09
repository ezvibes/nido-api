import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { UserService } from '../apis/users/user.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../auth/firebase-auth/firebase-auth.guard';
import { CreateIngestionJobDto } from './dto/create-ingestion-job.dto';
import { CreateIngestionUploadDto } from './dto/create-ingestion-upload.dto';
import { IngestionUploadResponseDto } from './dto/ingestion-response.dto';
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
  @ApiOperation({
    summary: 'Upload a concert flyer/image for ingestion review',
    description:
      'Stores one uploaded image for later admin review. This minimal endpoint does not parse the flyer into a concert yet.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        image: { type: 'string', format: 'binary' },
        city: { type: 'string', example: 'Charlotte' },
        state: { type: 'string', example: 'NC' },
        source: {
          type: 'string',
          enum: ['flyer_upload', 'manual_upload', 'partner_upload'],
          example: 'flyer_upload',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: IngestionUploadResponseDto })
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
  @ApiOperation({
    summary: 'Create an ingestion job for an uploaded concert asset',
    description:
      'Starts the current Phase 1 ingestion job skeleton for an upload owned by the signed-in user.',
  })
  @ApiCreatedResponse({
    description: 'The queued ingestion job and associated upload metadata.',
  })
  async createJob(
    @Body() body: CreateIngestionJobDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    return this.ingestionService.createJob(
      body.concertUploadId ?? body.sourceAssetId,
      user.uid,
    );
  }

  @Get('jobs/:id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get an ingestion job by id',
    description:
      'Returns a job only when it belongs to an upload owned by the signed-in user.',
  })
  @ApiParam({ name: 'id', description: 'Ingestion job id' })
  @ApiOkResponse({
    description: 'The ingestion job and associated upload metadata.',
  })
  async getJob(@Param('id') id: string, @CurrentUser() user: DecodedIdToken) {
    return this.ingestionService.getJob(id, user.uid);
  }

  @Get('uploads/:id/image')
  @ApiOperation({
    summary: 'Stream an uploaded concert flyer image publicly',
    description: 'Streams the original uploaded flyer image from GCS for public feed display.',
  })
  @ApiParam({ name: 'id', description: 'Concert upload id', example: '87c28620-0a38-4187-89c8-c83a0246e828' })
  async streamUploadImage(@Param('id') id: string, @Res() res: Response) {
    return this.ingestionService.adminStreamUploadImage(id, res);
  }
}
