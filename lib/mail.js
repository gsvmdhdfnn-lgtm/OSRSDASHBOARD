import nodemailer from 'nodemailer';
import { TIME_ZONE } from './time.js';

export const mailEnabled = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

// Defaults to iCloud Mail. SMTP_USER is your full iCloud address and SMTP_PASS an
// app-specific password from appleid.apple.com (not your Apple ID password).
function transport() {
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mail.me.com',
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const businessName = () => process.env.BUSINESS_NAME || '1-to-1 Sessions';
const ownerEmail = () => process.env.OWNER_EMAIL || process.env.SMTP_USER;
// iCloud only lets you send as your own address, so FROM_EMAIL defaults to SMTP_USER.
const fromHeader = () => `"${businessName()}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`;

export const formatWhen = (date) =>
  date.toLocaleString('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' (UK time)';

const icsStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);

function calendarInvite({ id, start, end, business, owner }) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//booking//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@booking`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(`1-to-1 session – ${business}`)}`,
    ...(owner ? [`ORGANIZER:mailto:${owner}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export async function sendBookingEmails({ id, start, end, name, email, notes }) {
  if (!mailEnabled()) return;

  const business = businessName();
  const owner = ownerEmail();
  const when = formatWhen(start);
  const from = fromHeader();
  const invite = { filename: 'session.ics', content: calendarInvite({ id, start, end, business, owner }), contentType: 'text/calendar' };
  const mailer = transport();

  await Promise.all([
    mailer.sendMail({
      from,
      to: owner,
      replyTo: email,
      subject: `New booking: ${name} – ${when}`,
      text: `You have a new 1-to-1 booking.\n\nWho:   ${name} <${email}>\nWhen:  ${when}\nNotes: ${notes || '—'}\n\nManage it from the admin page of your booking site.`,
      attachments: [invite],
    }),
    mailer.sendMail({
      from,
      to: email,
      replyTo: owner,
      subject: `Your session is booked – ${when}`,
      text: `Hi ${name},\n\nYour 1-to-1 session is confirmed for:\n\n  ${when}\n\nA calendar invite is attached. If you need to change or cancel, just reply to this email.\n\n${business}`,
      attachments: [invite],
    }),
  ]);
}

export async function sendCancellationEmail({ start, name, email, message }) {
  if (!mailEnabled() || !email) return;
  const when = formatWhen(start);
  await transport().sendMail({
    from: fromHeader(),
    to: email,
    replyTo: ownerEmail(),
    subject: `Your session on ${when} has been cancelled`,
    text: `Hi ${name},\n\nYour 1-to-1 session on ${when} has been cancelled.${message ? `\n\n${message}` : ''}\n\nYou're welcome to book another time, or just reply to this email.\n\n${businessName()}`,
  });
}
