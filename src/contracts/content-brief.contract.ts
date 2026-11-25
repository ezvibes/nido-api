import { z } from 'zod';

export const MissingFactFlagSchema = z.enum([
  'missing_ticket_url',
  'unconfirmed_time',
  'missing_poster_media',
  'missing_verified_artist_ig_handle',
]);

export type MissingFactFlag = z.infer<typeof MissingFactFlagSchema>;

export const WeeklyBriefCollaboratorSchema = z.object({
  bandId: z.string().min(1),
  bandName: z.string().min(1),
  instagramHandle: z.string().min(1),
});

export type WeeklyBriefCollaborator = z.infer<
  typeof WeeklyBriefCollaboratorSchema
>;

export const WeeklyBriefCandidateSchema = z.object({
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
  genre: z.string().nullable(),
  editorialTags: z.array(z.string()),
  sourceUrl: z.string().min(1),
  ticketUrl: z.string().nullable(),
  editorialAngle: z.string().min(1),
  missingFacts: z.array(MissingFactFlagSchema),
  mediaRefs: z.array(z.string()),
  verifiedCollaborators: z.array(WeeklyBriefCollaboratorSchema),
});

export type WeeklyBriefCandidate = z.infer<typeof WeeklyBriefCandidateSchema>;

export const WeeklyContentBriefSchema = z.object({
  generatedAt: z.string().min(1),
  windowStart: z.string().min(1),
  windowEnd: z.string().min(1),
  daysAhead: z.number().int().min(1),
  limit: z.number().int().min(1).max(10),
  campaignTheme: z.string().nullable(),
  totalCandidates: z.number().int().min(0),
  candidates: z.array(WeeklyBriefCandidateSchema),
});

export type WeeklyContentBrief = z.infer<typeof WeeklyContentBriefSchema>;
