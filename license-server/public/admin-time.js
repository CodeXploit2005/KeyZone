export const DAY = 86400000;
export function formatDate(value) {
  const d = new Date(value), pad = v => String(v).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function parseDate(value) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year, hour, minute] = match.map(Number);
  if (year < 2000 || year > 2200) return null;
  const d = new Date(year, month - 1, day, hour, minute);
  if (d.getDate() !== day || d.getMonth() !== month - 1 || d.getFullYear() !== year || d.getHours() !== hour || d.getMinutes() !== minute) return null;
  return d;
}
export function relativeExpiry(amount, unit, now = Date.now()) {
  const value = Number(amount);
  if (!Number.isInteger(value) || value < 1 || !['days', 'hours'].includes(unit)) return null;
  const milliseconds = value * (unit === 'days' ? DAY : 3600000);
  if (milliseconds > 3660 * DAY) return null;
  return new Date(now + milliseconds);
}
