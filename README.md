# Cathul

Athul & Catherine's wedding invitation — a single-page, illustrated Next.js site with Our Story, The Celebrations, RSVP, Gallery, and Music sections.

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view it.

Copy `.env.example` to `.env.local` and fill in `MONGODB_URI`/`MONGODB_DB` to enable RSVP storage (falls back to a local file otherwise).

To see RSVPs live in a Google Sheet, follow the setup steps at the top of `scripts/google-sheets-rsvp.gs` and set `GOOGLE_SHEETS_WEBHOOK_URL`/`GOOGLE_SHEETS_WEBHOOK_SECRET`.

Guests can leave wishes in the "Wishes & Blessings" section (public on the wall, or private to the couple). They're stored in the `wishes` collection of the same MongoDB database. Each new wish is also copied to a **Wishes** tab in the Google Sheet (with a Hidden column kept in sync) once the updated `scripts/google-sheets-rsvp.gs` is deployed — until then wishes simply aren't copied, and RSVPs keep working. With `RSVP_EXPORT_KEY` set, the couple can open `/wishes-admin?key=<that key>` to read every wish (private ones included) and hide or restore public ones.

The same key opens `/analytics-admin?key=<that key>`: how many people have visited (counted once per device), visits per day, where they're from, how they found the link, how far down the invitation they read, and how many went on to RSVP or leave a wish. Visits are stored in the `visits` collection — no cookies, and no IP addresses are kept (towns come from Vercel's location headers, so they show as "Unknown" locally). To tell shared links apart, add `?src=<name>` (e.g. `?src=family-group`). Tick "Don't count my visits" on the dashboard on each of your own devices.
