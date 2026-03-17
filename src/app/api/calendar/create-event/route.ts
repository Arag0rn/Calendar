import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { sendBookingEmails } from '@/lib/email';
import { getServiceAccountKeyFile } from '@/lib/service-account';

const BOOKING_EVENT_PREFIX = '🔖 ';

export async function POST(request: NextRequest) {
  try {
    const { date, time, name, email, meetLink } = await request.json();

    if (!date || !time || !name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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

    // Parse date and time
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);

    // Use Ukraine timezone (Europe/Kyiv)
    const timeZone = 'Europe/Kyiv';
    
    // Create a date object in UTC that represents the local time in Kyiv
    // First, create the date/time as if it's in UTC
    const localDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    
    // Get what time this would be in Kyiv timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Kyiv',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(localDate);
    const partsObj = Object.fromEntries(parts.map(p => [p.type, p.value]));
    
    // Calculate the offset between UTC and Kyiv
    const kyivHours = parseInt(partsObj.hour);
    const kyivMinutes = parseInt(partsObj.minute);
    const kyivDate = parseInt(partsObj.day);
    
    const offset = (kyivHours - hours) * 60 + (kyivMinutes - minutes);
    const offsetMs = offset * 60 * 1000;
    
    // Adjust the UTC date by the offset
    const startTime = new Date(localDate.getTime() - offsetMs);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes

    // Build event description
    let description = `Name: ${name}\nEmail: ${email}`;
    if (meetLink) {
      description += `\nMeet: ${meetLink}`;
    }

    // Create event with proper timezone
    const event = {
      summary: `${BOOKING_EVENT_PREFIX}${name}`,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: timeZone,
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
