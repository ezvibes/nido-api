import { Injectable } from '@nestjs/common';
import {
  WeeklyBriefCandidate,
  WeeklyBriefCollaborator,
  WeeklyContentBrief,
  WeeklyContentBriefSchema,
} from '../contracts/content-brief.contract';
import {
  SocialConcept,
  SocialConceptFormat,
  SocialConceptPillar,
  SocialConceptSourceFact,
  WeeklySocialConceptsBatch,
  WeeklySocialConceptsBatchSchema,
} from '../contracts/social-concept.contract';
import {
  GenerateWeeklyBriefOptions,
  WeeklyContentBriefService,
} from './weekly-content-brief.service';

@Injectable()
export class SocialConceptGeneratorService {
  constructor(
    private readonly weeklyContentBriefService: WeeklyContentBriefService,
  ) {}

  async generateWeeklyConcepts(
    options: GenerateWeeklyBriefOptions = {},
  ): Promise<WeeklySocialConceptsBatch> {
    const brief = await this.weeklyContentBriefService.generateBrief(options);
    return this.generateFromBrief(brief);
  }

  generateFromBrief(briefInput: WeeklyContentBrief): WeeklySocialConceptsBatch {
    const brief = WeeklyContentBriefSchema.parse(briefInput);
    const windowLabel = `${brief.windowStart.slice(0, 10)} to ${brief.windowEnd.slice(0, 10)}`;

    const showGuideConcept = this.buildUpcomingShowGuideConcept(
      brief,
      windowLabel,
    );
    const spotlightConcept = this.buildArtistSpotlightConcept(
      brief,
      windowLabel,
    );
    const communityConcept = this.buildCommunityCultureConcept(
      brief,
      windowLabel,
    );

    const concepts = [showGuideConcept, spotlightConcept, communityConcept];

    return WeeklySocialConceptsBatchSchema.parse({
      generatedAt: new Date().toISOString(),
      briefGeneratedAt: brief.generatedAt,
      windowStart: brief.windowStart,
      windowEnd: brief.windowEnd,
      daysAhead: brief.daysAhead,
      campaignTheme: brief.campaignTheme,
      totalConcepts: concepts.length,
      concepts,
    });
  }

  formatAsMarkdown(batch: WeeklySocialConceptsBatch): string {
    const lines: string[] = [
      '# Weekly Social Concepts (Muse Handoff)',
      '',
      `- **Generated:** ${batch.generatedAt}`,
      `- **Brief Generated:** ${batch.briefGeneratedAt}`,
      `- **Window:** ${batch.windowStart.slice(0, 10)} to ${batch.windowEnd.slice(0, 10)} (${batch.daysAhead} days)`,
      `- **Total Concepts:** ${batch.totalConcepts}`,
    ];

    if (batch.campaignTheme) {
      lines.push(`- **Campaign Theme:** ${batch.campaignTheme}`);
    }

    lines.push('');

    batch.concepts.forEach((concept, index) => {
      const collaboratorsText =
        concept.verifiedCollaboratorTags.length > 0
          ? concept.verifiedCollaboratorTags
              .map((c) => `${c.bandName} (${c.instagramHandle})`)
              .join(', ')
          : 'None verified';
      const mediaText =
        concept.mediaRefs.length > 0 ? concept.mediaRefs.join(', ') : 'None';
      const missingText =
        concept.missingDetails.length > 0
          ? concept.missingDetails.join(', ')
          : 'None';

      lines.push(`## ${index + 1}. ${concept.title}`);
      lines.push(`- **Concept ID:** ${concept.conceptId}`);
      lines.push(`- **Pillar:** ${concept.pillar}`);
      lines.push(`- **Format:** ${concept.format}`);
      lines.push(`- **Approval Status:** ${concept.approvalStatus}`);
      lines.push(
        `- **Requires Human Review:** ${concept.requiresHumanReview ? 'true' : 'false'}`,
      );
      lines.push(`- **Primary Hook:** ${concept.primaryHook}`);
      lines.push(`- **Timeliness Rationale:** ${concept.timelinessRationale}`);
      lines.push(`- **Primary CTA:** ${concept.primaryCta}`);
      lines.push(`- **Accompanying Story:** ${concept.accompanyingStory}`);
      lines.push(
        `- **Newsletter Connection:** ${concept.newsletterConnection}`,
      );
      lines.push(`- **Verified Collaborators:** ${collaboratorsText}`);
      lines.push(`- **Media Refs:** ${mediaText}`);
      lines.push(`- **Missing Details:** ${missingText}`);
      lines.push('');
      lines.push('### Slide / Reel Structure');
      concept.slideOrReelStructure.forEach((beat, beatIndex) => {
        lines.push(`${beatIndex + 1}. ${beat}`);
      });
      lines.push('');
      lines.push('### Editable Caption Draft');
      lines.push(concept.editableCaptionDraft);
      lines.push('');
      lines.push('### Source Facts');
      if (concept.sourceFacts.length === 0) {
        lines.push('_No approved concert facts attached._');
      } else {
        concept.sourceFacts.forEach((fact) => {
          const location = [fact.city, fact.state].filter(Boolean).join(', ');
          const venueDisplay = location
            ? `${fact.venueName} (${location})`
            : fact.venueName;
          const timeDisplay =
            fact.confirmedTime ?? 'Unconfirmed (do not invent)';
          const ticketDisplay = fact.ticketUrl ?? 'Missing';
          const artistsDisplay =
            fact.artists.length > 0 ? fact.artists.join(', ') : 'TBA';
          lines.push(
            `- **${fact.title}** (${fact.concertId}) — ${fact.localDate} | Time: ${timeDisplay} | Venue: ${venueDisplay} | Artists: ${artistsDisplay} | Tickets: ${ticketDisplay} | Source: ${fact.sourceUrl}`,
          );
        });
      }
      lines.push('');
    });

    return lines.join('\n').trimEnd();
  }

