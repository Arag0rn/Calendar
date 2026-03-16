import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Custom field to identify booking events
const BOOKING_EVENT_PREFIX = '🔖 ';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth()));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // Read service account key
    const keyPath = path.join(process.cwd(), 'google-service-account.json');
    if (!fs.existsSync(keyPath)) {
      return NextResponse.json({ bookings: [] });
    }

    const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));

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

        const startTime = new Date(event.start.dateTime);
        const year = startTime.getFullYear();
        const month = String(startTime.getMonth() + 1).padStart(2, '0');
        const day = String(startTime.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const hours = String(startTime.getHours()).padStart(2, '0');
        const minutes = String(startTime.getMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;

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
