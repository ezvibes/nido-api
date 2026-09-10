import {
  Injectable,
  Logger,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CreateBeehiivDraftParams {
  title: string;
  htmlContent: string;
  postTemplateId?: string;
  publicationId?: string;
  status?: 'draft' | 'confirmed' | 'scheduled';
}

export interface BeehiivDraftResponse {
  id: string;
  title: string;
  status: string;
  webUrl?: string;
  rawResponse?: any;
}

@Injectable()
export class BeehiivService {
  private readonly logger = new Logger(BeehiivService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Pushes generated HTML content to Beehiiv API v2 as a draft post utilizing a specific template & blocks structure.
   * Endpoint: POST https://api.beehiiv.com/v2/publications/{publicationId}/posts
   */
  async createDraftFromHtml(
    params: CreateBeehiivDraftParams,
  ): Promise<BeehiivDraftResponse> {
    const apiKey = this.configService.get<string>('BEEHIIV_API_KEY')?.trim();
    const defaultPubId = this.configService
      .get<string>('BEEHIIV_PUBLICATION_ID')
      ?.trim();
    const defaultTemplateId = this.configService
      .get<string>('BEEHIIV_POST_TEMPLATE_ID')
      ?.trim();

    if (!apiKey) {
      throw new InternalServerErrorException(
        'BEEHIIV_API_KEY is not configured in environment variables.',
      );
    }

    const publicationId = params.publicationId || defaultPubId;
    if (!publicationId) {
      throw new InternalServerErrorException(
        'BEEHIIV_PUBLICATION_ID is missing from environment and parameters.',
      );
    }

    const postTemplateId = params.postTemplateId || defaultTemplateId;

    if (!params.title || !params.title.trim()) {
      throw new UnprocessableEntityException('Title is required for Beehiiv draft post.');
    }

    if (!params.htmlContent || !params.htmlContent.trim()) {
      throw new UnprocessableEntityException('HTML content is required for Beehiiv draft post.');
    }

    const endpoint = `https://api.beehiiv.com/v2/publications/${publicationId}/posts`;

    const payload: Record<string, any> = {
      title: params.title.trim(),
      status: params.status || 'draft',
      blocks: [
        {
          type: 'html',
          html: params.htmlContent,
        },
      ],
    };

    if (postTemplateId) {
      payload.post_template_id = postTemplateId;
    }

    this.logger.log(
      `Pushing draft post to Beehiiv API: "${payload.title}" (Pub ID: ${publicationId}, Template ID: ${
        postTemplateId || 'None'
      })`,
    );

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok && response.status !== 201 && response.status !== 202) {
        this.logger.error(
          `Beehiiv API error (${response.status}): ${JSON.stringify(data)}`,
        );

        const errorMessage =
          data?.errors?.[0]?.message ||
          data?.message ||
          `Beehiiv API request failed with status ${response.status}`;

        if (response.status === 422) {
          throw new UnprocessableEntityException(`Beehiiv validation failed: ${errorMessage}`);
        }

        throw new InternalServerErrorException(`Beehiiv API Error: ${errorMessage}`);
      }

      const createdPost = data?.data || data;

      this.logger.log(
        `Successfully created Beehiiv draft post ID: ${createdPost?.id || 'Created'}`,
      );

      return {
        id: createdPost?.id || 'unknown',
        title: createdPost?.title || payload.title,
        status: createdPost?.status || payload.status,
        webUrl: createdPost?.web_url,
        rawResponse: data,
      };
    } catch (error) {
      if (
        error instanceof UnprocessableEntityException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to connect to Beehiiv API: ${error?.message || error}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        `Network error communicating with Beehiiv API: ${error?.message || error}`,
      );
    }
  }
}
