import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Fonts are vendored locally (app/fonts/) rather than fetched from Google
 * Fonts at build/dev time via next/font/google — that remote fetch was
 * flaky in some environments (Turbopack "Module not found:
 * @vercel/turbopack-next/internal/font/google/font" when the CDN request
 * failed), breaking page renders entirely. Each file below is the single
 * variable-weight woff2 Google Fonts itself serves for the "latin" subset
 * (Bricolage Grotesque, DM Sans, and JetBrains Mono are all variable
 * fonts, so one file covers the full weight range used in this app).
 */

/**
 * HEADING FONT — Bricolage Grotesque
 * Matches the bold, tight geometric grotesque used in Obliq-style designs.
 * Weight 800 for big headings, 700 for section titles.
 */
const bricolage = localFont({
  src: "./fonts/bricolage-grotesque.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "400 800",
});

/**
 * BODY FONT — DM Sans
 * Clean, light, modern grotesque. Pairs perfectly with Bricolage for the
 * airy, SaaS-product look (Obliq style). Use 300–400 for body, 500–600 for UI.
 */
const dmSans = localFont({
  src: "./fonts/dm-sans.woff2",
  variable: "--font-body",
  display: "swap",
  weight: "300 600",
});

/**
 * MONO FONT — JetBrains Mono
 * Keep for admin portal code/log displays and monospaced UI labels.
 */
const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "400 600",
});

export const metadata: Metadata = {
  title: "VOXERA — AI Phone Agents That Actually Perform",
  description: "Deploy AI voice agents that answer calls, book appointments, and detect caller emotion in real time. Built for modern businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
