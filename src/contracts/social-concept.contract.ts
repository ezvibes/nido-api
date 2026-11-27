import { z } from 'zod';
import { WeeklyBriefCollaboratorSchema } from './content-brief.contract';

export const SocialConceptFormatSchema = z.enum([
  'carousel',
  'reel',
  'single_image',
  'story_sequence',
]);

export type SocialConceptFormat = z.infer<typeof SocialConceptFormatSchema>;

export const SocialConceptPillarSchema = z.enum([
  'upcoming_show_guide',
  'artist_festival_spotlight',
  'community_culture_moment',
]);

export type SocialConceptPillar = z.infer<typeof SocialConceptPillarSchema>;

export const SocialConceptApprovalStatusSchema = z.enum([
  'pending_review',
  'approved',
  'rejected',
]);

export type SocialConceptApprovalStatus = z.infer<
  typeof SocialConceptApprovalStatusSchema
>;

export const SocialConceptSourceFactSchema = z.object({
  concertId: z.string().min(1),
  title: z.string().min(1),
  artists: z.array(z.string()),
  venueName: z.string().min(1),
  city: z.string().nullable(),
  state: z.string().nullable(),
  localDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'localDate must be YYYY-MM-DD'),
  confirmedTime: z.string().nullable(),
  ticketUrl: z.string().nullable(),
  sourceUrl: z.string().min(1),
});

export type SocialConceptSourceFact = z.infer<
  typeof SocialConceptSourceFactSchema
>;

export const SocialConceptSchema = z.object({
  conceptId: z.string().min(1),
  pillar: SocialConceptPillarSchema,
  format: SocialConceptFormatSchema,
  title: z.string().min(1),
  primaryHook: z.string().min(1),
  timelinessRationale: z.string().min(1),
  editableCaptionDraft: z.string().min(1),
  slideOrReelStructure: z.array(z.string().min(1)).min(1),
  primaryCta: z.string().min(1),
  accompanyingStory: z.string().min(1),
  newsletterConnection: z.string().min(1),
  sourceFacts: z.array(SocialConceptSourceFactSchema),
  verifiedCollaboratorTags: z.array(WeeklyBriefCollaboratorSchema),
  mediaRefs: z.array(z.string()),
  missingDetails: z.array(z.string()),
  requiresHumanReview: z.literal(true).default(true),
  approvalStatus: SocialConceptApprovalStatusSchema.default('pending_review'),
});

export type SocialConcept = z.infer<typeof SocialConceptSchema>;

export const WeeklySocialConceptsBatchSchema = z.object({
  generatedAt: z.string().min(1),
  briefGeneratedAt: z.string().min(1),
  windowStart: z.string().min(1),
  windowEnd: z.string().min(1),
  daysAhead: z.number().int().min(1),
  campaignTheme: z.string().nullable(),
  totalConcepts: z.number().int().min(0),
  concepts: z.array(SocialConceptSchema),
});

export type WeeklySocialConceptsBatch = z.infer<
  typeof WeeklySocialConceptsBatchSchema
>;
