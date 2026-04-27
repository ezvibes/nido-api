import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';

@Injectable()
export class IngestionStorageService {
  private readonly storage: Storage;

  constructor(private readonly configService: ConfigService) {
    const projectId =
      this.configService.get<string>('GCP_PROJECT_ID') ??
      this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail =
      this.configService.get<string>('GCP_CLIENT_EMAIL') ??
      this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = (
      this.configService.get<string>('GCP_PRIVATE_KEY') ??
      this.configService.get<string>('FIREBASE_PRIVATE_KEY')
    )?.replace(/\\n/g, '\n');

    this.storage =
      projectId && clientEmail && privateKey
        ? new Storage({
            projectId,
            credentials: {
              client_email: clientEmail,
              private_key: privateKey,
            },
          })
        : new Storage();
  }

  getConfiguredBucketName(): string {
    const bucketName = this.configService.get<string>('GCS_INGESTION_BUCKET');

    if (!bucketName) {
      throw new InternalServerErrorException(
        'GCS_INGESTION_BUCKET is not configured.',
      );
    }

    return bucketName;
  }

  async uploadObject(
    bucketName: string,
    objectName: string,
    buffer: Buffer,
    metadata: Record<string, string>,
    contentType: string,
  ): Promise<void> {
    await this.storage.bucket(bucketName).file(objectName).save(buffer, {
      resumable: false,
      contentType,
      metadata: {
        metadata,
      },
    });
  }

  async objectExists(bucketName: string, objectName: string): Promise<boolean> {
    const [exists] = await this.storage
      .bucket(bucketName)
      .file(objectName)
      .exists();

    return exists;
  }
}
