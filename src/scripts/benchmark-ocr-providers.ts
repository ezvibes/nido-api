import * as fs from 'fs';
import * as path from 'path';

interface Fixture {
  id: string;
  difficulty_class: string;
  title: string;
  performers: string[];
  venue: string;
  date: string;
  start_time: string;
  timezone: string;
  genre: string;
  uploader_hints: Record<string, string>;
}

interface ExtractionResult {
  title?: string;
  performers?: string[];
  venue?: string;
  date?: string;
  start_time?: string;
  timezone?: string;
  genre?: string;
  conflicts?: string[];
}

interface BenchmarkMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  multiEventRecall: number;
  falsePositiveRate: number;
  latencyMs: number;
  costEstimate: number;
}

const MANIFEST_PATH = path.join(__dirname, '../../test/fixtures/posters/manifest.json');
const MOCKS_PATH = path.join(__dirname, '../../test/fixtures/posters/mocks/responses.json');

// Calculate cost (estimates): Vision $0.0015/image, Gemini $0.0025/image
const VISION_COST = 0.0015;
const GEMINI_COST = 0.0025;
const HYBRID_COST = VISION_COST + GEMINI_COST;

export class OCRBenchmarkRunner {
  private fixtures: Fixture[];
  private mocks: Record<string, any>;

  constructor(private isOffline: boolean = true) {
    this.fixtures = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    if (this.isOffline) {
      this.mocks = JSON.parse(fs.readFileSync(MOCKS_PATH, 'utf-8'));
    } else {
      this.mocks = {};
    }
  }

  // Basic regex parser for Vision
  private parseVisionText(text: string): ExtractionResult {
    const lines = text.split('\\n').map((l) => l.trim()).filter((l) => l.length > 0);
    return {
      title: lines[0] || undefined,
      performers: lines.length > 1 ? [lines[1]] : undefined,
      venue: lines.length > 2 ? lines[2] : undefined,
      // In a real scenario, we'd use better regex for date/time
      date: undefined,
      start_time: undefined,
    };
  }

  private async runPureVision(fixture: Fixture): Promise<{ result: ExtractionResult; latency: number }> {
    const start = Date.now();
    let text = '';
    if (this.isOffline) {
      text = this.mocks[fixture.id]?.vision || '';
    } else {
      // call real Vision API
      text = '';
    }
    const result = this.parseVisionText(text);
    const latency = Date.now() - start + (this.isOffline ? 150 : 0); // Simulated latency
    return { result, latency };
  }

  private async runPureGemini(fixture: Fixture): Promise<{ result: ExtractionResult; latency: number }> {
    const start = Date.now();
    let result: ExtractionResult = {};
    if (this.isOffline) {
      result = this.mocks[fixture.id]?.gemini || {};
    } else {
      // call real Gemini API
    }
    const latency = Date.now() - start + (this.isOffline ? 800 : 0); // Simulated latency
    return { result, latency };
  }

  private async runHybridCascade(fixture: Fixture): Promise<{ result: ExtractionResult; latency: number }> {
    const start = Date.now();

    // Step 1: Vision
    let text = '';
    if (this.isOffline) {
      text = this.mocks[fixture.id]?.vision || '';
    }

    // Step 2: Gemini maps text to schema
    let result: ExtractionResult = {};
    if (this.isOffline) {
      result = this.mocks[fixture.id]?.gemini || {}; // Using gemini mock as the final mapped output for simplicity
    }
    const latency = Date.now() - start + (this.isOffline ? 950 : 0); // Simulated latency
    return { result, latency };
  }

  public scoreExtraction(expected: Fixture, actual: ExtractionResult, hints: Record<string, string>): { precision: number, recall: number, conflicts: string[] } {
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    const conflicts: string[] = [];

    const checkField = (field: keyof ExtractionResult, expectedValue: any) => {
      let actualValue = actual[field];

      // Apply hints, checking for conflicts
      if (hints[field]) {
         if (actualValue && String(actualValue) !== hints[field]) {
             conflicts.push(`Conflict on ${field}: Poster says '${actualValue}', Hint says '${hints[field]}'`);
         }
         // Keep actual value if it exists, or maybe return both? The requirement says "preserve both values with an explicit conflict warning (never silently overriding poster evidence)"
         // For scoring, we just check if it extracted the *poster* evidence correctly if it's there.
      }

      if (expectedValue && actualValue) {
        if (JSON.stringify(expectedValue) === JSON.stringify(actualValue)) {
          truePositives++;
        } else {
          falsePositives++;
          falseNegatives++; // Failed to extract the right one
        }
      } else if (expectedValue && !actualValue) {
        falseNegatives++;
      } else if (!expectedValue && actualValue) {
        falsePositives++;
      }
    };

    checkField('title', expected.title);
    checkField('venue', expected.venue);
    checkField('date', expected.date);
    checkField('start_time', expected.start_time);

    // Performers is array
    if (expected.performers && actual.performers) {
        let matched = 0;
        expected.performers.forEach(p => {
           if (actual.performers?.includes(p)) matched++;
           else falseNegatives++;
        });
        falsePositives += actual.performers.length - matched;
        truePositives += matched;
    } else if (expected.performers) {
        falseNegatives += expected.performers.length;
    } else if (actual.performers) {
        falsePositives += actual.performers.length;
    }

    const precision = (truePositives + falsePositives) > 0 ? truePositives / (truePositives + falsePositives) : 0;
    const recall = (truePositives + falseNegatives) > 0 ? truePositives / (truePositives + falseNegatives) : 0;

    return { precision, recall, conflicts };
  }

