export interface GoogleCalendarEventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleCalendarEventDateTime;
  end?: GoogleCalendarEventDateTime;
  updated?: string;
  created?: string;
  attendees?: Array<{ email?: string; responseStatus?: string }>;
  organizer?: { email?: string; displayName?: string };
  htmlLink?: string;
}

export interface GoogleCalendarEventsPage {
  nextPageToken?: string;
  nextSyncToken?: string;
  timeZone?: string;
  items: GoogleCalendarEvent[];
}
