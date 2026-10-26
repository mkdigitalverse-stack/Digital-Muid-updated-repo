/**
 * DigitalMUID Calendar Invite (.ICS) Generator
 * Generates standards-compliant iCalendar (.ics) files for consultation confirmations.
 */

/**
 * Generates an iCalendar (.ics) formatted Buffer for appointment scheduling.
 *
 * @param {object} params
 * @param {string} params.bookingCode - Unique booking reference (e.g. DM-2026-1234)
 * @param {string} params.bookingDate - Date string in YYYY-MM-DD
 * @param {string} params.bookingTime - Time string in HH:MM (IST)
 * @param {number} [params.durationMinutes] - Duration in minutes (default 30)
 * @param {string} [params.customerName] - Customer name
 * @param {string} [params.customerEmail] - Customer email
 * @param {string} [params.meetUrl] - Google Meet link
 * @param {string} [params.primaryChallenge] - Consultation focus area
 * @returns {Buffer} .ics file binary Buffer
 */
export function generateConsultationIcsBuffer({
  bookingCode,
  bookingDate,
  bookingTime,
  durationMinutes = 30,
  customerName = "Valued Client",
  customerEmail = "",
  meetUrl = "https://meet.google.com",
  primaryChallenge = "Business Growth Strategy"
}) {
  // Parse date and time in IST (UTC+5:30)
  // Format: YYYYMMDDTHHMMSSZ (UTC)
  let dtStartUtc = "";
  let dtEndUtc = "";

  try {
    const cleanDate = (bookingDate || "").trim(); // YYYY-MM-DD
    const cleanTime = (bookingTime || "10:00").trim(); // HH:MM
    const [year, month, day] = cleanDate.split("-").map(Number);
    const [hour, minute] = cleanTime.split(":").map(Number);

    if (year && month && day && !isNaN(hour) && !isNaN(minute)) {
      // Create date object in UTC adjusting for IST (-5h 30m)
      const startDateIst = new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30, 0));
      const endDateIst = new Date(startDateIst.getTime() + durationMinutes * 60 * 1000);

      const toIcsString = (d) =>
        d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

      dtStartUtc = toIcsString(startDateIst);
      dtEndUtc = toIcsString(endDateIst);
    }
  } catch {}

  if (!dtStartUtc || !dtEndUtc) {
    const fallbackStart = new Date(Date.now() + 86400000);
    const fallbackEnd = new Date(fallbackStart.getTime() + 30 * 60 * 1000);
    dtStartUtc = fallbackStart.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    dtEndUtc = fallbackEnd.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  const nowIcs = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `consultation-${bookingCode}-${Date.now()}@digitalmuid.in`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DigitalMUID//Strategic Consultation Session//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowIcs}`,
    `DTSTART:${dtStartUtc}`,
    `DTEND:${dtEndUtc}`,
    `SUMMARY:Strategic Business Growth Consultation — DigitalMUID (${bookingCode})`,
    `DESCRIPTION:Strategic Consultation with DigitalMUID (Powered by MK Digitalverse)\\n\\nFocus Area: ${primaryChallenge.replace(/\n/g, " ")}\\nClient: ${customerName}\\nBooking Reference: ${bookingCode}\\nGoogle Meet: ${meetUrl}\\nSupport: support@digitalmuid.in`,
    `LOCATION:${meetUrl}`,
    "STATUS:CONFIRMED",
    `ORGANIZER;CN=DigitalMUID Strategy Team:mailto:support@digitalmuid.in`,
    customerEmail ? `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${customerName}:mailto:${customerEmail}` : "",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder: DigitalMUID Consultation starts in 15 minutes",
    "TRIGGER:-PT15M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean);

  const icsContent = icsLines.join("\r\n");
  return Buffer.from(icsContent, "utf8");
}
