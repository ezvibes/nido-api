import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  InstagramInsightMetric,
  InstagramInsights,
  InstagramInsightsSchema,
  InstagramMediaItem,
  InstagramMediaItemSchema,
} from '../contracts/instagram.contract';
import { InstagramAuthService } from './instagram-auth.service';

const FACEBOOK_GRAPH_BASE_URL = 'https://graph.facebook.com/v21.0';
const MAX_MEDIA_LIMIT = 25;
const DEFAULT_MEDIA_LIMIT = 10;

const INSIGHT_METRICS = [
  'reach',
  'impressions',
  'likes',
  'comments',
  'shares',
  'saved',
  'plays',
  'total_interactions',
] as const;

type InsightApiMetric = (typeof INSIGHT_METRICS)[number];

const METRIC_TO_FIELD_MAP: Record<
  InsightApiMetric,
  keyof Pick<
    InstagramInsights,
    | 'reach'
    | 'impressions'
    | 'likes'
    | 'comments'
    | 'shares'
    | 'saved'
    | 'plays'
    | 'totalInteractions'
  >
> = {
  reach: 'reach',
  impressions: 'impressions',
  likes: 'likes',
  comments: 'comments',
  shares: 'shares',
  saved: 'saved',
  plays: 'plays',
  total_interactions: 'totalInteractions',
};

@Injectable()
export class InstagramMediaService {
  private readonly logger = new Logger(InstagramMediaService.name);

  constructor(private readonly instagramAuthService: InstagramAuthService) {}

  /**
   * Lists the connected Instagram Business account's own media, bounded to <= 25 items.
   */
  async listOwnMedia(
    limit = DEFAULT_MEDIA_LIMIT,
  ): Promise<InstagramMediaItem[]> {
    const numericLimit = Number(limit);
    const boundedLimit = Number.isFinite(numericLimit)
      ? Math.min(Math.max(Math.trunc(numericLimit), 1), MAX_MEDIA_LIMIT)
      : DEFAULT_MEDIA_LIMIT;

    const { accessToken, instagramUserId } =
      await this.instagramAuthService.getValidAccessToken();

    const params = new URLSearchParams({
      fields:
        'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
      limit: String(boundedLimit),
      access_token: accessToken,
    });

    const response = await this.fetchGraphJson<{
      data?: Array<Record<string, any>>;
    }>(
      `${FACEBOOK_GRAPH_BASE_URL}/${encodeURIComponent(instagramUserId)}/media?${params.toString()}`,
      'list own media',
    );

    const items = Array.isArray(response.data) ? response.data : [];
    return items.slice(0, boundedLimit).map((item) =>
      InstagramMediaItemSchema.parse({
        id: String(item.id),
        caption: item.caption ?? null,
        mediaType: String(item.media_type ?? 'UNKNOWN'),
        mediaUrl: item.media_url ?? null,
        thumbnailUrl: item.thumbnail_url ?? null,
        permalink: item.permalink ?? null,
        timestamp: item.timestamp ?? null,
        likeCount: typeof item.like_count === 'number' ? item.like_count : null,
        commentsCount:
          typeof item.comments_count === 'number' ? item.comments_count : null,
      }),
    );
  }

