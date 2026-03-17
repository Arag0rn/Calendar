import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceAccountKeyFile } from '@/lib/service-account';
import { partsToDateKey, partsToTimeKey, utcToZonedParts } from '@/lib/timezone';

// Custom field to identify booking events
const BOOKING_EVENT_PREFIX = '🔖 ';
const BERLIN_TZ = 'Europe/Berlin';
type CalendarEventLike = {
  summary?: string | null;
  description?: string | null;
  id?: string | null;
  start?: { dateTime?: string | null };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth()));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // Get service account key
    const keyFile = getServiceAccountKeyFile();

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    // Get events for the month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 1);

    const response = await calendar.events.list({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    // Filter only booking events (those with BOOKING_EVENT_PREFIX)
    const bookings = response.data.items
      ?.filter((event) => (event as CalendarEventLike).summary?.startsWith(BOOKING_EVENT_PREFIX))
      .map((rawEvent) => {
        const event = rawEvent as CalendarEventLike;
        if (!event.start?.dateTime) return null;

        const startTime = new Date(event.start.dateTime);
        const berlin = utcToZonedParts(startTime, BERLIN_TZ);
        const dateStr = partsToDateKey(berlin);
        const timeStr = partsToTimeKey(berlin);
        const berlinDateTimeStr = `${dateStr}T${String(berlin.hour).padStart(2, '0')}:${String(berlin.minute).padStart(2, '0')}:${String(berlin.second).padStart(2, '0')}`;
        const isoDateTime = startTime.toISOString();
        
        // Parse attendee info from event description
        const description = event.description || '';
        const lines = description.split('\n');
        let name = 'Unknown';
        let email = 'unknown@example.com';
        let meetLink = undefined;

        for (const line of lines) {
          if (line.startsWith('Name: ')) name = line.replace('Name: ', '').trim();
          if (line.startsWith('Email: ')) email = line.replace('Email: ', '').trim();
          if (line.startsWith('Meet: ')) meetLink = line.replace('Meet: ', '').trim();
        }

        return {
          date: dateStr,
          time: timeStr,
          berlinDateTime: berlinDateTimeStr,
          isoDateTime,
          name,
          email,
          meetLink,
          eventId: event.id
        };
      })
      .filter(Boolean) || [];

    return NextResponse.json({ bookings });
  } catch (error: unknown) {
    console.error('[Calendar API] Fetch bookings error:', error);
    return NextResponse.json({ bookings: [] });
  }
}
