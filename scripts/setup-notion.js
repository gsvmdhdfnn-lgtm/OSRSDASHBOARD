// One-off: creates the three Notion databases the app stores its data in.
//
//   NOTION_TOKEN=secret_xxx NOTION_PARENT_PAGE_ID=xxxx npm run setup-notion
//
// The parent page must already be shared with your Notion integration.
import { notion } from '../lib/notion.js';

// Accepts a bare id, a dashed id, or the whole page URL.
const parent = (process.env.NOTION_PARENT_PAGE_ID || '').split(/[?#]/)[0].replace(/-/g, '').match(/[0-9a-f]{32}$/i)?.[0];
if (!process.env.NOTION_TOKEN || !parent) {
  console.error('Set NOTION_TOKEN and NOTION_PARENT_PAGE_ID (the 32-character id at the end of the page URL).');
  process.exit(1);
}

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const databases = {
  NOTION_HOURS_DB: {
    title: 'Weekly hours',
    properties: {
      Name: { title: {} },
      Day: { select: { options: days.map((name) => ({ name })) } },
      From: { rich_text: {} },
      To: { rich_text: {} },
    },
  },
  NOTION_TIMEOFF_DB: {
    title: 'Time off',
    properties: {
      Name: { title: {} },
      Date: { date: {} },
    },
  },
  NOTION_BOOKINGS_DB: {
    title: 'Bookings',
    properties: {
      Name: { title: {} },
      Email: { email: {} },
      Start: { date: {} },
      Notes: { rich_text: {} },
      Status: { select: { options: [{ name: 'Confirmed', color: 'green' }, { name: 'Cancelled', color: 'red' }] } },
      Seen: { checkbox: {} },
    },
  },
};

console.log('Creating databases…\n');
for (const [envName, { title, properties }] of Object.entries(databases)) {
  const db = await notion('/databases', {
    method: 'POST',
    body: {
      parent: { type: 'page_id', page_id: parent },
      title: [{ type: 'text', text: { content: title } }],
      properties,
    },
  });
  console.log(`${envName}=${db.id.replace(/-/g, '')}`);
}
console.log('\nAdd the lines above to your Vercel environment variables.');
