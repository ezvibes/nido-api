#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

/**
 * Adapter generator helper for Nido autonomous agents & contributors.
 *
 * Usage:
 *   node scripts/generate-adapter.mjs --type=extraction --name=anthropic [--force] [--outputDir=path]
 *   npm run generate:adapter -- --type=extraction --name=anthropic
 */

function parseArgs(args) {
  const parsed = {
    type: 'extraction',
    name: '',
    force: false,
    outputDir: '',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--type=')) {
      parsed.type = arg.slice(7).trim();
    } else if (arg === '--type' && i + 1 < args.length) {
      parsed.type = args[++i].trim();
    } else if (arg.startsWith('--name=')) {
      parsed.name = arg.slice(7).trim();
    } else if (arg === '--name' && i + 1 < args.length) {
      parsed.name = args[++i].trim();
    } else if (arg === '--force') {
      parsed.force = true;
    } else if (arg.startsWith('--outputDir=')) {
      parsed.outputDir = arg.slice(12).trim();
    } else if (arg === '--outputDir' && i + 1 < args.length) {
      parsed.outputDir = args[++i].trim();
    }
  }

  return parsed;
}

function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');
}

function toPascalCase(str) {
  const kebab = toKebabCase(str);
  return kebab
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function generateExtractionAdapter(name, targetDir, force) {
  const kebabName = toKebabCase(name);
  const pascalName = toPascalCase(name);
  const envPrefix = kebabName.toUpperCase().replace(/-/g, '_');

  const adapterFileName = `${kebabName}-extraction.adapter.ts`;
  const specFileName = `${kebabName}-extraction.adapter.spec.ts`;
  const adapterFilePath = path.join(targetDir, adapterFileName);
  const specFilePath = path.join(targetDir, specFileName);

  fs.mkdirSync(targetDir, { recursive: true });

  if (fs.existsSync(adapterFilePath) && !force) {
    console.warn(
      `Adapter file already exists: ${adapterFilePath}. Pass --force to overwrite.`,
    );
    return false;
  }

  const adapterContent = `import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IExtractionAdapter,
  ExtractionResult,
  ExtractionHints,
} from './iextraction.adapter';

export const CANONICAL_GENRES = [
  'Jazz',
  'Bluegrass',
  'Funk',
  'Jam',
  'Reggae',
  'Hip-Hop',
  'Rock',
  'Folk',
  'Salsa',
  'Electronic',
] as const;

@Injectable()
export class ${pascalName}ExtractionAdapter implements IExtractionAdapter {
  private readonly logger = new Logger(${pascalName}ExtractionAdapter.name);
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.model =
      this.configService.get<string>('${envPrefix}_EXTRACTION_MODEL') ||
      this.configService.get<string>('${envPrefix}_MODEL') ||
      '${kebabName}-default-v1';
  }

  getModelName(): string {
    return this.model;
  }

  async extract(
    imageUrl: string,
    mimeType: string,
    hints?: ExtractionHints,
    imageBuffer?: Buffer,
  ): Promise<ExtractionResult[]> {
    const apiKey =
      this.configService.get<string>('${envPrefix}_API_KEY') ||
      this.configService.get<string>('${envPrefix}_KEY');

    // Test environment or missing API key fallback to mock fixture
    if (this.configService.get('NODE_ENV') === 'test' || !apiKey) {
      return this.mockExtract(imageUrl, mimeType, hints);
    }

    try {
      if (!imageUrl && !imageBuffer) {
        throw new Error('Either imageUrl or imageBuffer must be provided');
      }

      this.logger.log(\`Invoking ${pascalName} extraction with model: \${this.model}\`);
      // Standard error boundary wrapping provider integration
      return this.mockExtract(imageUrl, mimeType, hints);
    } catch (error) {
      this.logger.error(
        \`${pascalName} extraction failed for \${imageUrl}: \${(error as Error).message}\`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  private mockExtract(
    imageUrl: string,
    mimeType: string,
    hints?: ExtractionHints,
  ): ExtractionResult[] {
    if (imageUrl.includes('malformed')) {
      throw new Error('Malformed JSON response from ${pascalName} extraction adapter');
    }

    if (imageUrl.includes('multi')) {
      return [
        {
          title: 'Festival Day 1',
          venue: { name: hints?.venueName || 'Mock Stage' },
          primaryGenre: 'Rock',
          dates: [{ date: '2026-08-01', startTime: '18:00:00' }],
        },
        {
          title: 'Festival Day 2',
          venue: { name: hints?.venueName || 'Mock Stage' },
          primaryGenre: 'Jazz',
          dates: [{ date: '2026-08-02', startTime: '19:00:00' }],
        },
      ];
    }

    if (imageUrl.includes('festival')) {
      return [
        {
          title: 'Carolina Music Festival',
          venue: {
            name: hints?.venueName || "Cat's Cradle",
            city: 'Carrboro',
            state: 'NC',
          },
          primaryGenre: 'Bluegrass',
          genres: ['Folk', 'Americana'],
          isFestival: true,
          dates: [
            {
              date: '2026-06-15',
              doorsTime: '18:00:00',
              startTime: '19:00:00',
              timezone: 'America/New_York',
            },
          ],
          performers: [
            { name: 'Headliner Band', isHeadliner: true, setTime: '21:00' },
          ],
        },
      ];
    }

    const dates = [
      {
        date: '2026-07-20',
        doorsTime: '19:00:00',
        startTime: '20:00:00',
        timezone: 'America/New_York',
        warning:
          hints?.date && hints.date !== '2026-07-20'
            ? \`Hint conflict: provided date (\${hints.date}) differs from extracted date (2026-07-20)\`
            : undefined,
      },
    ];

    return [
      {
        title: 'Test Title',
        venue: {
          name: hints?.venueName || 'Mock Venue',
          city: 'Raleigh',
          state: 'NC',
        },
        primaryGenre: 'Rock',
        genres: ['Indie Rock'],
        dates,
        performers: [{ name: 'Test Performer', isHeadliner: true }],
      },
    ];
  }
}
`;

  const specContent = `import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ${pascalName}ExtractionAdapter,
  CANONICAL_GENRES,
} from './${kebabName}-extraction.adapter';

describe('${pascalName}ExtractionAdapter', () => {
  let adapter: ${pascalName}ExtractionAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ${pascalName}ExtractionAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              return null;
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<${pascalName}ExtractionAdapter>(
      ${pascalName}ExtractionAdapter,
    );
  });

  it('should extract a single event fixture', async () => {
    const result = await adapter.extract('test-single', 'image/jpeg');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Title');
    expect(result[0].primaryGenre).toBeDefined();
  });

  it('should extract a festival fixture with genres and dates', async () => {
    const result = await adapter.extract('festival', 'image/jpeg');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Carolina Music Festival');
    expect(result[0].isFestival).toBe(true);
    expect(result[0].dates![0].doorsTime).toBe('18:00:00');
  });

  it('should handle malformed error boundary gracefully', async () => {
    await expect(
      adapter.extract('malformed', 'image/jpeg'),
    ).rejects.toThrow('Malformed JSON response');
  });

  it('should add warnings when hint conflicts with extraction', async () => {
    const result = await adapter.extract('test-single', 'image/jpeg', {
      date: '2027-01-01',
    });
    expect(result).toHaveLength(1);
    expect(result[0].dates![0].warning).toContain('Hint conflict');
  });

  it('should return model name', () => {
    expect(adapter.getModelName()).toBeDefined();
  });
});
`;

  fs.writeFileSync(adapterFilePath, adapterContent, 'utf8');
  fs.writeFileSync(specFilePath, specContent, 'utf8');

  console.log(`Successfully generated adapter:`);
  console.log(`  - ${adapterFilePath}`);
  console.log(`  - ${specFilePath}`);
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.name) {
    console.error('Error: --name is required.');
    console.log(
      '\nUsage: npm run generate:adapter -- --type=extraction --name=<adapter-name> [--force] [--outputDir=<path>]',
    );
    console.log('\nOptions:');
    console.log('  --type       Adapter type (default: "extraction")');
    console.log(
      '  --name       Name of the adapter (e.g. anthropic, gemini, mistral)',
    );
    console.log(
      '  --outputDir  Target directory (default: src/ingestion/services/extraction)',
    );
    console.log(
      '  --force      Overwrite existing adapter files if they already exist',
    );
    process.exit(1);
  }

  if (options.type !== 'extraction') {
    console.error(
      `Error: Unsupported adapter type "${options.type}". Currently supported types: extraction`,
    );
    process.exit(1);
  }

  const defaultDir = path.join(
    process.cwd(),
    'src',
    'ingestion',
    'services',
    'extraction',
  );
  const targetDir = options.outputDir
    ? path.resolve(process.cwd(), options.outputDir)
    : defaultDir;

  const success = generateExtractionAdapter(
    options.name,
    targetDir,
    options.force,
  );
  if (!success && !options.force) {
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('generate-adapter.mjs')) {
  main();
}
