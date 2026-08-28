// Combines a "YYYY-MM-DD" date input with an "HH:MM" time input into a
// concrete local Date — the user picks both explicitly now (planning
// ahead for the week), so there's no "roll to tomorrow" guessing.
export function combineDateAndTime(date: string, time: string): Date {
  const [yearStr, monthStr, dayStr] = date.split("-");
  const [hoursStr, minutesStr] = time.split(":");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

// YYYY-MM-DD for today in the browser's local timezone, used as the
// date input's default value and its `min` (can't request a past date).
export function todayLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
