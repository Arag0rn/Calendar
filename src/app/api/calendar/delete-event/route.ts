import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceAccountKeyFile } from '@/lib/service-account';
import { partsToDateKey, partsToTimeKey, utcToZonedParts, zonedDateTimeToUtc } from '@/lib/timezone';

const BOOKING_EVENT_PREFIX = '🔖 ';
const BERLIN_TZ = 'Europe/Berlin';
type CalendarEventLike = {
  summary?: string | null;
  id?: string | null;
  start?: { dateTime?: string | null };
};

export async function POST(request: NextRequest) {
  try {
    const { date, time, adminToken, timezoneOffsetMinutes } = await request.json();

    if (!date || !time) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Convert selected client-local wall-time to UTC instant, then to Berlin wall-time key.
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const localMs = new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
    const utcMs = localMs + (timezoneOffsetMinutes || 0) * 60 * 1000;
    const selectedUtc = new Date(utcMs);
    const berlin = utcToZonedParts(selectedUtc, BERLIN_TZ);
    const berlinDate = partsToDateKey(berlin);
    const berlinTime = partsToTimeKey(berlin);
    const isPastEvent = selectedUtc.getTime() < Date.now();

    console.log('[Calendar API] Delete request - Client time:', `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, 'Berlin:', berlinTime);

    // Verify admin token (not required for past events - they are cleaned up automatically)
    if (!isPastEvent) {
      const expectedToken = process.env.ADMIN_DELETE_TOKEN;
      if (!expectedToken || adminToken !== expectedToken) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid admin token' },
          { status: 403 }
        );
      }
    }

    // Get service account key
    const keyFile = getServiceAccountKeyFile();

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    // Build an exact UTC window for the selected Berlin date to avoid misses around midnight/DST.
    const berlinDayStartUtc = zonedDateTimeToUtc(berlinDate, '00:00', BERLIN_TZ);
    const berlinDayEndUtc = zonedDateTimeToUtc(berlinDate, '23:59', BERLIN_TZ);

    // List events on this Berlin day
    const response = await calendar.events.list({
      calendarId,
      timeMin: berlinDayStartUtc.toISOString(),
      timeMax: berlinDayEndUtc.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    // Find and delete the booking event matching the Berlin time
    const bookingEvents = response.data.items?.filter((rawEvent) => {
      const event = rawEvent as CalendarEventLike;
      if (!event.summary?.startsWith(BOOKING_EVENT_PREFIX)) return false;
      if (!event.start?.dateTime) return false;

      const eventBerlin = utcToZonedParts(new Date(event.start.dateTime), BERLIN_TZ);
      return partsToDateKey(eventBerlin) === berlinDate && partsToTimeKey(eventBerlin) === berlinTime;
    }) || [];

    for (const event of bookingEvents) {
      if (event.id) {
        await calendar.events.delete({
          calendarId,
          eventId: event.id,
        });
        console.log('[Calendar API] Event deleted:', event.id, isPastEvent ? '(past event cleanup)' : '(admin deletion)');
      }
    }

    return NextResponse.json({ success: true, isPastEvent });
  } catch (error: unknown) {
    console.error('[Calendar API] Delete event error:', error);

    const status = typeof error === 'object' && error && 'status' in error ? (error as { status?: number }).status : undefined;
    if (status === 403) {
      return NextResponse.json(
        { error: 'Permission denied.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete event from Google Calendar' },
      { status: 500 }
    );
  }
}