  private buildUpcomingShowGuideConcept(
    brief: WeeklyContentBrief,
    windowLabel: string,
  ): SocialConcept {
    const pillar: SocialConceptPillar = 'upcoming_show_guide';
    const format: SocialConceptFormat = 'carousel';
    const selected = brief.candidates.slice(0, 5);
    const { sourceFacts, verifiedCollaboratorTags, mediaRefs, missingDetails } =
      this.collectGroundedAssets(selected);

    const themeSuffix = brief.campaignTheme ? ` (${brief.campaignTheme})` : '';

    if (selected.length === 0) {
      return this.buildEmptyConcept({
        conceptId: `concept-${pillar}-${brief.windowStart.slice(0, 10)}`,
        pillar,
        format,
        title: `NC Live Music Guide${themeSuffix}`,
        primaryHook: `Upcoming NC shows for ${windowLabel} — awaiting approved listings.`,
        timelinessRationale: `Covers the ${brief.daysAhead}-day window (${windowLabel}) once approved concerts are added.`,
        primaryCta:
          'Subscribe to EZ Vibes Weekly Top Picks for verified show updates.',
        accompanyingStory:
          'Story poll: Which NC city or room are you hoping to catch live music in next?',
        newsletterConnection:
          'Pairs with the Weekly Top Picks newsletter schedule section.',
        missingDetails,
      });
    }

    const cities = this.collectUniqueCities(selected);
    const cityPhrase =
      cities.length > 0
        ? `across ${cities.join(', ')}`
        : 'across North Carolina';
    const showLines = selected.map((c) => this.formatShowSummaryLine(c));
    const handleList = verifiedCollaboratorTags.map((t) => t.instagramHandle);

    const slideOrReelStructure = [
      `Slide 1 (Cover): Upcoming NC Shows (${windowLabel})${themeSuffix}`,
      ...selected.map(
        (c, idx) =>
          `Slide ${idx + 2}: ${this.formatShowSummaryLine(c)} — ${c.editorialAngle}`,
      ),
      `Slide ${selected.length + 2} (CTA): Full verified listings & ticket links on EZ Vibes`,
    ];

    const captionLines = [
      `Live music ${cityPhrase} for ${windowLabel}${themeSuffix}.`,
      '',
      ...showLines.map((line) => `• ${line}`),
      '',
      'Save this guide for your weekend plans and check EZ Vibes for verified show details.',
    ];
    if (handleList.length > 0) {
      captionLines.push('', `Artists: ${handleList.join(' ')}`);
    }

    return {
      conceptId: `concept-${pillar}-${brief.windowStart.slice(0, 10)}`,
      pillar,
      format,
      title: `Weekly NC Show Guide: ${windowLabel}${themeSuffix}`,
      primaryHook: `${selected.length} verified NC show${selected.length === 1 ? '' : 's'} ${cityPhrase} (${windowLabel})`,
      timelinessRationale: `Tied directly to the ${brief.daysAhead}-day upcoming window (${windowLabel}) so local fans can plan ahead.`,
      editableCaptionDraft: captionLines.join('\n'),
      slideOrReelStructure,
      primaryCta:
        'Save this show guide and grab verified details via the EZ Vibes link in bio.',
      accompanyingStory: `Story countdown + link sticker to ${selected[0].sourceUrl} featuring ${selected[0].title}.`,
      newsletterConnection:
        'Mirrors the Weekly Top Picks calendar lineup so social readers and newsletter subscribers see the same verified dates.',
      sourceFacts,
      verifiedCollaboratorTags,
      mediaRefs,
      missingDetails,
      requiresHumanReview: true,
      approvalStatus: 'pending_review',
    };
  }

