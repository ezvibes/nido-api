import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'crypto';
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventsPage,
} from '../interfaces/google-calendar-event.interface';

interface FetchCalendarEventsParams {
  accessToken?: string;
  calendarId: string;
  timeMin?: string;
  timeMax?: string;
}

@Injectable()
export class GoogleCalendarClientService {
  private readonly baseUrl = 'https://www.googleapis.com/calendar/v3';
  private readonly tokenUrl = 'https://oauth2.googleapis.com/token';
  private cachedServiceAccountToken?: {
    accessToken: string;
    expiresAt: number;
  };

  constructor(private readonly configService: ConfigService) {}

  hasConfiguredServerCredential() {
    return Boolean(
      this.configService.get<string>('GOOGLE_CALENDAR_ACCESS_TOKEN')?.trim() ||
      this.getServiceAccountCredentials(),
    );
  }

  async fetchAllEvents(
    params: FetchCalendarEventsParams,
  ): Promise<GoogleCalendarEventsPage> {
    const accessToken = await this.resolveAccessToken(params.accessToken);
    const items: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;
    let timeZone: string | undefined;
    let nextSyncToken: string | undefined;

    do {
      const page = await this.fetchEventsPage({
        ...params,
        accessToken,
        pageToken,
      });
      items.push(...page.items);
      pageToken = page.nextPageToken;
      timeZone = page.timeZone ?? timeZone;
      nextSyncToken = page.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    return { items, timeZone, nextSyncToken };
  }

  private async fetchEventsPage(
    params: FetchCalendarEventsParams & {
      accessToken: string;
      pageToken?: string;
    },
  ): Promise<GoogleCalendarEventsPage> {
    const query = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      showDeleted: 'false',
      maxResults: '250',
    });

    if (params.timeMin) query.set('timeMin', params.timeMin);
    if (params.timeMax) query.set('timeMax', params.timeMax);
    if (params.pageToken) query.set('pageToken', params.pageToken);

    const url = `${this.baseUrl}/calendars/${encodeURIComponent(params.calendarId)}/events?${query.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new InternalServerErrorException(
        `Google Calendar API request failed (${response.status}): ${this.sanitizeError(errorBody)}`,
      );
    }

    const json = (await response.json()) as Partial<GoogleCalendarEventsPage>;

    return {
      items: Array.isArray(json.items) ? json.items : [],
      nextPageToken: json.nextPageToken,
      nextSyncToken: json.nextSyncToken,
      timeZone: json.timeZone,
    };
  }

  private sanitizeError(raw: string) {
    return raw.replace(/\s+/g, ' ').slice(0, 500);
  }

  private async resolveAccessToken(requestAccessToken?: string) {
    const explicitToken = requestAccessToken?.trim();
    if (explicitToken) return explicitToken;

    const configuredToken = this.configService
      .get<string>('GOOGLE_CALENDAR_ACCESS_TOKEN')
      ?.trim();
    if (configuredToken) return configuredToken;

    return this.getServiceAccountAccessToken();
  }

  private async getServiceAccountAccessToken() {
    const now = Date.now();
    if (
      this.cachedServiceAccountToken &&
      this.cachedServiceAccountToken.expiresAt - now > 60_000
    ) {
      return this.cachedServiceAccountToken.accessToken;
    }

    const credentials = this.getServiceAccountCredentials();
    if (!credentials) {
      throw new InternalServerErrorException(
        'Google Calendar access is not configured. Set GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON or GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL and GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY.',
      );
    }

    const assertion = this.createServiceAccountAssertion(credentials);
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new InternalServerErrorException(
        `Google service account token request failed (${response.status}): ${this.sanitizeError(errorBody)}`,
      );
    }

    const tokenResponse = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!tokenResponse.access_token) {
      throw new InternalServerErrorException(
        'Google service account token response did not include an access token.',
      );
    }

    this.cachedServiceAccountToken = {
      accessToken: tokenResponse.access_token,
      expiresAt: now + (tokenResponse.expires_in ?? 3600) * 1000,
    };

    return tokenResponse.access_token;
  }

  private createServiceAccountAssertion(credentials: {
    clientEmail: string;
    privateKey: string;
  }) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = this.base64UrlEncode(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
    );
    const payload = this.base64UrlEncode(
      JSON.stringify({
        iss: credentials.clientEmail,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        aud: this.tokenUrl,
        exp: nowSeconds + 3600,
        iat: nowSeconds,
      }),
    );
    const unsignedToken = `${header}.${payload}`;
    const signature = createSign('RSA-SHA256')
      .update(unsignedToken)
      .sign(credentials.privateKey);

    return `${unsignedToken}.${this.base64UrlEncode(signature)}`;
  }

  private getServiceAccountCredentials() {
    const json = this.configService
      .get<string>('GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON')
      ?.trim();
    if (json) {
      try {
        const parsed = JSON.parse(json) as {
          client_email?: string;
          private_key?: string;
        };
        if (parsed.client_email && parsed.private_key) {
          return {
            clientEmail: parsed.client_email,
            privateKey: this.normalizePrivateKey(parsed.private_key),
          };
        }
      } catch {
        return null;
      }
    }

    const clientEmail = this.configService
      .get<string>('GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL')
      ?.trim();
    const privateKey = this.configService
      .get<string>('GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY')
      ?.trim();

    if (!clientEmail || !privateKey) {
      return null;
    }

    return {
      clientEmail,
      privateKey: this.normalizePrivateKey(privateKey),
    };
  }

  private normalizePrivateKey(privateKey: string) {
    return privateKey.replace(/\\n/g, '\n');
  }

  private base64UrlEncode(value: string | Buffer) {
    return Buffer.from(value)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}
