import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageAnnotatorClient, protos } from '@google-cloud/vision';

export interface OcrResult {
  provider: string;
  text: string;
  confidence?: number;
}

@Injectable()
export class VisionOcrService {
  private readonly client: ImageAnnotatorClient;

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

    this.client =
      projectId && clientEmail && privateKey
        ? new ImageAnnotatorClient({
            projectId,
            credentials: {
              client_email: clientEmail,
              private_key: privateKey,
            },
          })
        : new ImageAnnotatorClient();
  }

  async extractText(bucket: string, objectName: string): Promise<OcrResult> {
    const [response] = await this.client.documentTextDetection({
      image: {
        source: {
          imageUri: `gs://${bucket}/${objectName}`,
        },
      },
    });

    const text =
      response.fullTextAnnotation?.text?.trim() ||
      response.textAnnotations?.[0]?.description?.trim() ||
      '';

    if (!text) {
      throw new Error('Vision OCR returned no text.');
    }

    return {
      provider: 'google-vision',
      text,
      confidence: this.calculateConfidence(response.fullTextAnnotation),
    };
  }

  private calculateConfidence(
    annotation?: protos.google.cloud.vision.v1.ITextAnnotation | null,
  ): number | undefined {
    const pageConfidences = annotation?.pages
      ?.map((page) => page.confidence)
      .filter((value): value is number => typeof value === 'number');

    if (!pageConfidences?.length) {
      return undefined;
    }

    const average =
      pageConfidences.reduce((sum, value) => sum + value, 0) /
      pageConfidences.length;

    return Number(average.toFixed(4));
  }
}
