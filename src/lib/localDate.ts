function padDatePart(value: number) {
  return `${value}`.padStart(2, '0');
}

export function getLocalDateKey(
  value: number | string | Date = Date.now(),
  timeZoneOffsetMinutes?: number,
) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  const resolvedTimeZoneOffsetMinutes = timeZoneOffsetMinutes ?? date.getTimezoneOffset();
  const shiftedDate = new Date(date.getTime() - resolvedTimeZoneOffsetMinutes * 60_000);

  return [
    shiftedDate.getUTCFullYear(),
    padDatePart(shiftedDate.getUTCMonth() + 1),
    padDatePart(shiftedDate.getUTCDate()),
  ].join('-');
}

export function shiftDateKey(dateKey: string, dayDelta: number) {
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateKey;
  }

  const shiftedDate = new Date(Date.UTC(year, month - 1, day + dayDelta));
  return shiftedDate.toISOString().slice(0, 10);
}
