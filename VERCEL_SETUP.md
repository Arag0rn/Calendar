# Vercel Deployment - Email Configuration Guide

## Problem: Emails not working on Vercel

This happens because:
1. Environment variables not set on Vercel
2. Refresh token expired
3. Redirect URI mismatch between local and production

## Solution: Configure Environment Variables on Vercel

### Step 1: Go to Vercel Dashboard
1. Visit [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**

### Step 2: Add these environment variables

Copy from your `.env.local` and add to Vercel:

```
GOOGLE_OAUTH_CLIENT_ID=[YOUR_OAUTH_CLIENT_ID]
GOOGLE_OAUTH_CLIENT_SECRET=[YOUR_OAUTH_CLIENT_SECRET]
GOOGLE_OAUTH_REFRESH_TOKEN=[YOUR_REFRESH_TOKEN]
ADMIN_EMAIL=[YOUR_ADMIN_EMAIL]
GOOGLE_CALENDAR_ID=[YOUR_CALENDAR_ID]
GOOGLE_SERVICE_ACCOUNT_JSON=[YOUR_BASE64_ENCODED_SERVICE_ACCOUNT]
```

Get these values from your `.env.local` file in the project root.

### Step 3: Redeploy
After adding the environment variables, redeploy your app:
```
git push  # Will trigger automatic Vercel deployment
```

### Step 4: Check logs
1. Go to **Deployments** in Vercel
2. Click on the latest deployment
3. View **Logs** to check if emails are being sent

## Troubleshooting

### Issue: "invalid_grant" error
This means your refresh token is expired or invalid.

**Fix:**
1. Run locally:
   ```bash
   node get-refresh-token.mjs
   ```
2. This will generate a NEW refresh token
3. Update it on Vercel dashboard
4. Redeploy

### Issue: "Unauthorized" error
Missing or incorrect environment variables.

**Fix:**
1. Double-check all three OAuth variables are set
2. Make sure you copied the exact values (no extra spaces)
3. Verify ADMIN_EMAIL is set

### Issue: Redirect URI mismatch
The code now auto-detects your Vercel URL, so this should be fixed.

But you can manually set:
```
APP_URL=https://your-app.vercel.app
```

## Local Development

Emails work locally with:
- `VERCEL_URL` is not set
- Falls back to `http://localhost:3000`
- Requires all OAuth variables in `.env.local`

## Need Help?

Check the logs in Vercel with:
```bash
Deployments → [Your deployment] → Logs → Function logs
```

The code now logs detailed debugging info with emojis 🔍⚠️✅
