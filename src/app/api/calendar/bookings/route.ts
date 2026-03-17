import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceAccountKeyFile } from '@/lib/service-account';

// Custom field to identify booking events
const BOOKING_EVENT_PREFIX = '🔖 ';

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
      ?.filter((event: any) => event.summary?.startsWith(BOOKING_EVENT_PREFIX))
      .map((event: any) => {
        if (!event.start?.dateTime) return null;

        // Parse the ISO UTC datetime string
        const eventDate = event.start.dateTime;
        const startTime = new Date(eventDate);
        
        // Convert UTC to UTC components (don't adjust for any timezone)
        const year = startTime.getUTCFullYear();
        const month = String(startTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(startTime.getUTCDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const hours = String(startTime.getUTCHours()).padStart(2, '0');
        const minutes = String(startTime.getUTCMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;
        
        // Send full ISO datetime so client can convert to its own timezone
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
          isoDateTime,
          name,
          email,
          meetLink,
          eventId: event.id
        };
      })
      .filter(Boolean) || [];

    return NextResponse.json({ bookings });
  } catch (error: any) {
    console.error('[Calendar API] Fetch bookings error:', error);
    return NextResponse.json({ bookings: [] });
  }
}
