import { Resend } from "resend";
import type { Booking } from "../db/reservations";

export async function sendBookingConfirmation(email: string, booking: Booking): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email Integration] RESEND_API_KEY is not set. Skipping email dispatch.");
    return;
  }

  const resend = new Resend(apiKey);
  const isCancelled = booking.status === "cancelled";
  
  const subject = isCancelled 
    ? `Booking Cancelled: ${booking.date}` 
    : `Booking Confirmed: ${booking.date} at ${booking.time}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">VOXERA Reservation ${isCancelled ? 'Cancelled' : 'Confirmed'}</h2>
      <p>Hello,</p>
      <p>Your booking (ID: <strong>${booking.id}</strong>) has been <strong>${booking.status}</strong>.</p>
      <ul>
        <li><strong>Date:</strong> ${booking.date}</li>
        <li><strong>Time:</strong> ${booking.time}</li>
        <li><strong>Party Size:</strong> ${booking.partySize}</li>
      </ul>
      <p>If you need to make any changes, please call the VOXERA Receptionist.</p>
      <hr style="border: 1px solid #eee; margin-top: 20px;" />
      <p style="color: #888; font-size: 12px;">Powered by VOXERA Agentic AI Platform</p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: "VOXERA Receptionist <onboarding@resend.dev>",
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error("[Email Integration] Resend API Error:", error);
    } else {
      console.log(`[Email Integration] Successfully sent email to ${email}. ID: ${data?.id}`);
    }
  } catch (err) {
    console.error("[Email Integration] Failed to send email:", err);
  }
}
