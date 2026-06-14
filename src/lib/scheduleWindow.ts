/**
 * Shared Helfer fuer Zeitfenster-Berechnungen (Strict-Lock & Strict-Addons).
 *
 * Wichtig: Ein Fenster wie 22:00 – 06:00 ueberspannt Mitternacht. Frueher wurde
 * das Fenster immer relativ zum *heutigen* Tag berechnet. Stand `now` nach
 * Mitternacht (z. B. 02:00), lag es scheinbar "vor" dem Startzeitpunkt (22:00)
 * und das Fenster galt faelschlich als beendet – der Strict-Lock loeste sich
 * direkt nach Mitternacht auf. Diese Helfer beruecksichtigen daher auch das
 * Fenster, das *gestern* begonnen hat.
 */

export interface ScheduleWindowBounds {
  /** Beginn des aktuell relevanten Fensters in ms. */
  start: number;
  /** Ende des aktuell relevanten Fensters in ms. */
  end: number;
  /** true, wenn das Fenster ueber Mitternacht laeuft (end <= start am selben Tag). */
  isOvernight: boolean;
}

function parseTimeParts(time: string): [number, number] {
  const [hours, minutes] = time.split(':').map(Number);
  return [Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0];
}

/**
 * Liefert das Zeitfenster, das `now` enthaelt – oder, falls `now` ausserhalb
 * liegt, das naechste/aktuelle Fenster relativ zum heutigen Tag.
 *
 * Fuer Tagesfenster (Start < Ende) ist das simpel. Fuer Nacht-Fenster
 * (Start >= Ende) wird zusaetzlich das Fenster geprueft, das am Vortag begann
 * und bis heute morgen laeuft.
 */
export function resolveScheduleWindow(
  startTime: string,
  endTime: string,
  now = Date.now(),
): ScheduleWindowBounds {
  const nowDate = new Date(now);
  const [startH, startM] = parseTimeParts(startTime);
  const [endH, endM] = parseTimeParts(endTime);

  const startToday = new Date(nowDate);
  startToday.setHours(startH, startM, 0, 0);

  const endToday = new Date(nowDate);
  endToday.setHours(endH, endM, 0, 0);

  const isOvernight = endToday.getTime() <= startToday.getTime();

  if (!isOvernight) {
    return { start: startToday.getTime(), end: endToday.getTime(), isOvernight };
  }

  // Nacht-Fenster: zuerst pruefen, ob wir noch im Fenster sind, das *gestern*
  // begonnen hat (Start gestern, Ende heute morgen).
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);

  if (now < endToday.getTime()) {
    // Wir liegen im Morgen-Teil des gestern gestarteten Fensters.
    return { start: startYesterday.getTime(), end: endToday.getTime(), isOvernight };
  }

  // Sonst: das heute startende Fenster, das morgen frueh endet.
  const endTomorrow = new Date(endToday);
  endTomorrow.setDate(endTomorrow.getDate() + 1);
  return { start: startToday.getTime(), end: endTomorrow.getTime(), isOvernight };
}

/** true, wenn `now` ausserhalb des [start, end)-Fensters liegt. */
export function isOutsideScheduleWindow(
  startTime: string,
  endTime: string,
  now = Date.now(),
): boolean {
  const { start, end } = resolveScheduleWindow(startTime, endTime, now);
  return now < start || now >= end;
}

/** Millisekunden bis zum Ende des aktuellen bzw. naechsten Fensters. */
export function msUntilWindowEnd(
  startTime: string,
  endTime: string,
  now = Date.now(),
): number {
  const { end } = resolveScheduleWindow(startTime, endTime, now);
  return Math.max(0, end - now);
}