  private buildArtistSpotlightConcept(
    brief: WeeklyContentBrief,
    windowLabel: string,
  ): SocialConcept {
    const pillar: SocialConceptPillar = 'artist_festival_spotlight';
    const format: SocialConceptFormat = 'reel';
    const spotlightCandidate = this.pickSpotlightCandidate(brief.candidates);
    const selected = spotlightCandidate ? [spotlightCandidate] : [];
    const { sourceFacts, verifiedCollaboratorTags, mediaRefs, missingDetails } =
      this.collectGroundedAssets(selected);

    if (!spotlightCandidate) {
      return this.buildEmptyConcept({
        conceptId: `concept-${pillar}-${brief.windowStart.slice(0, 10)}`,
        pillar,
        format,
        title: 'Artist & Show Spotlight Reel',
        primaryHook: `Spotlight slot ready for ${windowLabel} once an approved concert is available.`,
        timelinessRationale: `Reserved for a timely artist spotlight within ${windowLabel}.`,
        primaryCta: 'Follow EZ Vibes for upcoming NC artist spotlights.',
        accompanyingStory:
          'Story question box asking followers which local NC band we should spotlight next.',
        newsletterConnection:
          'Connects to the Weekly Top Picks featured artist blurb.',
        missingDetails,
      });
    }

    const headliner =
      spotlightCandidate.artists.length > 0
        ? spotlightCandidate.artists.join(' & ')
        : spotlightCandidate.title;
    const location = [spotlightCandidate.city, spotlightCandidate.state]
      .filter(Boolean)
      .join(', ');
    const venueDisplay = location
      ? `${spotlightCandidate.venueName} in ${location}`
      : spotlightCandidate.venueName;
    const timeNote = spotlightCandidate.confirmedTime
      ? ` at ${spotlightCandidate.confirmedTime}`
      : '';
    const handleList = verifiedCollaboratorTags.map((t) => t.instagramHandle);

    const slideOrReelStructure = [
      `Beat 1 (0–3s Hook): ${headliner} coming to ${spotlightCandidate.venueName} on ${spotlightCandidate.localDate}`,
      `Beat 2 (3–10s Context): ${spotlightCandidate.editorialAngle}`,
      `Beat 3 (10–18s Show Details): ${spotlightCandidate.localDate}${timeNote} at ${venueDisplay}`,
      `Beat 4 (18–25s CTA): ${spotlightCandidate.ticketUrl ? 'Ticket link + full listing on EZ Vibes' : 'Full listing on EZ Vibes (check source for tickets)'}`,
    ];

    const captionLines = [
      `Spotlight: ${headliner} at ${venueDisplay} on ${spotlightCandidate.localDate}${timeNote}.`,
      '',
      spotlightCandidate.editorialAngle,
      '',
      spotlightCandidate.ticketUrl
        ? `Tickets & details: ${spotlightCandidate.ticketUrl}`
        : `More details on EZ Vibes: ${spotlightCandidate.sourceUrl}`,
    ];
    if (handleList.length > 0) {
      captionLines.push('', `Featuring: ${handleList.join(' ')}`);
    }

    return {
      conceptId: `concept-${pillar}-${spotlightCandidate.concertId}`,
      pillar,
      format,
      title: `Artist Spotlight: ${headliner} at ${spotlightCandidate.venueName}`,
      primaryHook: `Don't miss ${headliner} at ${venueDisplay} on ${spotlightCandidate.localDate}.`,
      timelinessRationale: `Spotlight timed ahead of the ${spotlightCandidate.localDate} show date within the ${windowLabel} window.`,
      editableCaptionDraft: captionLines.join('\n'),
      slideOrReelStructure,
      primaryCta: spotlightCandidate.ticketUrl
        ? 'Check the EZ Vibes link in bio for verified ticket info.'
        : 'Visit EZ Vibes for the full concert listing.',
      accompanyingStory: `Story share of the Reel with a "Remind Me" sticker for ${spotlightCandidate.localDate}${handleList.length > 0 ? ` tagging ${handleList.join(' ')}` : ''}.`,
      newsletterConnection:
        'Expands on the lead artist pick in this week’s EZ Vibes newsletter.',
      sourceFacts,
      verifiedCollaboratorTags,
      mediaRefs,
      missingDetails,
      requiresHumanReview: true,
      approvalStatus: 'pending_review',
    };
  }

