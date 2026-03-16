'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface GoogleCalendarSyncProps {
  token?: string;
  onBusySlotsUpdate: (slots: Array<{ date: string; time: string }>) => void;
}

export default function GoogleCalendarSync({ onBusySlotsUpdate }: GoogleCalendarSyncProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncCalendar = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();
      
      const response = await fetch(
        `/api/calendar/events?month=${month}&year=${year}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch calendar events');
      }
      
      const data = await response.json();
      onBusySlotsUpdate(data.busySlots || []);
      setLastSync(new Date().toLocaleTimeString('uk-UA'));
    } catch (err) {
      setError('Помилка синхронізації календаря');
      console.error('Calendar sync error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auto-sync on mount
    syncCalendar();
    
    // Re-sync every 5 minutes
    const interval = setInterval(syncCalendar, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-blue-900 flex items-center gap-2">
            📅 Google Calendar синхронізація
          </h3>
          {lastSync && (
            <p className="text-sm text-blue-700 mt-1">
              Остання синхронізація: {lastSync}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 mt-1">
              {error}
            </p>
          )}
        </div>
        <button
          onClick={syncCalendar}
          disabled={isLoading}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Синхронізація...' : 'Синхронізувати'}
        </button>
      </div>
    </div>
  );
}
