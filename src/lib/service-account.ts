import * as fs from 'fs';
import * as path from 'path';

export function getServiceAccountKeyFile() {
  // Try environment variable first (for production/Vercel)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(
        Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString()
      );
    } catch (error) {
      console.error('[Service Account] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', error);
    }
  }

  // Fallback to local file (for development)
  const keyPath = path.join(process.cwd(), 'google-service-account.json');
  if (fs.existsSync(keyPath)) {
    return JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  }

  throw new Error('Service account credentials not found in environment or file');
}
