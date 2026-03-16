import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

let gmail: any = null;
let oauth2Client: any = null;

async function getGmailClient() {
  if (gmail) return gmail;

  try {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.log('[Email] OAuth2 credentials not configured, emails disabled');
      console.log('[Email] Configure GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN in .env.local');
      return null;
    }

    console.log('[Email] Using OAuth2 with refresh token');

    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost:3333/callback');
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    console.log('[Email] Gmail client initialized with OAuth2');
    return gmail;
  } catch (error) {
    console.error('[Email] Failed to initialize Gmail client:', error);
    return null;
  }
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  try {
    const gmailClient = await getGmailClient();
    if (!gmailClient) {
      console.log('[Email] Gmail client not available, skipping email to:', to);
      return null;
    }

    const from = `"Booking System" <${process.env.SMTP_USER || 'noreply@booking.com'}>`;
    console.log('[Email] Sending email from:', from, 'to:', to);
    
    // Properly encode the message with UTF-8
    const message = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html).toString('base64')
    ].join('\n');
    
    const base64Message = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const result = await gmailClient.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: base64Message,
      },
    });

    console.log('[Email] ✅ Successfully sent to:', to, 'Message ID:', result.data.id);
    return result.data;
  } catch (error: any) {
    console.error('[Email] ❌ Failed to send email:', {
      to,
      subject,
      error: error.message,
      status: error.status,
      details: error.errors
    });
    // Don't throw - email is secondary
    return null;
  }
}

export async function sendBookingEmails(options: {
  clientEmail: string;
  clientName: string;
  date: string;
  time: string;
  meetLink?: string;
}) {
  const { clientEmail, clientName, date, time, meetLink } = options;
  
  // Format date for display
  const [year, month, day] = date.split('-');
  const monthNames = [
    'Січня', 'Лютого', 'Березня', 'Квітня', 'Травня', 'Червня',
    'Липня', 'Серпня', 'Вересня', 'Жовтня', 'Листопада', 'Грудня'
  ];
  const displayDate = `${monthNames[parseInt(month) - 1]} ${day}, ${year}`;

  const clientHtml = `
    <h2>Бронювання підтверджено</h2>
    <p>Привіт, ${clientName}!</p>
    <p>Ваше бронювання підтверджено:</p>
    <ul>
      <li><strong>Дата:</strong> ${displayDate}</li>
      <li><strong>Час:</strong> ${time}</li>
      ${meetLink ? `<li><strong>Google Meet:</strong> <a href="${meetLink}">${meetLink}</a></li>` : ''}
    </ul>
    <p>До зустрічі!</p>
  `;

  const adminHtml = `
    <h2>Нове бронювання</h2>
    <p>Надійшло нове бронювання:</p>
    <ul>
      <li><strong>Ім'я:</strong> ${clientName}</li>
      <li><strong>Email:</strong> ${clientEmail}</li>
      <li><strong>Дата:</strong> ${displayDate}</li>
      <li><strong>Час:</strong> ${time}</li>
      ${meetLink ? `<li><strong>Google Meet:</strong> <a href="${meetLink}">${meetLink}</a></li>` : ''}
    </ul>
  `;

  try {
    // Send email to client
    await sendEmail({
      to: clientEmail,
      subject: 'Бронювання підтверджено ✓',
      html: clientHtml,
    });

    // Send email to admin
    if (process.env.ADMIN_EMAIL) {
      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `Нове бронювання: ${clientName} на ${displayDate} ${time}`,
        html: adminHtml,
      });
    }
  } catch (error) {
    console.error('[Email] Failed to send booking emails:', error);
    // Don't throw - booking was created in calendar, email is secondary
  }
}
