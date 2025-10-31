# PantryClerk

This app lists community offerings using SvelteKit + Bulma. It now includes a local SQLite database and a form to add new businesses.

## Prerequisites
- Node 18+
- macOS/Linux/WSL recommended for native `sqlite3` builds (Windows also works).

## Setup
1. Install dependencies:
   ```bash
   npm i
   ```
2. Create/upgrade the SQLite database schema:
   ```bash
   npm run db:migrate
   ```
   This creates `var/data/pantryclerk.db` (ignored by git).

## Development
Start the dev server:
```bash
npm run dev
```

Open:
- Home page: http://localhost:5173/

## Add Business Form
The form captures the Business model:
- name (required)
- phone (optional)
- address (required)
- mapUrl (optional; built from address if omitted)
- offering (required)
- availability (optional)
- zip (optional; exactly 5 digits; extracted from address if omitted)
- url (optional)
- type (optional)
- social (optional JSON). Accepts:
  - Array of strings or entries: `["https://x.com/org", {"platform":"instagram","url":"https://instagram.com/org"}]`
  - Object map: `{ "instagram": "https://instagram.com/org" }`

On submit, the server validates and inserts into SQLite. If the `(name,address)` pair already exists, the insert is ignored by the DB unique constraint.

## Database
- File: `var/data/pantryclerk.db`
- Table: `businesses`
  - Indexed columns: `zip`, `type`
- You can re-run `npm run db:migrate` anytime; it is idempotent.

## Notes
- The home page now reads from the SQLite database via a server-side loader. The static JSON remains only as a seed source.
- Bulma is loaded via CDN in `src/app.html`.

## Edit or Delete a Business
- From the home list, click the Edit button on any card.
- URL format: `/business/<id>/edit`
- On the edit page you can:
  - Update any field and click "Save changes" to persist.
  - Add/remove Social rows. Enter a full URL or a handle like `@org` or `org`; the server will build proper links for known platforms.
  - Delete the record with the red Delete button (confirmation required). After deletion you are redirected to the home page.
