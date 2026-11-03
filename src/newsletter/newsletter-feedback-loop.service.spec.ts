import { NewsletterFeedbackLoopService } from './newsletter-feedback-loop.service';
import { BeehiivService, BeehiivPostStats } from './beehiiv.service';

describe('NewsletterFeedbackLoopService', () => {
  let service: NewsletterFeedbackLoopService;
  let mockBeehiivService: Partial<jest.Mocked<BeehiivService>>;

  beforeEach(() => {
    mockBeehiivService = {
      getPost: jest.fn(),
      getPostStats: jest.fn(),
    };
    service = new NewsletterFeedbackLoopService(
      mockBeehiivService as unknown as BeehiivService,
    );
  });

  describe('diffDraftVsPublished', () => {
    it('should detect retained, added, and cut shows and voice calibration', () => {
      const draftContent = `
        # Top Picks
        - Big Something at Lincoln Theatre
        - Dogs in a Pile at Orange Peel
        Intro paragraph with lots of extra commentary that the editor ends up trimming down significantly.
      `;

      const publishedHtml = `
        <h1>Top Picks</h1>
        <p>Big Something at Lincoln Theatre</p>
        <p>Billy Strings at Koka Booth</p>
      `;

      const diff = service.diffDraftVsPublished(
        'post_123',
        draftContent,
        publishedHtml,
      );

      expect(diff.postId).toBe('post_123');
      expect(diff.retainedShows).toContain('Big Something');
      expect(diff.addedShows).toContain('Billy Strings');
      expect(diff.removedShows).toContain('Dogs in a Pile');
      expect(diff.voiceCalibrations.length).toBeGreaterThan(0);
    });
  });

  describe('calculateEngagementAffinities', () => {
    it('should compute click counts, ticket intents, and entity affinity weights', () => {
      const stats: BeehiivPostStats = {
        id: 'post_123',
        open_rate: 0.44,
        click_rate: 0.12,
        total_clicks: 80,
        links: [
          {
            url: 'https://etix.com/ticket/dogs-in-a-pile-lincoln',
            clicks: 40,
            unique_clicks: 35,
          },
          {
            url: 'https://open.spotify.com/artist/bigsomething',
            clicks: 25,
            unique_clicks: 20,
          },
          {
            url: 'https://discord.gg/ezvibes',
            clicks: 15,
            unique_clicks: 12,
          },
        ],
      };

      const report = service.calculateEngagementAffinities(stats);

      expect(report.postId).toBe('post_123');
      expect(report.totalClicks).toBe(80);
      expect(report.ticketLinkClicks).toBe(40);
      expect(report.spotifyClicks).toBe(25);
      expect(report.entityAffinities.length).toBeGreaterThan(0);

      // Check artist affinity calculation
      const dogsAffinity = report.entityAffinities.find(
        (a) => a.entityName === 'Dogs in a Pile',
      );
      expect(dogsAffinity).toBeDefined();
      expect(dogsAffinity?.clicks).toBe(40);
      expect(dogsAffinity?.affinityWeight).toBeGreaterThan(1.0);
      expect(report.curationAdvice.length).toBeGreaterThan(0);
    });
  });
});
