import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { syncCalendarEvent } from "../integrations/calendar";
import { sendBookingConfirmation } from "../integrations/email";

export interface Booking {
  id: string;
  userId: string;
  status: "confirmed" | "cancelled";
  date: string;
  time: string;
  partySize: number;
}

const DB_PATH = join(process.cwd(), "data", "reservations.json");

function ensureDb(): Booking[] {
  if (!existsSync(join(process.cwd(), "data"))) {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
  }
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify([]), "utf-8");
    return [];
  }
  try {
    return JSON.parse(readFileSync(DB_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveDb(bookings: Booking[]) {
  writeFileSync(DB_PATH, JSON.stringify(bookings, null, 2), "utf-8");
}

export async function checkAvailability(date: string, time: string): Promise<boolean> {
  const bookings = ensureDb();
  // Simple mock logic: allow max 2 bookings per time slot
  const overlapping = bookings.filter(
    (b) => b.date === date && b.time === time && b.status === "confirmed"
  );
  return overlapping.length < 2;
}

export async function createBooking(args: Omit<Booking, "id" | "status">): Promise<Booking> {
  const isAvail = await checkAvailability(args.date, args.time);
  if (!isAvail) {
    throw new Error(`Slot ${args.date} at ${args.time} is fully booked.`);
  }

  const bookings = ensureDb();
  const newBooking: Booking = {
    ...args,
    id: `BKG-${nanoid(6).toUpperCase()}`,
    status: "confirmed",
  };
  bookings.push(newBooking);
  saveDb(bookings);

  // Trigger integrations (stubs)
  await syncCalendarEvent(newBooking);
  await sendBookingConfirmation("user@example.com", newBooking);

  return newBooking;
}

export async function cancelBooking(bookingId: string): Promise<boolean> {
  const bookings = ensureDb();
  const b = bookings.find((x) => x.id === bookingId);
  if (!b) throw new Error("Booking not found");
  if (b.status === "cancelled") return true;

  b.status = "cancelled";
  saveDb(bookings);

  await syncCalendarEvent(b);
  return true;
}
