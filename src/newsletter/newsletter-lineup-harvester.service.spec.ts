import { NewsletterLineupHarvesterService } from './newsletter-lineup-harvester.service';
import { Repository } from 'typeorm';
import { Band } from '../apis/bands/entities/band.entity';

describe('NewsletterLineupHarvesterService', () => {
  let service: NewsletterLineupHarvesterService;
  const mockFindOne = jest.fn();
  const mockCreate = jest.fn();
  const mockSave = jest.fn();
  const mockBandRepo = {
    findOne: mockFindOne,
    create: mockCreate,
    save: mockSave,
  } as unknown as Repository<Band>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NewsletterLineupHarvesterService(mockBandRepo);
  });

  describe('extractSupportActs', () => {
    it('should extract headliner and multiple support acts with "w/"', () => {
      const result = service.extractSupportActs(
        'Big Something w/ The Fritz, Marvelous Funkshun',
      );
      expect(result.headliner).toBe('Big Something');
      expect(result.supportingActs).toEqual(['The Fritz', 'Marvelous Funkshun']);
    });

    it('should extract headliner and support act with "with" and "and"', () => {
      const result = service.extractSupportActs(
        'Billy Strings with Bryan Sutton and Sierra Hull',
      );
      expect(result.headliner).toBe('Billy Strings');
      expect(result.supportingActs).toEqual(['Bryan Sutton', 'Sierra Hull']);
    });

    it('should extract headliner and support act with "+"', () => {
      const result = service.extractSupportActs('Doom Flamingo + The Iceman Special');
      expect(result.headliner).toBe('Doom Flamingo');
      expect(result.supportingActs).toEqual(['The Iceman Special']);
    });

    it('should return empty supporting acts for standalone headliner', () => {
      const result = service.extractSupportActs('Eggy');
      expect(result.headliner).toBe('Eggy');
      expect(result.supportingActs).toEqual([]);
    });
  });

  describe('parseFestivalLineup', () => {
    it('should parse newline and comma separated festival rosters', () => {
      const text = `
        Bela Fleck
        Billy Strings
        Sierra Hull, Steep Canyon Rangers
        Sam Bush
        Day 1
        Doors 5pm
      `;
      const result = service.parseFestivalLineup(text);
      expect(result).toContain('Bela Fleck');
      expect(result).toContain('Billy Strings');
      expect(result).toContain('Sierra Hull');
      expect(result).toContain('Steep Canyon Rangers');
      expect(result).toContain('Sam Bush');
      expect(result).not.toContain('Day 1');
      expect(result).not.toContain('Doors 5pm');
    });
  });

  describe('processDiscoveredArtists', () => {
    it('should identify known core roster artists and unknown candidate discoveries', async () => {
      // Billy Strings is in EZ_VIBES_CORE_ARTISTS
      mockFindOne.mockResolvedValueOnce({ id: 'band-1', name: 'Billy Strings' } as any);
      // Brand New Support Band is neither in core roster nor in DB
      mockFindOne.mockResolvedValueOnce(null);

      const report = await service.processDiscoveredArtists(
        ['Billy Strings', 'Brand New Support Band'],
        'support_act',
        'Lincoln Theatre',
        false,
      );

      expect(report.totalExtracted).toBe(2);
      expect(report.newDiscoveriesCount).toBe(1);
      expect(report.candidates[0].isKnownCoreRoster).toBe(true);
      expect(report.candidates[0].actionTaken).toBe('ALREADY_EXISTS');
      expect(report.candidates[1].isKnownCoreRoster).toBe(false);
      expect(report.candidates[1].actionTaken).toBe('PROPOSED_FOR_CRM');
    });

    it('should auto-create new bands in DB if autoCreateInDb is true', async () => {
      mockFindOne.mockResolvedValue(null);
      const createdEntity = { name: 'Unknown Rising Act', slug: 'unknown-rising-act' } as Band;
      mockCreate.mockReturnValue(createdEntity);
      mockSave.mockResolvedValue(createdEntity);

      const report = await service.processDiscoveredArtists(
        ['Unknown Rising Act'],
        'festival_lineup',
        'Shakori Hills',
        true,
      );

      expect(report.newDiscoveriesCount).toBe(1);
      expect(report.candidates[0].actionTaken).toBe('CREATED_IN_CATALOG');
      expect(mockSave).toHaveBeenCalled();
    });
  });
});
