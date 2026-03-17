import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceAccountKeyFile } from '@/lib/service-account';

const BOOKING_EVENT_PREFIX = '🔖 ';

export async function POST(request: NextRequest) {
  try {
    const { date, time, adminToken } = await request.json();

    if (!date || !time) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Parse date and time to check if event is in the past
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const eventTime = new Date(year, month - 1, day, hours, minutes);
    const now = new Date();
    const isPastEvent = eventTime < now;

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

    const startTime = eventTime;
    const endTime = new Date(year, month - 1, day, hours + 1, minutes); // Search 1 hour window

    // List events at this time
    const response = await calendar.events.list({
      calendarId,
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    // Find and delete the booking event at this time
    const bookingEvents = response.data.items?.filter((event: any) =>
      event.summary?.startsWith(BOOKING_EVENT_PREFIX) &&
      new Date(event.start?.dateTime || '').getTime() === startTime.getTime()
    ) || [];

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