  /**
   * Fetches read-only insights for a specific media ID, normalizing unsupported
   * or missing metrics to 'unavailable'.
   */
  async getMediaInsights(mediaId: string): Promise<InstagramInsights> {
    const trimmedId = mediaId?.trim();
    if (!trimmedId) {
      throw new BadRequestException('Media ID is required.');
    }

    const { accessToken, instagramUserId } =
      await this.instagramAuthService.getValidAccessToken();

    const mediaParams = new URLSearchParams({
      fields: 'id,media_type',
      access_token: accessToken,
    });

    const mediaMeta = await this.fetchGraphJson<{
      id?: string;
      media_type?: string;
    }>(
      `${FACEBOOK_GRAPH_BASE_URL}/${encodeURIComponent(trimmedId)}?${mediaParams.toString()}`,
      'fetch media metadata',
    );

    const insightsParams = new URLSearchParams({
      metric: INSIGHT_METRICS.join(','),
      access_token: accessToken,
    });

    const insightsUrl = `${FACEBOOK_GRAPH_BASE_URL}/${encodeURIComponent(trimmedId)}/insights?${insightsParams.toString()}`;

    const metricsResult: Record<
      keyof typeof METRIC_TO_FIELD_MAP,
      InstagramInsightMetric
    > = {
      reach: 'unavailable',
      impressions: 'unavailable',
      likes: 'unavailable',
      comments: 'unavailable',
      shares: 'unavailable',
      saved: 'unavailable',
      plays: 'unavailable',
      total_interactions: 'unavailable',
    };

    const res = await this.safeFetch(insightsUrl, 'fetch media insights');
    const body = await this.parseJsonSafe(res);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new UnauthorizedException(
          'Instagram authorization failed while fetching media insights.',
        );
      }

      const errorMessage =
        body?.error?.message ?? body?.error_message ?? `HTTP ${res.status}`;
      const errorCode = body?.error?.code;

      if (this.isUnsupportedMetricError(res.status, errorCode, errorMessage)) {
        this.logger.warn(
          `Instagram insights unsupported for media ${trimmedId}; normalizing metrics to unavailable.`,
        );
      } else {
        throw new BadRequestException(
          `Instagram fetch media insights failed: ${errorMessage}`,
        );
      }
    } else if (Array.isArray(body?.data)) {
      for (const entry of body.data) {
        const name = entry?.name as InsightApiMetric | undefined;
        if (!name || !(name in METRIC_TO_FIELD_MAP)) {
          continue;
        }
        const rawValue = entry?.values?.[0]?.value;
        if (
          typeof rawValue === 'number' &&
          Number.isFinite(rawValue) &&
          rawValue >= 0
        ) {
          metricsResult[name] = rawValue;
        }
      }
    }

    const unavailableMetrics: string[] = [];
    for (const metric of INSIGHT_METRICS) {
      if (metricsResult[metric] === 'unavailable') {
        unavailableMetrics.push(METRIC_TO_FIELD_MAP[metric]);
      }
    }

    return InstagramInsightsSchema.parse({
      mediaId: trimmedId,
      mediaType: mediaMeta.media_type ?? null,
      reach: metricsResult.reach,
      impressions: metricsResult.impressions,
      likes: metricsResult.likes,
      comments: metricsResult.comments,
      shares: metricsResult.shares,
      saved: metricsResult.saved,
      plays: metricsResult.plays,
      totalInteractions: metricsResult.total_interactions,
      fetchedAt: new Date().toISOString(),
      unavailableMetrics,
    });
  }

  private isUnsupportedMetricError(
    status: number,
    code: unknown,
    message: string,
  ): boolean {
    if (status !== 400) {
      return false;
    }
    const lower = message.toLowerCase();
    return (
      code === 100 ||
      lower.includes('unsupported') ||
      lower.includes('not supported') ||
      lower.includes('metric') ||
      lower.includes('cannot be used')
    );
  }

  private async safeFetch(
    url: string,
    contextLabel: string,
  ): Promise<Response> {
    try {
      return await globalThis.fetch(url, { method: 'GET' });
    } catch {
      throw new BadRequestException(
        `Network error during Instagram ${contextLabel}.`,
      );
    }
  }

  private async parseJsonSafe(res: Response): Promise<any> {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  private async fetchGraphJson<T>(
    url: string,
    contextLabel: string,
  ): Promise<T> {
    const res = await this.safeFetch(url, contextLabel);
    const body = await this.parseJsonSafe(res);

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new UnauthorizedException(
          `Instagram authorization failed during ${contextLabel}.`,
        );
      }
      const message =
        body?.error?.message ?? body?.error_message ?? `HTTP ${res.status}`;
      throw new BadRequestException(
        `Instagram ${contextLabel} failed: ${message}`,
      );
    }

    return body as T;
  }
}
