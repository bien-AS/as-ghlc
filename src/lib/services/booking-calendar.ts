import type { BookingSlot } from "@/lib/decks/schemas";

/*
 * The booking calendar (server-only; called only by src/lib/data/decks.ts).
 *
 * It stands in for the calendar the CRM adapter's lookups will supply (spec
 * 11). Today it makes no network call and books nothing: it returns sample
 * call slots placed relative to the time it is asked.
 */

const HOUR = 60 * 60 * 1000;
const SLOT_MINUTES = 30;
/** Hours of the day (UTC) a sample slot starts at. */
const SLOT_HOURS = [15, 17, 19];
const SLOT_DAYS = 2;

/** Sample call slots on the next working days after `now`. */
export async function listCallSlots(now: number): Promise<BookingSlot[]> {
  const slots: BookingSlot[] = [];
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  while (slots.length < SLOT_DAYS * SLOT_HOURS.length) {
    day.setUTCDate(day.getUTCDate() + 1);
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const hour of SLOT_HOURS) {
      slots.push({
        id: `slot-${slots.length + 1}`,
        time: new Date(day.getTime() + hour * HOUR).toISOString(),
        minutes: SLOT_MINUTES,
      });
    }
  }
  return slots;
}
