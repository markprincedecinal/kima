# Deploying the RSVP backend (Cloudflare D1 + Pages Functions)

I can't deploy this from here — Cloudflare's API isn't reachable from my sandbox — but everything below is copy/paste-ready. You'll need a free Cloudflare account and Node.js installed locally.

## 1. Project layout

Put these files together like this (the `debut.html`, `rsvp.html`, `confirmation.html`, and portrait images all go in the project root alongside `wrangler.toml`):

```
your-project/
├── wrangler.toml
├── schema.sql
├── debut.html
├── rsvp.html
├── confirmation.html
├── gwen-portrait.jpg
├── gwen-portrait-2.jpg
└── functions/
    └── api/
        ├── rsvp.js
        ├── checkin.js
        └── rsvp/
            └── [token].js
```

## 2. Install Wrangler (Cloudflare's CLI)

```bash
npm install -g wrangler
wrangler login
```

## 3. Create the D1 database

```bash
wrangler d1 create debut_rsvp_db
```

This prints a `database_id` — copy it into `wrangler.toml`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

## 4. Apply the schema

```bash
wrangler d1 execute debut_rsvp_db --file=./schema.sql --remote
```

## 5. Deploy to Cloudflare Pages

```bash
wrangler pages project create gwyneth-debut-rsvp
wrangler pages deploy . --project-name=gwyneth-debut-rsvp
```

Then bind the D1 database to your Pages project (Dashboard → your Pages project → Settings → Functions → D1 database bindings → add binding named `DB` pointing at `debut_rsvp_db`). This is what makes `env.DB` available inside the `functions/api/*.js` files.

Redeploy once after adding the binding so it takes effect.

## 6. Test it

- Visit `your-project.pages.dev/rsvp.html`, submit with "Yes, I will attend" — you should land on `confirmation.html` with a QR code.
- Submit with "No, I can't make it" — you should see the inline thank-you message instead (no QR).
- Check the data landed in D1:

```bash
wrangler d1 execute debut_rsvp_db --command="SELECT full_name, attendance, guests_count, qr_token, checked_in FROM rsvps;" --remote
```

## 7. Checking guests in at the venue

`POST /api/checkin` with `{ "token": "<the scanned QR value>" }` marks a guest as checked in and rejects a second scan of the same code. You'll need a scanning tool on the night — the simplest option is a phone QR scanner app that opens a small web page you build later which reads the camera, extracts the token, and calls this endpoint. That's a separate small project; happy to build it when you're ready.

## A note on the QR content

The QR code encodes the guest's `qr_token` (a random UUID) — nothing else. Door staff's scanning tool sends that token to `/api/checkin`, which looks it up in D1. Storing the token rather than a rendered image keeps the database small and means the QR can always be regenerated on demand from the source of truth.
