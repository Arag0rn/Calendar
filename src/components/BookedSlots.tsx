'use client';

import { useState } from 'react';
import { Trash2, ExternalLink, X } from 'lucide-react';

interface BookedSlot {
  date: string;
  time: string;
  isoDateTime?: string; // UTC ISO datetime from server
  name: string;
  email: string;
  meetLink?: string;
  eventId?: string;
}

interface BookedSlotsProps {
  slots: BookedSlot[];
  onCancel: (date: string, time: string, adminToken: string) => Promise<boolean>;
}

export default function BookedSlots({ slots, onCancel }: BookedSlotsProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteToken, setDeleteToken] = useState('');
  const [deletingSlot, setDeletingSlot] = useState<{ date: string; time: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (dateStr: string, isoDateTime?: string) => {
    const monthNames = [
      'січ', 'лют', 'бер', 'кві', 'тра', 'чер',
      'ли', 'сер', 'вер', 'жов', 'лис', 'гру'
    ];
    
    // If we have ISO datetime, use it to get the correct local date
    if (isoDateTime) {
      const date = new Date(isoDateTime);
      const day = String(date.getDate()).padStart(2, '0');
      const month = date.getMonth();
      return `${day} ${monthNames[month]}`;
    }
    
    // Fallback to string parsing if no ISO datetime
    const [year, month, day] = dateStr.split('-');
    return `${day} ${monthNames[parseInt(month) - 1]}`;
  };

  const formatTime = (timeStr: string, isoDateTime?: string) => {
    // If we have ISO datetime, use it to get the correct local time
    if (isoDateTime) {
      const date = new Date(isoDateTime);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    
    // Fallback to provided time string
    return timeStr;
  };

  const handleDeleteClick = (slot: BookedSlot) => {
    setDeletingSlot({ date: slot.date, time: slot.time });
    setDeleteModalOpen(true);
    setDeleteToken('');
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingSlot) return;
    
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const success = await onCancel(deletingSlot.date, deletingSlot.time, deleteToken);
      if (success) {
        setDeleteModalOpen(false);
        setDeletingSlot(null);
        setDeleteToken('');
      } else {
        setDeleteError('Неправильний токен');
      }
    } catch (error) {
      setDeleteError('Помилка при видаленні');
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const sortedSlots = [...slots].sort((a, b) => {
    // Use isoDateTime if available (already in UTC)
    if (a.isoDateTime && b.isoDateTime) {
      return new Date(a.isoDateTime).getTime() - new Date(b.isoDateTime).getTime();
    }
    // Fallback to date and time strings
    const dateA = new Date(`${a.date}T${a.time}`);
    const dateB = new Date(`${b.date}T${b.time}`);
    return dateA.getTime() - dateB.getTime();
  });

  return (
    <>
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Заброньовано ({slots.length})
        </h3>

        {slots.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">Поки немає бронювань</p>
            <p className="text-xs mt-2">Виберіть дату та час</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSlots.map((slot, idx) => (
              <div
                key={idx}
                className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex justify-between items-start"
              >
                <div className="flex-1">
                  <p className="font-semibold text-indigo-900 text-sm">
                    {slot.name}
                  </p>
                  <p className="text-indigo-700 text-xs mt-1">
                    {formatDate(slot.date, slot.isoDateTime)} о {formatTime(slot.time, slot.isoDateTime)}
                  </p>
                  <p className="text-indigo-600 text-xs mt-1 truncate">
                    {slot.email}
                  </p>
                  {slot.meetLink && (
                    <a
                      href={slot.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 text-xs mt-2 flex items-center gap-1 hover:underline"
                    >
                      Google Meet <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteClick(slot)}
                  className="ml-2 text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition"
                  title="Скасування бронювання"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {slots.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Всього: {slots.length} бронювань
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">
                Скасувати бронювання
              </h3>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">
              Введіть адмін-токен для скасування бронювання
            </p>

            <input
              type="password"
              value={deleteToken}
              onChange={(e) => {
                setDeleteToken(e.target.value);
                setDeleteError(null);
              }}
              placeholder="Адмін-токен"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
            />

            {deleteError && (
              <div className="text-red-500 text-sm mb-4 p-3 bg-red-50 rounded-xl">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Скасувати
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting || !deleteToken.trim()}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition disabled:bg-gray-400"
              >
                {isDeleting ? 'Видаляю...' : 'Видалити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
