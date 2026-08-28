// Combines an "HH:MM" input (from a <input type="time">) with today's date,
// rolling over to tomorrow if that time has already passed today — this app
// is framed around "commuting tonight," so a past time means "tomorrow."
export function nextOccurrenceOf(time: string): Date {
  const [hoursStr, minutesStr] = time.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  const candidate = new Date();
  candidate.setHours(hours, minutes, 0, 0);

  if (candidate.getTime() <= Date.now()) {
    candidate.setDate(candidate.getDate() + 1);
  }

  return candidate;
}
