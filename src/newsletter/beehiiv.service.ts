import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
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
  edit_url?: string;
  created_at?: number;
}

export interface BeehiivLinkClick {
  url: string;
  clicks: number;
  unique_clicks: number;
}

export interface BeehiivPostStats {
  id: string;
  recipients_count?: number;
  open_rate?: number;
  click_rate?: number;
  total_clicks?: number;
  unique_clicks?: number;
  unsubscribes?: number;
  links?: BeehiivLinkClick[];
}

export interface BeehiivPostDetails {
  id: string;
  title: string;
  subtitle?: string;
  status: string;
  web_url?: string;
  publish_date?: number;
  content?: {
    free?: {
      web?: string;
      email?: string;
      rss?: string;
    };
  };
  stats?: BeehiivPostStats;
}

@Injectable()
export class BeehiivService {
  private readonly logger = new Logger(BeehiivService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Pushes generated HTML newsletter content to Beehiiv API v2 as a template-based draft.
   */
  async createDraftFromHtml(
    params: BeehiivDraftParams,
  ): Promise<BeehiivDraftResponse> {
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

      this.logger.log(
        `Successfully created Beehiiv draft post ID: ${draftData.id}`,
      );

      return {
        id: draftData.id,
        title: draftData.title,
        subtitle: draftData.subtitle,
        status: draftData.status,
        web_url: draftData.web_url,
        edit_url: `https://app.beehiiv.com/posts/${draftData.id}/edit`,
        created_at: draftData.created_at,
      };
    } catch (err) {
      if (err instanceof InternalServerErrorException) {
        throw err;
      }
      this.logger.error(
        `Failed to push draft to Beehiiv: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        `Beehiiv draft creation failed: ${err.message}`,
      );
    }
  }

  /**
   * Retrieves post details including published content for diffing and calibration.
   */
  async getPost(
    postId: string,
    publicationId?: string,
  ): Promise<BeehiivPostDetails> {
    const apiKey = this.configService.get<string>('BEEHIIV_API_KEY')?.trim();
    if (!apiKey) {
      throw new InternalServerErrorException(
        'BEEHIIV_API_KEY is not configured in the application environment.',
      );
    }

    const pubId =
      publicationId ||
      this.configService.get<string>('BEEHIIV_PUBLICATION_ID')?.trim();
    if (!pubId) {
      throw new InternalServerErrorException(
        'BEEHIIV_PUBLICATION_ID is not configured in environment or params.',
      );
    }

    const endpoint = `https://api.beehiiv.com/v2/publications/${pubId}/posts/${postId}?expand[]=free_web_content`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Beehiiv getPost API returned error status ${response.status}: ${errorText}`,
        );
        throw new InternalServerErrorException(
          `Beehiiv getPost error (${response.status}): ${errorText}`,
        );
      }

      const responseData = await response.json();
      const postData = responseData.data || responseData;

      return {
        id: postData.id,
        title: postData.title,
        subtitle: postData.subtitle,
        status: postData.status,
        web_url: postData.web_url,
        publish_date: postData.publish_date,
        content: postData.content,
        stats: postData.stats,
      };
    } catch (err) {
      if (err instanceof InternalServerErrorException) {
        throw err;
      }
      this.logger.error(
        `Failed to retrieve post from Beehiiv: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        `Beehiiv getPost failed: ${err.message}`,
      );
    }
  }

  /**
   * Retrieves post performance statistics and link-click engagement data.
   */
  async getPostStats(
    postId: string,
    publicationId?: string,
  ): Promise<BeehiivPostStats> {
    const apiKey = this.configService.get<string>('BEEHIIV_API_KEY')?.trim();
    if (!apiKey) {
      throw new InternalServerErrorException(
        'BEEHIIV_API_KEY is not configured in the application environment.',
      );
    }

    const pubId =
      publicationId ||
      this.configService.get<string>('BEEHIIV_PUBLICATION_ID')?.trim();
    if (!pubId) {
      throw new InternalServerErrorException(
        'BEEHIIV_PUBLICATION_ID is not configured in environment or params.',
      );
    }

    const endpoint = `https://api.beehiiv.com/v2/publications/${pubId}/posts/${postId}?expand[]=stats`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Beehiiv getPostStats API returned error status ${response.status}: ${errorText}`,
        );
        throw new InternalServerErrorException(
          `Beehiiv getPostStats error (${response.status}): ${errorText}`,
        );
      }

      const responseData = await response.json();
      const postData = responseData.data || responseData;
      const stats = postData.stats || {};

      return {
        id: postData.id,
        recipients_count: stats.recipients_count ?? 0,
        open_rate: stats.open_rate ?? 0,
        click_rate: stats.click_rate ?? 0,
        total_clicks: stats.total_clicks ?? 0,
        unique_clicks: stats.unique_clicks ?? 0,
        unsubscribes: stats.unsubscribes ?? 0,
        links: stats.links || [],
      };
    } catch (err) {
      if (err instanceof InternalServerErrorException) {
        throw err;
      }
      this.logger.error(
        `Failed to retrieve post stats from Beehiiv: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        `Beehiiv getPostStats failed: ${err.message}`,
      );
    }
  }
}