  private buildCommunityCultureConcept(
    brief: WeeklyContentBrief,
    windowLabel: string,
  ): SocialConcept {
    const pillar: SocialConceptPillar = 'community_culture_moment';
    const format: SocialConceptFormat = 'carousel';
    const selected = this.pickCommunityCandidates(brief.candidates);
    const { sourceFacts, verifiedCollaboratorTags, mediaRefs, missingDetails } =
      this.collectGroundedAssets(selected);

    if (selected.length === 0) {
      return this.buildEmptyConcept({
        conceptId: `concept-${pillar}-${brief.windowStart.slice(0, 10)}`,
        pillar,
        format,
        title: 'NC Live Music Community Moment',
        primaryHook:
          'Showing up for independent rooms and local artists across NC.',
        timelinessRationale: `Community anchor for ${windowLabel} while awaiting approved listings.`,
        primaryCta:
          'Share a favorite local venue or recent show memory in the comments.',
        accompanyingStory:
          'Story prompt: Tag a friend you love going to local shows with.',
        newsletterConnection:
          'Echoes the EZ Vibes mission of connection and community through live music.',
        missingDetails,
      });
    }

    const venues = [...new Set(selected.map((c) => c.venueName))];
    const cities = this.collectUniqueCities(selected);
    const roomSummary = venues.slice(0, 3).join(', ');
    const citySummary =
      cities.length > 0 ? cities.join(', ') : 'North Carolina';
    const handleList = verifiedCollaboratorTags.map((t) => t.instagramHandle);

    const slideOrReelStructure = [
      `Slide 1 (Hook): Why showing up in rooms like ${roomSummary} keeps the NC scene connected`,
      ...selected.map(
        (c, idx) =>
          `Slide ${idx + 2}: ${c.venueName}${c.city ? ` (${c.city})` : ''} — ${this.formatShowSummaryLine(c)}`,
      ),
      `Slide ${selected.length + 2} (Community Prompt): Who are you bringing to a show in ${citySummary} this week?`,
    ];

    const captionLines = [
      `Live music is one of the simplest ways to feel connected in ${citySummary}.`,
      '',
      `This week (${windowLabel}), rooms like ${roomSummary} are hosting:`,
      ...selected.map((c) => `• ${this.formatShowSummaryLine(c)}`),
      '',
      'Invite a friend, support an independent room, and say hello to someone new at the merch table.',
    ];
    if (handleList.length > 0) {
      captionLines.push('', `Verified artists: ${handleList.join(' ')}`);
    }

    return {
      conceptId: `concept-${pillar}-${brief.windowStart.slice(0, 10)}`,
      pillar,
      format,
      title: `NC Scene & Community: ${roomSummary}`,
      primaryHook: `Making space for connection at ${roomSummary} this week.`,
      timelinessRationale: `Grounds the community story in real upcoming dates (${windowLabel}) at local NC venues.`,
      editableCaptionDraft: captionLines.join('\n'),
      slideOrReelStructure,
      primaryCta: 'Tag a friend you want to catch a local show with this week.',
      accompanyingStory: `Story poll: "Going to a show solo or with crew this week?" + link to ${selected[0].sourceUrl}.`,
      newsletterConnection:
        'Connects to the EZ Vibes Weekly Top Picks opening community note.',
      sourceFacts,
      verifiedCollaboratorTags,
      mediaRefs,
      missingDetails,
      requiresHumanReview: true,
      approvalStatus: 'pending_review',
    };
  }

  private pickSpotlightCandidate(
    candidates: WeeklyBriefCandidate[],
  ): WeeklyBriefCandidate | undefined {
    if (candidates.length === 0) {
      return undefined;
    }

    const withTopPick = candidates.find((c) =>
      c.editorialTags.includes('top-pick'),
    );
    if (withTopPick) {
      return withTopPick;
    }

    const withVerifiedHandle = candidates.find(
      (c) => c.verifiedCollaborators.length > 0,
    );
    if (withVerifiedHandle) {
      return withVerifiedHandle;
    }

    return candidates[1] ?? candidates[0];
  }

  private pickCommunityCandidates(
    candidates: WeeklyBriefCandidate[],
  ): WeeklyBriefCandidate[] {
    if (candidates.length === 0) {
      return [];
    }
    const coBills = candidates.filter((c) =>
      c.editorialTags.includes('co-bill'),
    );
    if (coBills.length > 0) {
      return coBills.slice(0, 3);
    }
    return candidates.slice(0, 3);
  }

