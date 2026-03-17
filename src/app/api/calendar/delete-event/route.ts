import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceAccountKeyFile } from '@/lib/service-account';

const BOOKING_EVENT_PREFIX = '🔖 ';

export async function POST(request: NextRequest) {
  try {
    const { date, time, adminToken, timezoneOffsetMinutes } = await request.json();

    if (!date || !time) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Parse date and time (client local time)
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    
    // Convert client local time to UTC
    const clientDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const clientTzOffsetMs = (timezoneOffsetMinutes || 0) * 60 * 1000;
    const utcMs = clientDate.getTime() + clientTzOffsetMs;
    const utcDate = new Date(utcMs);

    // Convert UTC to Europe/Berlin timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(utcDate);
    const berlinTime = Object.fromEntries(parts.map(p => [p.type, p.value]));
    
    const now = new Date();
    // Check if event is in the past by comparing with current Berlin time
    const eventBerlinDate = new Date(`${berlinTime.year}-${berlinTime.month}-${berlinTime.day}T${berlinTime.hour}:${berlinTime.minute}:00`);
    const isPastEvent = eventBerlinDate < now;

    console.log('[Calendar API] Delete request - Client time:', `${hours}:${minutes.toString().padStart(2, '0')}`, 'Berlin:', `${berlinTime.hour}:${berlinTime.minute}`);

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

    // Search for events on the Berlin date (wider window to account for timezone differences)
    const berlinDayStart = new Date(`${berlinTime.year}-${berlinTime.month}-${berlinTime.day}T00:00:00Z`);
    const berlinDayEnd = new Date(`${berlinTime.year}-${berlinTime.month}-${berlinTime.day}T23:59:59Z`);

    // List events on this Berlin day
    const response = await calendar.events.list({
      calendarId,
      timeMin: berlinDayStart.toISOString(),
      timeMax: berlinDayEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    // Find and delete the booking event matching the Berlin time
    const bookingEvents = response.data.items?.filter((event: any) => {
      if (!event.summary?.startsWith(BOOKING_EVENT_PREFIX)) return false;
      if (!event.start?.dateTime) return false;
      
      // Convert event time to Berlin timezone to compare
      const eventTime = new Date(event.start.dateTime);
      const eventFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      
      const eventParts = eventFormatter.formatToParts(eventTime);
      const eventBerlin = Object.fromEntries(eventParts.map(p => [p.type, p.value]));
      
      // Match by Berlin date and time
      return (
        eventBerlin.year === berlinTime.year &&
        eventBerlin.month === berlinTime.month &&
        eventBerlin.day === berlinTime.day &&
        eventBerlin.hour === berlinTime.hour &&
        eventBerlin.minute === berlinTime.minute
      );
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
  } catch (error: any) {
    console.error('[Calendar API] Delete event error:', error);
    
    if (error.status === 403) {
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
