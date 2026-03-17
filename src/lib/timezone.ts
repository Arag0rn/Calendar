const pad2 = (n: number): string => String(n).padStart(2, '0');

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const getParts = (date: Date, timeZone: string): ZonedParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: parseInt(map.year || '0', 10),
    month: parseInt(map.month || '0', 10),
    day: parseInt(map.day || '0', 10),
    hour: parseInt(map.hour || '0', 10),
    minute: parseInt(map.minute || '0', 10),
    second: parseInt(map.second || '0', 10),
  };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const p = getParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
};

export const zonedDateTimeToUtc = (dateStr: string, timeStr: string, timeZone: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);

  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const firstPass = utcGuess - firstOffset;

  // Recalculate offset once to be safe around DST boundary moments.
  const secondOffset = getTimeZoneOffsetMs(new Date(firstPass), timeZone);
  return new Date(utcGuess - secondOffset);
};

export const utcToZonedParts = (date: Date, timeZone: string): ZonedParts => getParts(date, timeZone);

export const partsToDateKey = (p: { year: number; month: number; day: number }): string => {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
};

export const partsToTimeKey = (p: { hour: number; minute: number }): string => {
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
};

export const partsToDateTime = (p: ZonedParts): string => {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
};
