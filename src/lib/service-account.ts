import * as fs from 'fs';
import * as path from 'path';

export function getServiceAccountKeyFile() {
  // Try environment variable first (for production/Vercel)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString();
      const keyFile = JSON.parse(decoded);
      console.log('[Service Account] ✓ Loaded from environment variable');
      return keyFile;
    } catch (error: any) {
      console.error('[Service Account] ❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', {
        error: error.message,
        envLength: process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.length,
      });
      throw new Error(`Service account JSON decode error: ${error.message}`);
    }
  }

  // Fallback to local file (for development)
  const keyPath = path.join(process.cwd(), 'google-service-account.json');
  if (fs.existsSync(keyPath)) {
    try {
      const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
      console.log('[Service Account] ✓ Loaded from local file');
      return keyFile;
    } catch (error: any) {
      console.error('[Service Account] ❌ Failed to parse local file:', error.message);
      throw new Error(`Local service account JSON parse error: ${error.message}`);
    }
  }

  throw new Error('Service account credentials not found in environment or file');
}
