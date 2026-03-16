#!/usr/bin/env node

/**
 * Script to get Google OAuth2 refresh token for Gmail API
 * Run: node get-refresh-token.js
 */

import http from 'http';
import url from 'url';
import open from 'open';

// ⚠️ ЗАМЕНИТЕ НА ВАШИ ЗНАЧЕНИЯ
const CLIENT_ID = '193772364990-fm6f6vv2deu11uvb6ceql6od0qfvkdbl.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:3333/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar'
];

let server;

function startAuthServer() {
  return new Promise((resolve) => {
    server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url, true);

      if (parsedUrl.pathname === '/callback') {
        const code = parsedUrl.query.code;

        if (!code) {
          res.writeHead(400);
          res.end('No authorization code provided');
          return;
        }

        try {
          // Get refresh token
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              code,
              client_id: CLIENT_ID,
              client_secret: CLIENT_SECRET,
              redirect_uri: REDIRECT_URI,
              grant_type: 'authorization_code',
            }).toString(),
          });

          const tokenData = await tokenResponse.json();

          if (tokenData.refresh_token) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <h1>✅ Успешно!</h1>
              <p>Ваш Refresh Token:</p>
              <code style="background: #f0f0f0; padding: 10px; border-radius: 5px; display: block; word-break: break-all; font-family: monospace; font-size: 12px;">
                ${tokenData.refresh_token}
              </code>
              <p>Добавьте в .env.local:</p>
              <pre style="background: #f0f0f0; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px;">
GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}
GOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}
GOOGLE_OAUTH_REFRESH_TOKEN=${tokenData.refresh_token}
              </pre>
              <p>После этого перезагрузите сервер</p>
            `);
            resolve(tokenData.refresh_token);
          } else {
            res.writeHead(400);
            res.end('Failed to get refresh token: ' + JSON.stringify(tokenData));
          }
        } catch (error) {
          res.writeHead(500);
          res.end('Error: ' + error.message);
        }

        setTimeout(() => {
          server.close();
        }, 1000);
      }
    });

    server.listen(3333, () => {
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
      })}`;

      console.log('\n📱 Opening Google login in browser...\n');
      console.log('If browser doesn\'t open, visit:\n' + authUrl + '\n');

      open(authUrl).catch(() => {
        console.log('Please open this URL manually:\n' + authUrl);
      });
    });
  });
}

async function main() {
  console.log('🔐 Starting Google OAuth2 authentication...\n');
  const refreshToken = await startAuthServer();
  console.log('✅ Refresh token obtained!');
}

main().catch(console.error);
