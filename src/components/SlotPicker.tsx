'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface BookedSlot {
  date: string;
  time: string;
  name: string;
  email: string;
}

interface SlotPickerProps {
  date: string;
  onConfirm: (time: string, name: string, email: string, meetLink?: string) => void;
  onClose: () => void;
  bookedSlots: BookedSlot[];
  busySlots?: Array<{ date: string; time: string }>;
}

const generateTimeSlots = (dateStr: string) => {
  const slots = [];
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay(); // 0 = Неділя, 1 = Понеділок, 2 = Вівторок, 3 = Середа
  
  // Вихідні дні для видалення: Пн (1), Вт (2), Ср (3)
  const isWeekdayWithRestriction = dayOfWeek >= 1 && dayOfWeek <= 3;
  
  // Часи для видалення у Пн/Вт/Ср: 17:30 - 20:45 (тобто 17:30, 18:00, 18:30, 19:00, 19:30, 20:00, 20:30)
  const blockedTimes = new Set([
    '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'
  ]);
  
  for (let hour = 9; hour < 22; hour++) {
    for (const minute of ['00', '30']) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute}`;
      
      // Пропустить заблоковані часи для Пн/Вт/Ср
      if (isWeekdayWithRestriction && blockedTimes.has(timeStr)) {
        continue;
      }
      
      slots.push(timeStr);
    }
  }
  
  return slots;
};

const generateGoogleMeetLink = () => {
  // Google Meet URL format
  const meetingId = Math.random().toString(36).substring(2, 15);
  return `https://meet.google.com/${meetingId}`;
};

export default function SlotPicker({ date, onConfirm, onClose, bookedSlots, busySlots = [] }: SlotPickerProps) {
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isCreatingMeet, setIsCreatingMeet] = useState(false);

  const timeSlots = generateTimeSlots(date);
  const bookedTimes = bookedSlots
    .filter(slot => slot.date === date)
    .map(slot => slot.time);
  const busyTimes = busySlots
    .filter(slot => slot.date === date)
    .map(slot => slot.time);

  const isTimeBooked = (time: string) => bookedTimes.includes(time) || busyTimes.includes(time);
  const isBusy = (time: string) => busyTimes.includes(time);

  const handleConfirm = async () => {
    if (!selectedTime) {
      setError('Виберіть час');
      return;
    }
    if (!name.trim()) {
      setError('Введіть ім\'я');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Введіть коректний email');
      return;
    }

    setIsCreatingMeet(true);
    try {
      // Generate Google Meet link
      const meetLink = generateGoogleMeetLink();
      
      // In a real implementation, you would:
      // 1. Create a calendar event via Google Calendar API
      // 2. Attach the Google Meet link
      // 3. Send an invite email
      
      onConfirm(selectedTime, name, email, meetLink);
    } finally {
      setIsCreatingMeet(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    const monthNames = [
      'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
      'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
    ];
    return `${day} ${monthNames[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800">
            Виберіть час
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <p className="text-gray-600 mb-4 font-medium">
          {formatDate(date)}
        </p>

        {/* Name Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ваше ім'я
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="Введіть ваше ім'я"
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-950"
          />
        </div>

        {/* Email Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            placeholder="your.email@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black"
          />
        </div>

        {/* Time Slots */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Вільні слоти (30 хв)
          </label>
          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {timeSlots.map(time => {
              const booked = bookedTimes.includes(time);
              const busy = isBusy(time);
              
              return (
                <button
                  key={time}
                  onClick={() => {
                    if (!isTimeBooked(time)) {
                      setSelectedTime(time);
                      setError('');
                    }
                  }}
                  disabled={isTimeBooked(time)}
                  title={busy ? 'Зайнято у вашому Google Calendar' : booked ? 'Вже зарезервовано' : ''}
                  className={`
                    p-2 rounded-xl font-medium text-sm transition-all
                    ${busy
                      ? 'bg-red-100 text-red-600 cursor-not-allowed border-2 border-red-300'
                      : booked
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : selectedTime === time
                      ? 'bg-indigo-500 text-white border-2 border-indigo-600'
                      : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-indigo-500'
                    }
                  `}
                >
                  {time}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-red-600 mt-2">🔴 Червоне = Зайнято у календарі</p>
        </div>

        {error && (
          <div className="text-red-500 text-sm mb-4 p-3 bg-red-50 rounded-xl">
            {error}
          </div>
        )}

        {selectedTime && (
          <div className="mb-4 p-3 bg-indigo-50 rounded-xl text-sm text-indigo-800">
            Обраний час: <strong>{selectedTime}</strong>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            Відмінити
          </button>
          <button
            onClick={handleConfirm}
            disabled={isCreatingMeet}
            className="flex-1 px-4 py-2 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition disabled:bg-gray-400"
          >
            {isCreatingMeet ? 'Створюю...' : 'Забронювати'}
          </button>
        </div>
      </div>
    </div>
  );
}
