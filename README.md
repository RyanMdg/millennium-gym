# Millennium Gym — Check-in System

Paperless check-in for members and guests. React + Tailwind + Supabase.

## How it works

**Front desk:** a tablet shows `/kiosk` (log in as admin). It displays a QR code that changes every 60 seconds,
plus a live feed of who just checked in. A scanned code stays valid for 10 minutes, so a photo of an old QR won't work.

**Members:** scan the QR. If you're not logged in yet, log in once; the phone stays logged in, so after that
one scan checks you in. An expired membership shows a modal with "Pay monthly fee" (GCash receipt upload, or
pay over the counter). Scanning twice within 3 hours doesn't create a duplicate log entry.

**Guests:** scan the QR, tap *Guest*, enter your name, and either upload a GCash receipt or tick *Pay over the counter*.
The phone shows "Almost in" until staff approve, then switches to "You're in" with a ticking clock (proof it isn't a screenshot).

**Admin (`/admin`):**
| Page | What it's for |
|---|---|
| Dashboard | Check-ins today, sales today, active members, pending approvals, expiring this week, live check-ins |
| Approvals | Verify GCash receipts / cash for new members, renewals and guests (updates live) |
| Check-ins | The logbook, with Members / Guests / All tabs, date range, search and CSV export |
| Members | Register members at the desk, renew for cash, disable/enable |
| Activity log | Audit trail: registrations, approvals, renewals, admin sign-ins, settings changes |
| Admins | Create and disable staff accounts |
| Settings | Guest fee, monthly fee, membership length, GCash name/number |

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. **Run the schema:** in the dashboard, open SQL Editor, paste all of `supabase/schema.sql`, and run it.
3. **Deploy the `create-user` edge function.** Admins use it to create member and admin accounts.
   - Dashboard: Edge Functions → *Deploy a new function* → *Via editor*, name it `create-user`, paste `supabase/functions/create-user/index.ts`, deploy.
   - Or with the CLI: `npx supabase functions deploy create-user --project-ref YOUR_REF`
4. **Email confirmation (recommended off):** Authentication → Sign In / Providers → Email → turn off *Confirm email*.
   Members are then logged in right after registering. If you leave it on, members confirm their email first;
   everything else works the same.
5. **Environment:** `cp .env.example .env`, then fill in the URL and anon (publishable) key from Project Settings → API.
6. **Run it:** `npm install && npm run dev`
7. **Make yourself the first admin:** register at `/register` (or add a user under Authentication → Users), then in the SQL Editor:
   ```sql
   update profiles set role = 'admin', status = 'active' where email = 'you@example.com';
   delete from payments where user_id = (select id from profiles where email = 'you@example.com');
   ```
   After this, create any other admins from the **Admins** page.
8. Open **Settings**, set your prices and GCash number, then open **Open kiosk QR** on the front-desk tablet.

## Deploying

Works on Vercel or Netlify as-is (`vercel.json` and `public/_redirects` handle SPA routes). Add the two
`VITE_` env vars in the host, and set Supabase → Authentication → URL Configuration → Site URL to your domain.

> Testing on phones over your LAN with `npm run dev` works (the server listens on all interfaces), but phones need
> to reach the kiosk's origin. Production should use HTTPS.

## Project layout

```
supabase/schema.sql                 tables, RLS, check-in / approval functions, storage bucket, realtime
supabase/functions/create-user      edge function (admin-only account creation)
src/pages/CheckIn.jsx               QR landing: member auto check-in, guest flow, expired modal
src/pages/Kiosk.jsx                 rotating QR + live feed for the front desk
src/pages/admin/*                   admin dashboard pages
```

All writes go through Postgres functions (`member_check_in`, `guest_check_in`, `admin_review_payment`, …),
which check permissions and write the activity log. The browser can't change memberships or payments directly.
