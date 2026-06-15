import type { Booking } from "../db/reservations";

export async function sendBookingConfirmation(email: string, booking: Booking): Promise<void> {
  console.log(`[Email Integration Stub] Sending email to ${email} for Booking ${booking.id} (${booking.date} @ ${booking.time})`);
  // FR-15: In the future, this will connect to Resend or SendGrid.
}
