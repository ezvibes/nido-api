import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;
const PAYLOAD_VERSION = 'v1';

/**
 * Parses INSTAGRAM_TOKEN_ENCRYPTION_KEY into a 32-byte Buffer.
 * Supports 64-char hex, base64 (decoding to 32 bytes), or a raw 32-byte UTF-8 string.
 * Never includes key material in thrown error messages.
 */
export function parseEncryptionKey(rawKey: string | undefined): Buffer {
  const trimmed = rawKey?.trim();
  if (!trimmed) {
    throw new Error('INSTAGRAM_TOKEN_ENCRYPTION_KEY is not configured.');
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  const base64Buf = Buffer.from(trimmed, 'base64');
  if (
    base64Buf.length === KEY_LENGTH_BYTES &&
    base64Buf.toString('base64').replace(/=+$/, '') ===
      trimmed.replace(/=+$/, '')
  ) {
    return base64Buf;
  }

  const utf8Buf = Buffer.from(trimmed, 'utf8');
  if (utf8Buf.length === KEY_LENGTH_BYTES) {
    return utf8Buf;
  }

  throw new Error(
    'INSTAGRAM_TOKEN_ENCRYPTION_KEY must be a 32-byte key (64 hex chars, 32-byte base64, or 32-byte UTF-8 string).',
  );
}

/**
 * Encrypts a plaintext Instagram access token with AES-256-GCM.
 */
export function encryptInstagramToken(
  plaintext: string,
  rawKey: string | undefined,
): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Cannot encrypt an empty Instagram token.');
  }

  const key = parseEncryptionKey(rawKey);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    PAYLOAD_VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypts an AES-256-GCM encrypted Instagram access token payload.
 * Throws a sanitized error if the payload is tampered with or the key is invalid.
 */
export function decryptInstagramToken(
  payload: string,
  rawKey: string | undefined,
): string {
  if (!payload || typeof payload !== 'string') {
    throw new Error('Encrypted Instagram token payload is missing.');
  }

  const key = parseEncryptionKey(rawKey);
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== PAYLOAD_VERSION) {
    throw new Error('Failed to decrypt Instagram token: invalid format.');
  }

  const [, ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  if (
    iv.length !== IV_LENGTH_BYTES ||
    authTag.length !== AUTH_TAG_LENGTH_BYTES ||
    ciphertext.length === 0
  ) {
    throw new Error('Failed to decrypt Instagram token: malformed payload.');
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('Failed to decrypt Instagram token.');
  }
}
