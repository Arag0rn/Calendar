'use client';

import { useState, useEffect } from 'react';
import BookingCalendar from '@/components/BookingCalendar';
import BookedSlots from '@/components/BookedSlots';

interface BookedSlot {
  date: string;
  time: string;
  name: string;
  email: string;
  meetLink?: string;
}

export default function Home() {
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [busySlots, setBusySlots] = useState<Array<{ date: string; time: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
    // Fetch booked slots from Google Calendar
    fetchBookedSlots();
  }, []);

  const deletePastEvents = async (slots: BookedSlot[]) => {
    const now = new Date();
    const pastEvents: BookedSlot[] = [];

    // Find events that are in the past
    for (const slot of slots) {
      const [year, month, day] = slot.date.split('-').map(Number);
      const [hours, minutes] = slot.time.split(':').map(Number);
      
      const eventTime = new Date(year, month - 1, day, hours, minutes);
      
      if (eventTime < now) {
        pastEvents.push(slot);
      }
    }

    // Delete past events (no token required for past events)
    if (pastEvents.length > 0) {
      for (const slot of pastEvents) {
        try {
          await fetch('/api/calendar/delete-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: slot.date,
              time: slot.time,
              adminToken: '' // No token needed for past events
            })
          });
        } catch (error) {
          console.error(`Failed to delete past event ${slot.date} ${slot.time}:`, error);
        }
      }
    }
  };

  const fetchBookedSlots = async () => {
    try {
      setIsLoading(true);
      const now = new Date();
      const month = now.getMonth();
      const year = now.getFullYear();
      
      // Fetch bookings
      const bookingsResponse = await fetch(
        `/api/calendar/bookings?month=${month}&year=${year}`
      );
      if (bookingsResponse.ok) {
        const data = await bookingsResponse.json();
        const bookings = data.bookings || [];
        setBookedSlots(bookings);
        
        // Delete past events automatically
        await deletePastEvents(bookings);
      }

      // Fetch busy slots from calendar
      const eventsResponse = await fetch(
        `/api/calendar/events?month=${month}&year=${year}`
      );
      if (eventsResponse.ok) {
        const data = await eventsResponse.json();
        setBusySlots(data.busySlots || []);
      }
    } catch (error) {
      console.error('Failed to fetch from calendar:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSlotBooked = async (date: string, time: string, name: string, email: string, meetLink?: string) => {
    try {
      // Save to Google Calendar
      const response = await fetch('/api/calendar/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          time,
          name,
          email,
          meetLink
        })
      });
      
      if (response.ok) {
        // Refresh bookings list
        await fetchBookedSlots();
      } else {
        console.error('Failed to create booking in Google Calendar');
      }
    } catch (error) {
      console.error('Failed to save booking:', error);
    }
  };

  const handleCancelSlot = async (date: string, time: string, adminToken: string): Promise<boolean> => {
    try {
      // Delete from Google Calendar
      const response = await fetch('/api/calendar/delete-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time, adminToken })
      });
      
      if (response.ok) {
        // Refresh bookings list
        await fetchBookedSlots();
        return true;
      } else {
        const data = await response.json();
        console.error('Failed to delete booking:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Failed to delete booking:', error);
      return false;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-indigo-900">Система бронювання</h1>
          <p className="text-gray-600 mt-2">Виберіть вільний 30-хвилинний слот</p>
        </div>

        {isClient ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Booking Calendar */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <BookingCalendar 
                  onSlotBooked={handleSlotBooked} 
                  bookedSlots={bookedSlots}
                  busySlots={busySlots}
                />
              </div>
            </div>
            
            {/* Booked Slots */}
            <div>
              <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8">
                <BookedSlots 
                  slots={bookedSlots} 
                  onCancel={handleCancelSlot}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600">Завантаження...</p>
          </div>
        )}
      </div>
    </main>
  );
}
