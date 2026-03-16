import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { sendBookingEmails } from '@/lib/email';

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

    // Read service account key
    const keyPath = path.join(process.cwd(), 'google-service-account.json');
    if (!fs.existsSync(keyPath)) {
      return NextResponse.json(
        { error: 'Service account file not found' },
        { status: 500 }
      );
    }

    const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));

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

    const startTime = new Date(year, month - 1, day, hours, minutes);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes

    // Build event description
    let description = `Name: ${name}\nEmail: ${email}`;
    if (meetLink) {
      description += `\nMeet: ${meetLink}`;
    }

    // Create event
    const event = {
      summary: `${BOOKING_EVENT_PREFIX}${name}`,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'UTC',
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
