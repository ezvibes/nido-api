import {
  sniffImageMimeType,
  validateImageBuffer,
} from './image-mime.util';

describe('image-mime.util', () => {
  it('detects JPEG headers', () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(sniffImageMimeType(jpegHeader)).toBe('image/jpeg');
  });

  it('detects PNG headers', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(sniffImageMimeType(pngHeader)).toBe('image/png');
  });

  it('detects GIF headers', () => {
    const gifHeader = Buffer.from('GIF89a\x00\x00\x00\x00\x00\x00');
    expect(sniffImageMimeType(gifHeader)).toBe('image/gif');
  });

  it('detects WEBP headers', () => {
    const webpHeader = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('WEBPVP8 '),
    ]);
    expect(sniffImageMimeType(webpHeader)).toBe('image/webp');
  });

  it('detects AVIF headers', () => {
    const avifHeader = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x1c]),
      Buffer.from('ftypavif'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('mif1avif'),
    ]);
    expect(sniffImageMimeType(avifHeader)).toBe('image/avif');
  });

  it('returns null for unknown / tiny buffers', () => {
    expect(sniffImageMimeType(Buffer.from('hello'))).toBeNull();
    expect(sniffImageMimeType(Buffer.alloc(0))).toBeNull();
  });

  it('validates and normalizes valid images', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const res = validateImageBuffer(png, 'application/octet-stream');
    expect(res.isValid).toBe(true);
    expect(res.normalizedMimeType).toBe('image/png');
  });

  it('rejects invalid or empty buffers with clear error', () => {
    const res = validateImageBuffer(Buffer.from('not-an-image-content-here'));
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Unsupported image format');
  });
});
