'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SlotPicker from './SlotPicker';

interface BookedSlot {
  date: string;
  time: string;
  name: string;
  email: string;
  meetLink?: string;
}

interface BookingCalendarProps {
  onSlotBooked: (date: string, time: string, name: string, email: string, meetLink?: string) => void;
  bookedSlots: BookedSlot[];
  busySlots?: Array<{ date: string; time: string }>;
}

const getDaysInMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

const getFirstDayOfMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
};

const formatDate = (year: number, month: number, day: number) => {
  return `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

export default function BookingCalendar({ onSlotBooked, bookedSlots, busySlots = [] }: BookingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showSlotPicker, setShowSlotPicker] = useState(false);

  const monthNames = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ];

  const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const selectDate = (day: number) => {
    const dateStr = formatDate(year, month, day);
    setSelectedDate(dateStr);
    setShowSlotPicker(true);
  };

  const isBooked = (day: number) => {
    const dateStr = formatDate(year, month, day);
    return bookedSlots.some(slot => slot.date === dateStr);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isPast = (day: number) => {
    const checkDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 rounded-xl transition"
          >
            <ChevronLeft className="w-7 h-7 bg-blue-700 hover:bg-blue-800 text-white hover:text-white cursor-pointer rounded-lg transition-all hover:scale-110" />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-xl transition"
          >
            <ChevronRight className="w-7 h-7 bg-blue-700 hover:bg-blue-800 text-white hover:text-white cursor-pointer rounded-lg transition-all hover:scale-110" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center font-semibold text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, idx) => (
            <button
              key={idx}
              onClick={() => day && selectDate(day)}
              disabled={!day || isPast(day || 0)}
              className={`
                aspect-square rounded-2xl font-semibold transition-all
                ${!day ? 'bg-gray-50' : ''}
                ${day && isPast(day) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
                ${day && !isPast(day) ? 'hover:bg-indigo-100 cursor-pointer text-black' : ''}
                ${isToday(day || 0) ? 'bg-indigo-500 text-white border-2 border-indigo-600' : ''}
                ${isBooked(day || 0) && !isToday(day || 0) ? 'bg-green-100 text-green-800 border-2 border-green-300' : ''}
                ${day && !isToday(day) && !isBooked(day) && !isPast(day) ? 'bg-white border-2 border-gray-200' : ''}
              `}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {showSlotPicker && selectedDate && (
        <SlotPicker
          date={selectedDate}
          onConfirm={(time, name, email, meetLink) => {
            onSlotBooked(selectedDate, time, name, email, meetLink);
            setShowSlotPicker(false);
            setSelectedDate(null);
          }}
          onClose={() => {
            setShowSlotPicker(false);
            setSelectedDate(null);
          }}
          bookedSlots={bookedSlots}
          busySlots={busySlots}
        />
      )}
    </div>
  );
}
