import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BeehiivDraftParams {
  title: string;
  htmlContent: string;
  postTemplateId?: string;
  publicationId?: string;
}

export interface BeehiivDraftResponse {
  id: string;
  title: string;
  subtitle?: string;
  status: string;
  web_url?: string;
  created_at?: number;
}

@Injectable()
export class BeehiivService {
  private readonly logger = new Logger(BeehiivService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Pushes generated HTML newsletter content to Beehiiv API v2 as a template-based draft.
   */
  async createDraftFromHtml(params: BeehiivDraftParams): Promise<BeehiivDraftResponse> {
    const apiKey = this.configService.get<string>('BEEHIIV_API_KEY')?.trim();
    if (!apiKey) {
      throw new InternalServerErrorException(
        'BEEHIIV_API_KEY is not configured in the application environment.',
      );
    }

    const publicationId =
      params.publicationId ||
      this.configService.get<string>('BEEHIIV_PUBLICATION_ID')?.trim();
    if (!publicationId) {
      throw new InternalServerErrorException(
        'BEEHIIV_PUBLICATION_ID is not configured in environment or params.',
      );
    }

    const postTemplateId =
      params.postTemplateId ||
      this.configService.get<string>('BEEHIIV_POST_TEMPLATE_ID')?.trim();

    const endpoint = `https://api.beehiiv.com/v2/publications/${publicationId}/posts`;

    const payload: Record<string, any> = {
      title: params.title,
      status: 'draft',
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
      `Pushing newsletter draft "${params.title}" to Beehiiv publication ${publicationId}...`,
    );

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Beehiiv API returned error status ${response.status}: ${errorText}`,
        );
        throw new InternalServerErrorException(
          `Beehiiv API error (${response.status}): ${errorText}`,
        );
      }

      const responseData = await response.json();
      const draftData = responseData.data || responseData;

      this.logger.log(`Successfully created Beehiiv draft post ID: ${draftData.id}`);

      return {
        id: draftData.id,
        title: draftData.title,
        subtitle: draftData.subtitle,
        status: draftData.status,
        web_url: draftData.web_url,
        created_at: draftData.created_at,
      };
    } catch (err) {
      if (err instanceof InternalServerErrorException) {
        throw err;
      }
      this.logger.error(`Failed to push draft to Beehiiv: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`Beehiiv draft creation failed: ${err.message}`);
    }
  }
}
