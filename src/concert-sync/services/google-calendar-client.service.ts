import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventsPage,
} from '../interfaces/google-calendar-event.interface';

interface FetchCalendarEventsParams {
  accessToken: string;
  calendarId: string;
  timeMin?: string;
  timeMax?: string;
}

@Injectable()
export class GoogleCalendarClientService {
  private readonly baseUrl = 'https://www.googleapis.com/calendar/v3';

  async fetchAllEvents(
    params: FetchCalendarEventsParams,
  ): Promise<GoogleCalendarEventsPage> {
    const items: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;
    let timeZone: string | undefined;
    let nextSyncToken: string | undefined;

    do {
      const page = await this.fetchEventsPage({ ...params, pageToken });
      items.push(...page.items);
      pageToken = page.nextPageToken;
      timeZone = page.timeZone ?? timeZone;
      nextSyncToken = page.nextSyncToken ?? nextSyncToken;
    } while (pageToken);

    return { items, timeZone, nextSyncToken };
  }

  private async fetchEventsPage(
    params: FetchCalendarEventsParams & { pageToken?: string },
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
}
