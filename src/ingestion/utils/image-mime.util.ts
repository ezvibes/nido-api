/**
 * Utility for magic-byte image inspection, MIME normalization, and validation.
 * Protects downstream AI extraction from corrupted or non-image buffers.
 */

export type SupportedImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'
  | 'image/gif';

export const SUPPORTED_IMAGE_MIME_TYPES: readonly SupportedImageMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;

export interface ImageValidationResult {
  isValid: boolean;
  detectedMimeType: SupportedImageMimeType | null;
  normalizedMimeType: SupportedImageMimeType | null;
  error?: string;
}

/**
 * Sniffs the magic bytes from a buffer header to determine true image format.
 */
export function sniffImageMimeType(buffer: Buffer): SupportedImageMimeType | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
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

  // GIF: GIF87a or GIF89a (47 49 46 38 37 61 or 47 49 46 38 39 61)
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

  // WEBP: "RIFF" .... "WEBP"
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

  // AVIF: bytes 4-7 are 'ftyp', followed by compatible brand avif/avis/mif1
  if (
    buffer[4] === 0x66 && // 'f'
    buffer[5] === 0x74 && // 't'
    buffer[6] === 0x79 && // 'y'
    buffer[7] === 0x70    // 'p'
  ) {
    const brandStr = buffer.slice(8, Math.min(buffer.length, 32)).toString('ascii');
    if (
      brandStr.includes('avif') ||
      brandStr.includes('avis') ||
      brandStr.includes('mif1')
    ) {
      return 'image/avif';
    }
  }

  return null;
}

/**
 * Validates an image buffer and normalizes the provided or detected MIME type.
 */
export function validateImageBuffer(
  buffer?: Buffer | null,
  claimedMimeType?: string,
): ImageValidationResult {
  if (!buffer || buffer.length === 0) {
    return {
      isValid: false,
      detectedMimeType: null,
      normalizedMimeType: null,
      error: 'Empty or missing image buffer',
    };
  }

  if (buffer.length < 12) {
    return {
      isValid: false,
      detectedMimeType: null,
      normalizedMimeType: null,
      error: `Buffer too small (${buffer.length} bytes) to be a valid image`,
    };
  }

  const detected = sniffImageMimeType(buffer);

  // Normalize common variations in claimed MIME type
  const normalizedClaimed = claimedMimeType?.toLowerCase().trim();
  const isJpgClaimed =
    normalizedClaimed === 'image/jpeg' || normalizedClaimed === 'image/jpg';

  if (detected) {
    return {
      isValid: true,
      detectedMimeType: detected,
      normalizedMimeType: detected,
    };
  }

  // Fallback: if magic-byte sniffer didn't match (e.g. exotic container), check if claimed is supported
  if (isJpgClaimed) {
    return {
      isValid: true,
      detectedMimeType: 'image/jpeg',
      normalizedMimeType: 'image/jpeg',
    };
  }

  if (
    normalizedClaimed &&
    SUPPORTED_IMAGE_MIME_TYPES.includes(normalizedClaimed as SupportedImageMimeType)
  ) {
    return {
      isValid: true,
      detectedMimeType: normalizedClaimed as SupportedImageMimeType,
      normalizedMimeType: normalizedClaimed as SupportedImageMimeType,
    };
  }

  return {
    isValid: false,
    detectedMimeType: null,
    normalizedMimeType: null,
    error: `Unsupported image format${
      claimedMimeType ? ` (claimed: ${claimedMimeType})` : ''
    }. Supported formats: JPG, PNG, WEBP, AVIF, GIF.`,
  };
}
