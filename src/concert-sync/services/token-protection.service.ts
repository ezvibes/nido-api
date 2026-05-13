import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class TokenProtectionService {
  private readonly algorithm = 'aes-256-gcm';

  constructor(private readonly configService: ConfigService) {}

  encrypt(plainText: string): string {
    const key = this.loadKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  decrypt(value: string): string {
    const key = this.loadKey();
    const [ivPart, tagPart, dataPart] = value.split('.');
    if (!ivPart || !tagPart || !dataPart) {
      throw new InternalServerErrorException('Encrypted token payload is invalid.');
    }

    const iv = Buffer.from(ivPart, 'base64');
    const tag = Buffer.from(tagPart, 'base64');
    const encrypted = Buffer.from(dataPart, 'base64');

    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  private loadKey() {
    const raw =
      this.configService.get<string>('CONCERT_SYNC_TOKEN_ENCRYPTION_KEY')?.trim() ||
      this.configService.get<string>('APP_ENCRYPTION_KEY')?.trim();

    if (!raw) {
      throw new InternalServerErrorException(
        'Missing CONCERT_SYNC_TOKEN_ENCRYPTION_KEY (base64 32-byte key).',
      );
    }

    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new InternalServerErrorException(
        'CONCERT_SYNC_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.',
      );
    }

    return key;
  }
}
