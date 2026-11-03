import { sniffImageMimeType, validateImageBuffer } from './image-mime.util';

describe('image-mime.util', () => {
  it('detects JPEG images correctly', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(sniffImageMimeType(jpegBuffer)).toBe('image/jpeg');
    expect(validateImageBuffer(jpegBuffer)).toEqual({
      isValid: true,
      mimeType: 'image/jpeg',
    });
  });

  it('detects PNG images correctly', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(sniffImageMimeType(pngBuffer)).toBe('image/png');
    expect(validateImageBuffer(pngBuffer)).toEqual({
      isValid: true,
      mimeType: 'image/png',
    });
  });

  it('detects GIF images correctly', () => {
    const gifBuffer = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00', 'binary');
    expect(sniffImageMimeType(gifBuffer)).toBe('image/gif');
    expect(validateImageBuffer(gifBuffer)).toEqual({
      isValid: true,
      mimeType: 'image/gif',
    });
  });

  it('detects WEBP images correctly', () => {
    const webpBuffer = Buffer.from('RIFF\x20\x00\x00\x00WEBPVP8 ', 'binary');
    expect(sniffImageMimeType(webpBuffer)).toBe('image/webp');
    expect(validateImageBuffer(webpBuffer)).toEqual({
      isValid: true,
      mimeType: 'image/webp',
    });
  });

  it('detects AVIF images correctly', () => {
    const avifBuffer = Buffer.from('\x00\x00\x00\x1cftypavif\x00\x00\x00\x00', 'binary');
    expect(sniffImageMimeType(avifBuffer)).toBe('image/avif');
    expect(validateImageBuffer(avifBuffer)).toEqual({
      isValid: true,
      mimeType: 'image/avif',
    });
  });

  it('returns null / invalid for non-image, tiny, or corrupted buffers', () => {
    expect(sniffImageMimeType(undefined)).toBeNull();
    expect(sniffImageMimeType(Buffer.from([]))).toBeNull();
    expect(sniffImageMimeType(Buffer.from('not an image at all'))).toBeNull();
    expect(validateImageBuffer(Buffer.from('hello world'))).toEqual({
      isValid: false,
      mimeType: null,
    });
  });
});
