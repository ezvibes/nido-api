import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NewsletterService } from '../newsletter/newsletter.service';
import { BeehiivService } from '../newsletter/beehiiv.service';
import { Concert, ConcertCatalogStatus } from '../apis/concerts/entities/concert.entity';
import * as dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  console.log('--- Newsletter Output Verification Test ---');

  const mockConcerts = [
    {
      id: 'c1',
      title: 'Papadosio & SunSquabi',
      startsAt: new Date('2026-09-18T20:00:00Z'),
      genre: 'Funk-Rock',
      catalogStatus: ConcertCatalogStatus.ACTIVE,
      isTopPick: true,
      topPickScore: 0.95,
      venue: { name: 'Lincoln Theatre', city: 'Raleigh', region: 'NC' },
      lineup: [],
    },
  ];

  const mockConcertRepo = {
    find: jest.fn().mockResolvedValue(mockConcerts),
  };

  const mockConfig = {
    get: (key: string) => process.env[key] || null,
  };

  const mockBeehiiv = {
    createDraftFromHtml: jest.fn().mockResolvedValue({
      id: 'post_123',
      title: 'Draft',
      status: 'draft',
    }),
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      NewsletterService,
      { provide: getRepositoryToken(Concert), useValue: mockConcertRepo },
      { provide: ConfigService, useValue: mockConfig },
      { provide: BeehiivService, useValue: mockBeehiiv },
    ],
  }).compile();

  const service = moduleRef.get<NewsletterService>(NewsletterService);

  const preview = await service.previewNewsletterSources({ editionType: 'weekly' });
  console.log('Preview Result:', JSON.stringify(preview, null, 2));
}

runTest().catch(console.error);
