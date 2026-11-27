import {
  decryptInstagramToken,
  encryptInstagramToken,
  parseEncryptionKey,
} from './instagram-token-crypto.util';

describe('instagram-token-crypto.util', () => {
  const hexKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const base64Key = Buffer.from(hexKey, 'hex').toString('base64');
  const utf8Key = '12345678901234567890123456789012';
  const sampleToken = 'IGQWRP_super_secret_instagram_token_value_12345';

  it('encrypts and decrypts roundtrip with 64-char hex key', () => {
    const encrypted = encryptInstagramToken(sampleToken, hexKey);
    expect(encrypted).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/);
    expect(encrypted).not.toContain(sampleToken);

    const decrypted = decryptInstagramToken(encrypted, hexKey);
    expect(decrypted).toBe(sampleToken);
  });

  it('encrypts and decrypts roundtrip with 32-byte base64 and UTF-8 keys', () => {
    const encB64 = encryptInstagramToken(sampleToken, base64Key);
    expect(decryptInstagramToken(encB64, base64Key)).toBe(sampleToken);
    expect(decryptInstagramToken(encB64, hexKey)).toBe(sampleToken);

    const encUtf8 = encryptInstagramToken(sampleToken, utf8Key);
    expect(decryptInstagramToken(encUtf8, utf8Key)).toBe(sampleToken);
  });

  it('uses a fresh random IV on every encryption', () => {
    const first = encryptInstagramToken(sampleToken, hexKey);
    const second = encryptInstagramToken(sampleToken, hexKey);
    expect(first).not.toBe(second);
    expect(decryptInstagramToken(first, hexKey)).toBe(sampleToken);
    expect(decryptInstagramToken(second, hexKey)).toBe(sampleToken);
  });

  it('rejects tampered ciphertext, authTag, IV, or wrong key', () => {
    const encrypted = encryptInstagramToken(sampleToken, hexKey);
    const [version, iv, tag, ciphertext] = encrypted.split(':');

    const tamperedCiphertext = Buffer.from(ciphertext, 'base64');
    tamperedCiphertext[0] ^= 0xff;
    expect(() =>
      decryptInstagramToken(
        [version, iv, tag, tamperedCiphertext.toString('base64')].join(':'),
        hexKey,
      ),
    ).toThrow('Failed to decrypt Instagram token.');

    const tamperedTag = Buffer.from(tag, 'base64');
    tamperedTag[0] ^= 0xff;
    expect(() =>
      decryptInstagramToken(
        [version, iv, tamperedTag.toString('base64'), ciphertext].join(':'),
        hexKey,
      ),
    ).toThrow('Failed to decrypt Instagram token.');

    const otherHexKey =
      'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
    expect(() => decryptInstagramToken(encrypted, otherHexKey)).toThrow(
      'Failed to decrypt Instagram token.',
    );
  });

  it('throws sanitized errors for missing or invalid keys without leaking key material', () => {
    const badKey = 'too-short-secret-key';
    expect(() => parseEncryptionKey(undefined)).toThrow(
      'INSTAGRAM_TOKEN_ENCRYPTION_KEY is not configured.',
    );
    expect(() => parseEncryptionKey(badKey)).toThrow(
      'INSTAGRAM_TOKEN_ENCRYPTION_KEY must be a 32-byte key',
    );
    try {
      parseEncryptionKey(badKey);
    } catch (err: any) {
      expect(err.message).not.toContain(badKey);
    }
  });

  it('rejects empty plaintext or malformed encrypted payloads', () => {
    expect(() => encryptInstagramToken('', hexKey)).toThrow(
      'Cannot encrypt an empty Instagram token.',
    );
    expect(() => decryptInstagramToken('invalid-format', hexKey)).toThrow(
      'Failed to decrypt Instagram token: invalid format.',
    );
  });
});