  private collectGroundedAssets(candidates: WeeklyBriefCandidate[]): {
    sourceFacts: SocialConceptSourceFact[];
    verifiedCollaboratorTags: WeeklyBriefCollaborator[];
    mediaRefs: string[];
    missingDetails: string[];
  } {
    const sourceFacts: SocialConceptSourceFact[] = [];
    const verifiedCollaboratorTags: WeeklyBriefCollaborator[] = [];
    const seenBandIds = new Set<string>();
    const mediaRefs: string[] = [];
    const seenMedia = new Set<string>();
    const missingDetails: string[] = [];
    const addMissing = (detail: string) => {
      if (!missingDetails.includes(detail)) {
        missingDetails.push(detail);
      }
    };

    for (const candidate of candidates) {
      sourceFacts.push({
        concertId: candidate.concertId,
        title: candidate.title,
        artists: [...candidate.artists],
        venueName: candidate.venueName,
        city: candidate.city,
        state: candidate.state,
        localDate: candidate.localDate,
        confirmedTime: candidate.confirmedTime,
        ticketUrl: candidate.ticketUrl,
        sourceUrl: candidate.sourceUrl,
      });

      for (const collaborator of candidate.verifiedCollaborators) {
        if (!seenBandIds.has(collaborator.bandId)) {
          seenBandIds.add(collaborator.bandId);
          verifiedCollaboratorTags.push({ ...collaborator });
        }
      }

      for (const ref of candidate.mediaRefs) {
        if (!seenMedia.has(ref)) {
          seenMedia.add(ref);
          mediaRefs.push(ref);
        }
      }

      for (const flag of candidate.missingFacts) {
        addMissing(flag);
      }

      if (!candidate.ticketUrl) {
        addMissing('missing_ticket_url');
      }
      if (!candidate.confirmedTime) {
        addMissing('unconfirmed_time');
      }
      if (candidate.mediaRefs.length === 0) {
        addMissing('missing_poster_media');
      }
      if (candidate.verifiedCollaborators.length === 0) {
        addMissing('missing_verified_artist_ig_handle');
      }
    }

    if (candidates.length === 0) {
      addMissing('no_approved_concerts_in_window');
      addMissing('missing_poster_media');
    } else if (mediaRefs.length === 0) {
      addMissing('missing_poster_media');
    }

    return {
      sourceFacts,
      verifiedCollaboratorTags,
      mediaRefs,
      missingDetails,
    };
  }

  private buildEmptyConcept(params: {
    conceptId: string;
    pillar: SocialConceptPillar;
    format: SocialConceptFormat;
    title: string;
    primaryHook: string;
    timelinessRationale: string;
    primaryCta: string;
    accompanyingStory: string;
    newsletterConnection: string;
    missingDetails: string[];
  }): SocialConcept {
    return {
      conceptId: params.conceptId,
      pillar: params.pillar,
      format: params.format,
      title: params.title,
      primaryHook: params.primaryHook,
      timelinessRationale: params.timelinessRationale,
      editableCaptionDraft: `${params.primaryHook}\n\n${params.primaryCta}`,
      slideOrReelStructure: [
        `Beat 1: ${params.primaryHook}`,
        'Beat 2: Confirm approved concert listings before drafting final copy',
        `Beat 3: ${params.primaryCta}`,
      ],
      primaryCta: params.primaryCta,
      accompanyingStory: params.accompanyingStory,
      newsletterConnection: params.newsletterConnection,
      sourceFacts: [],
      verifiedCollaboratorTags: [],
      mediaRefs: [],
      missingDetails: params.missingDetails,
      requiresHumanReview: true,
      approvalStatus: 'pending_review',
    };
  }

  private collectUniqueCities(candidates: WeeklyBriefCandidate[]): string[] {
    const cities: string[] = [];
    for (const candidate of candidates) {
      const city = candidate.city?.trim();
      if (city && !cities.includes(city)) {
        cities.push(city);
      }
    }
    return cities;
  }

  private formatShowSummaryLine(candidate: WeeklyBriefCandidate): string {
    const location = [candidate.city, candidate.state]
      .filter(Boolean)
      .join(', ');
    const venuePart = location
      ? `${candidate.venueName} (${location})`
      : candidate.venueName;
    const timePart = candidate.confirmedTime ?? 'Time TBA';
    return `${candidate.localDate} (${timePart}) — ${candidate.title} at ${venuePart}`;
  }
}
