import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleOAuthTokenService {
  private readonly tokenUrl = 'https://oauth2.googleapis.com/token';

  constructor(private readonly configService: ConfigService) {}

  async exchangeRefreshToken(refreshToken: string): Promise<string> {
    const clientId = this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID')?.trim();
    const clientSecret = this.configService
      .get<string>('GOOGLE_OAUTH_CLIENT_SECRET')
      ?.trim();

    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException(
        'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required for autonomous sync.',
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new InternalServerErrorException(
        `Google OAuth token exchange failed (${response.status}): ${text.slice(0, 300)}`,
      );
    }

    const json = (await response.json()) as {
      access_token?: string;
    };

    if (!json.access_token) {
      throw new InternalServerErrorException(
        'Google OAuth token response did not include access_token.',
      );
    }

    return json.access_token;
  }
}
