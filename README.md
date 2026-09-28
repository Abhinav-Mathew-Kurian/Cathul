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
