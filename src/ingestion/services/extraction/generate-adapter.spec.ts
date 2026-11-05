import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('generate-adapter script', () => {
  const scriptPath = path.resolve(
    __dirname,
    '../../../../scripts/generate-adapter.mjs',
  );
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nido-adapter-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('fails when --name argument is missing', () => {
    expect(() => {
      execSync(`node "${scriptPath}" --type=extraction`, {
        stdio: 'pipe',
      });
    }).toThrow();
  });

  it('fails when an unsupported --type is provided', () => {
    expect(() => {
      execSync(`node "${scriptPath}" --type=invalid --name=claude`, {
        stdio: 'pipe',
      });
    }).toThrow();
  });

  it('generates adapter and spec files for a given provider', () => {
    const output = execSync(
      `node "${scriptPath}" --type=extraction --name=anthropic-claude --outputDir="${tempDir}"`,
      { encoding: 'utf8' },
    );

    expect(output).toContain('Successfully generated adapter');

    const adapterFile = path.join(
      tempDir,
      'anthropic-claude-extraction.adapter.ts',
    );
    const specFile = path.join(
      tempDir,
      'anthropic-claude-extraction.adapter.spec.ts',
    );

    expect(fs.existsSync(adapterFile)).toBe(true);
    expect(fs.existsSync(specFile)).toBe(true);

    const adapterContent = fs.readFileSync(adapterFile, 'utf8');
    expect(adapterContent).toContain(
      'export class AnthropicClaudeExtractionAdapter implements IExtractionAdapter',
    );
    expect(adapterContent).toContain('getModelName(): string');
    expect(adapterContent).toContain('CANONICAL_GENRES');
    expect(adapterContent).toContain('private mockExtract');
    expect(adapterContent).toContain('ANTHROPIC_CLAUDE_EXTRACTION_MODEL');

    const specContent = fs.readFileSync(specFile, 'utf8');
    expect(specContent).toContain(
      "describe('AnthropicClaudeExtractionAdapter'",
    );
    expect(specContent).toContain('should extract a single event fixture');
  });

  it('guards against accidental overwrite unless --force is specified', () => {
    // First generation
    execSync(
      `node "${scriptPath}" --type=extraction --name=mistral --outputDir="${tempDir}"`,
      { encoding: 'utf8' },
    );

    const adapterFile = path.join(tempDir, 'mistral-extraction.adapter.ts');
    fs.writeFileSync(adapterFile, '// custom user edits', 'utf8');

    // Second run without --force should fail
    expect(() => {
      execSync(
        `node "${scriptPath}" --type=extraction --name=mistral --outputDir="${tempDir}"`,
        { stdio: 'pipe' },
      );
    }).toThrow();

    expect(fs.readFileSync(adapterFile, 'utf8')).toBe('// custom user edits');

    // Run with --force should succeed and overwrite
    execSync(
      `node "${scriptPath}" --type=extraction --name=mistral --outputDir="${tempDir}" --force`,
      { encoding: 'utf8' },
    );

    expect(fs.readFileSync(adapterFile, 'utf8')).toContain(
      'MistralExtractionAdapter',
    );
  });
});
