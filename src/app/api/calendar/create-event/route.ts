import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import { sendBookingEmails } from '@/lib/email';
import { getServiceAccountKeyFile } from '@/lib/service-account';
import { utcToZonedParts } from '@/lib/timezone';

const BOOKING_EVENT_PREFIX = '🔖 ';
const BERLIN_TZ = 'Europe/Berlin';

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

    // Convert client local wall-time to UTC using client offset.
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const localMs = new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
    const utcMs = localMs + (timezoneOffsetMinutes || 0) * 60 * 1000;
    const utcStart = new Date(utcMs);
    const utcEnd = new Date(utcMs + 30 * 60 * 1000);

    // Convert UTC instant to Berlin wall-time for storage policy.
    const berlinStart = utcToZonedParts(utcStart, BERLIN_TZ);
    const berlinEnd = utcToZonedParts(utcEnd, BERLIN_TZ);
    const berlinDateTimeStr = `${berlinStart.year}-${String(berlinStart.month).padStart(2, '0')}-${String(berlinStart.day).padStart(2, '0')}T${String(berlinStart.hour).padStart(2, '0')}:${String(berlinStart.minute).padStart(2, '0')}:${String(berlinStart.second).padStart(2, '0')}`;
    const berlinEndTimeStr = `${berlinEnd.year}-${String(berlinEnd.month).padStart(2, '0')}-${String(berlinEnd.day).padStart(2, '0')}T${String(berlinEnd.hour).padStart(2, '0')}:${String(berlinEnd.minute).padStart(2, '0')}:${String(berlinEnd.second).padStart(2, '0')}`;

    console.log('[Calendar API] Client local time:', `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
    console.log('[Calendar API] Berlin time (calculated):', berlinDateTimeStr);

    // Build event description (without Meet link - it will be in conferenceData)
    let description = `Name: ${name}\nEmail: ${email}`;

    // Base event payload (all times are stored as Berlin time)
    const baseEvent: any = {
      summary: `${BOOKING_EVENT_PREFIX}${name}`,
      description,
      start: {
        dateTime: berlinDateTimeStr,
        timeZone: BERLIN_TZ,
      },
      end: {
        dateTime: berlinEndTimeStr,
        timeZone: BERLIN_TZ,
      },
    };

    const requestId = `meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let response;

    try {
      // Primary attempt: explicit Google Meet type.
      response = await calendar.events.insert({
        calendarId,
        requestBody: {
          ...baseEvent,
          conferenceData: {
            createRequest: {
              requestId,
              conferenceSolutionKey: {
                type: 'hangoutsMeet',
              },
            },
          },
        },
        conferenceDataVersion: 1,
      });
    } catch (conferenceTypeError: any) {
      const message = conferenceTypeError?.message || '';
      const statusCode = conferenceTypeError?.status;

      if (statusCode === 400 && String(message).includes('Invalid conference type value')) {
        console.warn('[Calendar API] Invalid conference type, retrying without explicit conferenceSolutionKey type');

        try {
          // Fallback #1: let Google decide conference type.
          response = await calendar.events.insert({
            calendarId,
            requestBody: {
              ...baseEvent,
              conferenceData: {
                createRequest: {
                  requestId,
                },
              },
            },
            conferenceDataVersion: 1,
          });
        } catch (conferenceUnsupportedError: any) {
          console.warn('[Calendar API] Conference creation failed, creating event without Meet link:', conferenceUnsupportedError?.message);

          // Fallback #2: create event without conference data.
          response = await calendar.events.insert({
            calendarId,
            requestBody: baseEvent,
          });
        }
      } else {
        throw conferenceTypeError;
      }
    }

    console.log('[Calendar API] Event created:', response.data.id);

    // Extract Meet link from conference data if available
    let generatedMeetLink: string | undefined;
    if (response.data.conferenceData?.entryPoints) {
      const meetEntry = response.data.conferenceData.entryPoints.find(
        (ep: any) => ep.entryPointType === 'video'
      );
      if (meetEntry && meetEntry.uri) {
        generatedMeetLink = meetEntry.uri;
        console.log('[Calendar API] Google Meet link generated:', generatedMeetLink);
      }
    }

    // Send confirmation emails via Gmail OAuth2
    try {
      await sendBookingEmails({
        clientEmail: email,
        clientName: name,
        date,
        time,
        meetLink: generatedMeetLink,
      });
    } catch (emailError) {
      console.error('[Email] Failed to send emails:', emailError);
      // Don't fail the booking if email fails
    }

    return NextResponse.json({
      success: true,
      eventId: response.data.id,
      meetLink: generatedMeetLink,
    });
  } catch (error: unknown) {
    console.error('[Calendar API] Create event error:', error);

    const status = typeof error === 'object' && error && 'status' in error ? (error as { status?: number }).status : undefined;
    if (status === 403) {
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
