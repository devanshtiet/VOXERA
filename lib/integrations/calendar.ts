import type { Booking } from "../db/reservations";

export async function syncCalendarEvent(booking: Booking): Promise<void> {
  console.log(`[Calendar Integration Stub] Syncing event for Booking ${booking.id} (${booking.date} @ ${booking.time}) - Status: ${booking.status}`);
  // FR-14: In the future, this will connect to Google Calendar or Outlook OAuth APIs.
}
