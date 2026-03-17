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

    // Convert client's local time to UTC
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
    
    // Build Berlin datetime string (YYYY-MM-DDTHH:MM:SS)
    const berlinDateTimeStr = `${berlinTime.year}-${berlinTime.month}-${berlinTime.day}T${berlinTime.hour}:${berlinTime.minute}:${berlinTime.second}`;
    const berlinEndTimeStr = (() => {
      // Add 30 minutes to Berlin time
      let min = parseInt(berlinTime.minute) + 30;
      let hr = parseInt(berlinTime.hour);
      if (min >= 60) {
        min -= 60;
        hr += 1;
      }
      return `${berlinTime.year}-${berlinTime.month}-${berlinTime.day}T${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:${berlinTime.second}`;
    })();

    console.log('[Calendar API] Client local time:', `${hours}:${minutes.toString().padStart(2, '0')}`);
    console.log('[Calendar API] Berlin time (calculated):', berlinDateTimeStr);

    // Build event description
    let description = `Name: ${name}\nEmail: ${email}`;
    if (meetLink) {
      description += `\nMeet: ${meetLink}`;
    }

    // Create event - save in Europe/Berlin timezone
    // All times are stored as Berlin time
    const event = {
      summary: `${BOOKING_EVENT_PREFIX}${name}`,
      description,
      start: {
        dateTime: berlinDateTimeStr,
        timeZone: 'Europe/Berlin',
      },
      end: {
        dateTime: berlinEndTimeStr,
        timeZone: 'Europe/Berlin',
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
