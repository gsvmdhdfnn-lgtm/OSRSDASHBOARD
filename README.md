# 1-to-1 Session Booking

A simple booking site for 1-to-1 sessions.

- **Booking page** (`/`): clients pick an open date and time from your schedule and enter their name, email and an optional note. Sessions are 60 minutes, and all times are UK time (clock changes are handled automatically).
- **Your hub** (`/admin`, password protected): set your weekly hours, add time off, see upcoming bookings and cancel them (with an optional email to the client).
- **Emails via iCloud**: when someone books, you get an email at your iCloud address and the client gets a confirmation. Both include a calendar invite.
- **Storage**: data is kept in three Notion databases in the background. You never need to open Notion to run things.

Once a slot is booked, nobody else can take it. The server re-checks every booking, and if two people click the same time at once, the first one wins.

## Project layout

```
public/          Booking page (index.html) and admin hub (admin.html)
api/slots.js     GET  – open slots
api/book.js      POST – make a booking and send emails
api/admin.js     Admin actions (login, hours, time off, cancel)
lib/             Notion, email, time-zone and slot logic
scripts/         One-off Notion setup
```

## Setup (about 15 minutes, one time)

### 1. Notion

1. Go to <https://www.notion.so/my-integrations>, click **New integration**, name it "Booking", and copy the **Internal Integration Secret**. This is your `NOTION_TOKEN`.
2. In Notion, create an empty page, e.g. "Booking data". Open **••• → Connections → Connect to** and choose "Booking".
3. On your computer (Node 18 or newer), run:
   ```bash
   npm install
   NOTION_TOKEN=secret_xxx NOTION_PARENT_PAGE_ID="<link to that page>" npm run setup-notion
   ```
   It creates the *Weekly hours*, *Time off* and *Bookings* databases and prints three `NOTION_..._DB=` lines. Keep them for step 3.

### 2. iCloud email

1. Sign in at <https://account.apple.com>, go to **Sign-In and Security → App-Specific Passwords**, and create one called "Booking".
2. You'll use your iCloud address as `SMTP_USER` and that app-specific password as `SMTP_PASS`. Don't use your normal Apple ID password.

### 3. Deploy on Vercel (free)

1. Sign in at <https://vercel.com> with GitHub and **Import** this repository. The default settings are fine.
2. Under **Settings → Environment Variables**, add:

| Variable | Value |
| --- | --- |
| `NOTION_TOKEN` | from step 1 |
| `NOTION_HOURS_DB`, `NOTION_TIMEOFF_DB`, `NOTION_BOOKINGS_DB` | printed by the setup script |
| `ADMIN_PASSWORD` | a strong password for `/admin` |
| `SMTP_USER` | your iCloud email, e.g. `you@icloud.com` |
| `SMTP_PASS` | the app-specific password |
| `OWNER_EMAIL` | where new-booking alerts go (defaults to `SMTP_USER`) |
| `BUSINESS_NAME` | shown on the page and in emails, e.g. "Sam's Coaching" |
| `DAYS_AHEAD` | *optional*, how far ahead people can book (default 28) |
| `MIN_NOTICE_HOURS` | *optional*, the minimum notice for a booking (default 12) |

3. Redeploy, open `https://<your-site>/admin`, log in, and add your weekly hours.
4. Share `https://<your-site>/` with clients. It's also shown at the top of your hub.

> iCloud only lets you send from your own address, so emails come from `SMTP_USER`. If you use a custom-domain address set up in iCloud+, set `FROM_EMAIL` to it.

## Development

```bash
npm install
npm test          # slot and time-zone tests
npx vercel dev    # runs the site and API locally (needs the env vars in .env)
```