  public async run() {
    const results = {
      pureVision: { precision: 0, recall: 0, latency: 0, cost: VISION_COST, multiEventRecall: 0, falsePositiveRate: 0, count: 0 },
      pureGemini: { precision: 0, recall: 0, latency: 0, cost: GEMINI_COST, multiEventRecall: 0, falsePositiveRate: 0, count: 0 },
      hybridCascade: { precision: 0, recall: 0, latency: 0, cost: HYBRID_COST, multiEventRecall: 0, falsePositiveRate: 0, count: 0 },
    };

    for (const fixture of this.fixtures) {
      // Vision
      const visionRun = await this.runPureVision(fixture);
      const visionScore = this.scoreExtraction(fixture, visionRun.result, fixture.uploader_hints);
      results.pureVision.precision += visionScore.precision;
      results.pureVision.recall += visionScore.recall;
      results.pureVision.latency += visionRun.latency;
      results.pureVision.count++;

      // Gemini
      const geminiRun = await this.runPureGemini(fixture);
      const geminiScore = this.scoreExtraction(fixture, geminiRun.result, fixture.uploader_hints);
      results.pureGemini.precision += geminiScore.precision;
      results.pureGemini.recall += geminiScore.recall;
      results.pureGemini.latency += geminiRun.latency;
      results.pureGemini.count++;
      if (fixture.difficulty_class === 'multi_event_lineup') results.pureGemini.multiEventRecall = geminiScore.recall; // simplified

      // Hybrid
      const hybridRun = await this.runHybridCascade(fixture);
      const hybridScore = this.scoreExtraction(fixture, hybridRun.result, fixture.uploader_hints);
      results.hybridCascade.precision += hybridScore.precision;
      results.hybridCascade.recall += hybridScore.recall;
      results.hybridCascade.latency += hybridRun.latency;
      results.hybridCascade.count++;
    }

    // Averages
    for (const key of Object.keys(results)) {
      const k = key as keyof typeof results;
      if (results[k].count > 0) {
         results[k].precision /= results[k].count;
         results[k].recall /= results[k].count;
         results[k].latency /= results[k].count;
         results[k].falsePositiveRate = 1 - results[k].precision; // Simplified FPR
      }
    }

    return results;
  }
}

if (require.main === module) {
  const isOffline = !process.argv.includes('--online');
  const runner = new OCRBenchmarkRunner(isOffline);
  runner.run().then((results) => {
    console.log(JSON.stringify(results, null, 2));
    // Write markdown
    const md = `
# OCR Provider Benchmark Results

| Provider | Precision | Recall | Latency (ms) | Cost Estimate |
|---|---|---|---|---|
| Pure Vision | ${(results.pureVision.precision * 100).toFixed(1)}% | ${(results.pureVision.recall * 100).toFixed(1)}% | ${results.pureVision.latency.toFixed(0)} | $${results.pureVision.cost} |
| Pure Gemini | ${(results.pureGemini.precision * 100).toFixed(1)}% | ${(results.pureGemini.recall * 100).toFixed(1)}% | ${results.pureGemini.latency.toFixed(0)} | $${results.pureGemini.cost} |
| Hybrid Cascade | ${(results.hybridCascade.precision * 100).toFixed(1)}% | ${(results.hybridCascade.recall * 100).toFixed(1)}% | ${results.hybridCascade.latency.toFixed(0)} | $${results.hybridCascade.cost} |
`;
    fs.writeFileSync(path.join(__dirname, 'benchmark-results.md'), md);
    fs.writeFileSync(path.join(__dirname, 'benchmark-results.json'), JSON.stringify(results, null, 2));
    console.log('Results written to benchmark-results.json and benchmark-results.md');
  });
}
