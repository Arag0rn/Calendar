import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { sendBookingEmails } from '@/lib/email';
import { getServiceAccountKeyFile } from '@/lib/service-account';

const BOOKING_EVENT_PREFIX = '🔖 ';

export async function POST(request: NextRequest) {
  try {
    const { date, time, name, email, meetLink, timezoneOffsetMinutes } = await request.json();

    if (!date || !time || !name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[Calendar API] Creating event with timezone offset:', timezoneOffsetMinutes, 'minutes');

    // Get service account key
    const keyFile = getServiceAccountKeyFile();

    // Create auth client
    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    // Parse date and time from client
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);

    // Client's local time as a number (minutes since midnight)
    const clientLocalMinutes = hours * 60 + minutes;
    
    // Client's timezone offset from UTC (negative for UTC+X, positive for UTC-X)
    // Example: UTC+2 (Ukraine) = -120 minutes
    // Example: UTC+1 (Germany) = -60 minutes
    const clientTzOffsetMs = (timezoneOffsetMinutes || 0) * 60 * 1000;
    
    // Create a reference date in the client's local timezone
    const clientDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
    
    // Convert to UTC by subtracting the timezone offset
    // If client is at UTC+2 with localTime 14:30, then UTC is 14:30 - 2:00 = 12:30
    const utcMs = clientDate.getTime() + clientTzOffsetMs;
    const startTime = new Date(utcMs);
    const endTime = new Date(utcMs + 30 * 60 * 1000); // 30 minutes

    console.log('[Calendar API] Client local time:', `${hours}:${minutes.toString().padStart(2, '0')}`);
    console.log('[Calendar API] UTC time (calculated):', startTime.toISOString());

    // Build event description
    let description = `Name: ${name}\nEmail: ${email}`;
    if (meetLink) {
      description += `\nMeet: ${meetLink}`;
    }

    // Create event with Europe/Kyiv timezone
    // Google Calendar will display this event in the calendar's timezone
    const event = {
      summary: `${BOOKING_EVENT_PREFIX}${name}`,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Europe/Kyiv',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Europe/Kyiv',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: timeZone,
      }
    };

    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    console.log('[Calendar API] Event created:', response.data.id);

    // Send confirmation emails via Gmail OAuth2
    try {
      await sendBookingEmails({
        clientEmail: email,
        clientName: name,
        date,
        time,
        meetLink,
      });
    } catch (emailError) {
      console.error('[Email] Failed to send emails:', emailError);
      // Don't fail the booking if email fails
    }

    return NextResponse.json({
      success: true,
      eventId: response.data.id
    });
  } catch (error: any) {
    console.error('[Calendar API] Create event error:', error);
    
    if (error.status === 403) {
      return NextResponse.json(
        { error: 'Permission denied. Calendar not shared with Service Account.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create event in Google Calendar' },
      { status: 500 }
    );
  }
}
