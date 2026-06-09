import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventsPage,
} from '../interfaces/google-calendar-event.interface';

@Injectable()
export class IcalCalendarClientService {
  async fetchAllEvents(params: {
    url: string;
    timeMin?: string;
    timeMax?: string;
  }): Promise<GoogleCalendarEventsPage> {
    const response = await fetch(params.url, {
      method: 'GET',
      headers: {
        Accept: 'text/calendar,text/plain,*/*',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new InternalServerErrorException(
        `iCal calendar request failed (${response.status}): ${this.sanitizeError(errorBody)}`,
      );
    }

    const text = await response.text();
    const items = this.parseEvents(text).filter((event) =>
      this.isWithinRange(event, params.timeMin, params.timeMax),
    );

    return {
      items,
      timeZone: this.extractCalendarTimezone(text),
    };
  }

  private parseEvents(text: string): GoogleCalendarEvent[] {
    const lines = this.unfoldLines(text);
    const events: GoogleCalendarEvent[] = [];
    let current: Record<string, string[]> | null = null;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        current = {};
        continue;
      }

      if (line === 'END:VEVENT') {
        if (current) {
          events.push(this.mapEvent(current));
        }
        current = null;
        continue;
      }

      if (!current) continue;

      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) continue;

      const rawKey = line.slice(0, separatorIndex);
      const value = this.unescapeValue(line.slice(separatorIndex + 1));
      const key = rawKey.split(';')[0].toUpperCase();
      current[key] = [...(current[key] ?? []), value];
    }

    return events.filter((event) => Boolean(event.id && event.start));
  }

  private mapEvent(record: Record<string, string[]>): GoogleCalendarEvent {
    const uid = this.first(record.UID);
    const start = this.parseDate(this.first(record.DTSTART));
    const end = this.parseDate(this.first(record.DTEND));

    return {
      id: uid || this.buildFallbackId(record),
      status: this.first(record.STATUS)?.toLowerCase() || 'confirmed',
      summary: this.first(record.SUMMARY),
      description: this.first(record.DESCRIPTION),
      location: this.first(record.LOCATION),
      start,
      end,
      updated: this.parseDate(this.first(record['LAST-MODIFIED']))?.dateTime,
      created: this.parseDate(this.first(record.CREATED))?.dateTime,
      htmlLink: this.first(record.URL),
    };
  }

  private parseDate(value?: string) {
    if (!value) return undefined;
    const trimmed = value.trim();

    if (/^\d{8}$/.test(trimmed)) {
      return {
        date: `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`,
      };
    }

    const match = trimmed.match(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/,
    );
    if (!match) return undefined;

    const [, year, month, day, hour, minute, second, utc] = match;
    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${utc ? 'Z' : ''}`;

    return {
      dateTime: utc ? new Date(iso).toISOString() : iso,
    };
  }

  private isWithinRange(
    event: GoogleCalendarEvent,
    timeMin?: string,
    timeMax?: string,
  ) {
    const startValue = event.start?.dateTime || event.start?.date;
    if (!startValue) return false;

    const startTime = new Date(startValue).getTime();
    if (Number.isNaN(startTime)) return false;
    if (timeMin && startTime < new Date(timeMin).getTime()) return false;
    if (timeMax && startTime > new Date(timeMax).getTime()) return false;

    return true;
  }

  private unfoldLines(text: string) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .reduce<string[]>((lines, line) => {
        if (/^[ \t]/.test(line) && lines.length) {
          lines[lines.length - 1] += line.slice(1);
        } else {
          lines.push(line.trimEnd());
        }
        return lines;
      }, []);
  }

  private extractCalendarTimezone(text: string) {
    return (
      text.match(/^X-WR-TIMEZONE:(.+)$/m)?.[1]?.trim() ||
      text.match(/^TZID:(.+)$/m)?.[1]?.trim()
    );
  }

  private first(values?: string[]) {
    return values?.find((value) => value.trim().length > 0)?.trim();
  }

  private buildFallbackId(record: Record<string, string[]>) {
    return [
      this.first(record.SUMMARY) ?? 'untitled',
      this.first(record.DTSTART) ?? 'unknown-start',
      this.first(record.LOCATION) ?? 'unknown-location',
    ].join('|');
  }

  private unescapeValue(value: string) {
    return value
      .replace(/\\n/gi, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  private sanitizeError(raw: string) {
    return raw.replace(/\s+/g, ' ').slice(0, 500);
  }
}
