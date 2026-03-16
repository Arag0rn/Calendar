import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceAccountKeyFile } from '@/lib/service-account';

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
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    console.log('[Calendar API] Query Calendar ID:', calendarId);

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

    // Extract busy times
    const busySlots = response.data.items?.map((event: any) => {
      if (!event.start?.dateTime) return null;

      const startTime = new Date(event.start.dateTime);
      
      // Format date as YYYY-MM-DD (local date)
      const year = startTime.getFullYear();
      const month = String(startTime.getMonth() + 1).padStart(2, '0');
      const day = String(startTime.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Format time as HH:MM
      const hours = String(startTime.getHours()).padStart(2, '0');
      const minutes = String(startTime.getMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      return { date: dateStr, time: timeStr };
    }).filter(Boolean) || [];

    return NextResponse.json({ busySlots });
  } catch (error: any) {
    console.error('[Calendar API] Full Error:', error);
    
    // Check for specific error types
    if (error.status === 404) {
      return NextResponse.json(
        { 
          error: 'Calendar not found. Did you share the calendar with the Service Account?',
          details: {
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            hint: 'Go to Google Calendar Settings → Share with specific people → Add the Service Account email'
          }
        },
        { status: 404 }
      );
    }
    
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json(
        { 
          error: 'Permission denied. Service Account may not have access to calendar.',
          details: {
            serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            hint: 'Share calendar with Service Account and give "See all event details" permission'
          }
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch calendar events', details: error.message },
      { status: 500 }
    );
  }
}
