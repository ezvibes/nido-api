/**
 * Magic-byte signature sniffing utility for image buffer pre-validation.
 * Detects JPEG, PNG, WEBP, AVIF, and GIF formats.
 */

export type SupportedImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'
  | 'image/gif';

export function sniffImageMimeType(
  buffer?: Buffer | Uint8Array | null,
): SupportedImageMimeType | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // 3. GIF: 'GIF87a' or 'GIF89a'
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif';
  }

  // 4. WEBP: 'RIFF'....'WEBP'
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // 5. AVIF: '....ftypavif' or '....ftypavis'
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70 &&
    buffer[8] === 0x61 &&
    buffer[9] === 0x76 &&
    buffer[10] === 0x69 &&
    (buffer[11] === 0x66 || buffer[11] === 0x73)
  ) {
    return 'image/avif';
  }

  return null;
}

export function validateImageBuffer(
  buffer?: Buffer | Uint8Array | null,
): { isValid: boolean; mimeType: SupportedImageMimeType | null } {
  const mimeType = sniffImageMimeType(buffer);
  return {
    isValid: mimeType !== null,
    mimeType,
  };
}
