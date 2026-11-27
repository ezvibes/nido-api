import { z } from 'zod';

export const INSTAGRAM_REQUIRED_SCOPES = [
  'instagram_basic',
  'pages_show_list',
  'pages_read_engagement',
] as const;

export const InstagramAuthMethodSchema = z.enum([
  'facebook_login',
  'instagram_login',
]);

export type InstagramAuthMethod = z.infer<typeof InstagramAuthMethodSchema>;

export const InstagramConnectionStateSchema = z.enum([
  'connected',
  'disconnected',
  'revoked',
  'expired',
]);

export type InstagramConnectionState = z.infer<
  typeof InstagramConnectionStateSchema
>;

/**
 * Sanitized Instagram Business connection status.
 * Never includes access tokens or encrypted token payloads.
 */
export const InstagramConnectionStatusSchema = z.object({
  connected: z.boolean(),
  status: InstagramConnectionStateSchema,
  authMethod: InstagramAuthMethodSchema.default('facebook_login'),
  instagramUserId: z.string().min(1).nullable(),
  username: z.string().min(1).nullable(),
  accountType: z.string().min(1).nullable(),
  scopes: z.array(z.string()),
  tokenExpiresAt: z.string().datetime().nullable(),
  lastRefreshedAt: z.string().datetime().nullable(),
  connectedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
});

export type InstagramConnectionStatus = z.infer<
  typeof InstagramConnectionStatusSchema
>;

export const InstagramMediaItemSchema = z.object({
  id: z.string().min(1),
  caption: z.string().nullable(),
  mediaType: z.string().min(1),
  mediaUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  permalink: z.string().nullable(),
  timestamp: z.string().nullable(),
  likeCount: z.number().int().nonnegative().nullable(),
  commentsCount: z.number().int().nonnegative().nullable(),
});

export type InstagramMediaItem = z.infer<typeof InstagramMediaItemSchema>;

export const InstagramInsightMetricSchema = z.union([
  z.number().nonnegative(),
  z.literal('unavailable'),
]);

export type InstagramInsightMetric = z.infer<
  typeof InstagramInsightMetricSchema
>;

export const InstagramInsightsSchema = z.object({
  mediaId: z.string().min(1),
  mediaType: z.string().min(1).nullable(),
  reach: InstagramInsightMetricSchema,
  impressions: InstagramInsightMetricSchema,
  likes: InstagramInsightMetricSchema,
  comments: InstagramInsightMetricSchema,
  shares: InstagramInsightMetricSchema,
  saved: InstagramInsightMetricSchema,
  plays: InstagramInsightMetricSchema,
  totalInteractions: InstagramInsightMetricSchema,
  fetchedAt: z.string().datetime(),
  unavailableMetrics: z.array(z.string()),
});

export type InstagramInsights = z.infer<typeof InstagramInsightsSchema>;
