# VolleyPal — Google Apps Script helpers

Every submission from a Google Form reaches VolleyPal via `/api/form-webhook`.
Apps Script is the glue: an `onFormSubmit` trigger POSTs each response as
JSON with a bearer secret.

## Files

| File | Purpose |
|------|---------|
| [createForm.gs](createForm.gs) | Builds the canonical individual-registration form + attaches the webhook. Run once per tournament. Sends `form_type: "registration"` (default). |
| [createCaptainTeamForm.gs](createCaptainTeamForm.gs) | Alternative captain-fills-for-12-players variant. Sends 12 individual POSTs per submission. Same webhook. |
| [attachFormWebhook.gs](attachFormWebhook.gs) | Drop-in for attaching the registration webhook to a form that already exists (imported from last year, built by a co-organizer, etc.). Sends `form_type: "registration"`. |
| [createWaiverForm.gs](createWaiverForm.gs) | Builds a canonical waiver form when the venue does NOT supply one. Sends `form_type: "waiver"`. |
| [attachWaiverWebhook.gs](attachWaiverWebhook.gs) | Drop-in for attaching the waiver webhook to a form the venue supplied. **Most common waiver-side flow.** |

All five are self-contained — paste one into a new Apps Script project (or
into a form's bound script), set Script Properties, run the installer.

## Script Properties (all four scripts need these)

Set these once per Apps Script project via `File → Project properties → Script properties`:

```
SUPABASE_WEBHOOK_URL = https://<your-app>.vercel.app/api/form-webhook
SHARED_SECRET        = <matches FORM_WEBHOOK_SHARED_SECRET in Vercel env>
TOURNAMENT_ID        = <uuid of the current tournaments row in Supabase>
```

`SHARED_SECRET` must exactly match the `FORM_WEBHOOK_SHARED_SECRET` env var
in Vercel — the webhook rejects any bearer that doesn't `timingSafeEqual`.
The webhook now uses two form types multiplexed onto one endpoint, so the
URL and secret are the same for the registration form and the waiver form.

## Typical setup for a new tournament

1. **Registration form — you're creating one (VolleyPal-authored)**:
   - Copy `createForm.gs` into a new standalone Apps Script project.
   - Set the three Script Properties above.
   - Run `createVolleyPalForm`. The Execution log prints the public URL to
     share with participants and installs the trigger.

2. **Registration form — you already have one**:
   - Open the existing form.
   - `擴充功能 → Apps Script`.
   - Paste `attachFormWebhook.gs`.
   - Set the three Script Properties.
   - Run `installTrigger`. Approve the permission prompt on first run.
   - Verify field titles include `email` (any language) so the waiver-match
     key exists; also `國籍 / nationality` if you want the 10 non-TW quota
     to work — missing nationality defaults everyone to TW.

3. **Waiver form — venue supplies it (common case)**:
   - Open the venue's Google Form.
   - `擴充功能 → Apps Script` (opens a script bound to that form).
   - Paste `attachWaiverWebhook.gs`.
   - Set the three Script Properties.
   - Run `installTrigger`. Approve the permission prompt on first run.
   - Confirm the form asks for **email** — the webhook matches waivers to
     registrations by email. If the form only asks for a name, ask the venue
     to add an email question (or waivers will all land in `pending_waivers`
     for admin to match by hand).

4. **Waiver form — you're creating one**:
   - Copy `createWaiverForm.gs` into a new standalone Apps Script project.
   - Set the three Script Properties.
   - Edit `WAIVER_TEXT` at the top of the file to reflect the actual waiver.
   - Run `createVolleyPalWaiverForm`. Share the public URL alongside the
     registration form URL.

## How form matching works

- Registration webhook → inserts / updates a `registrations` row keyed by
  `(tournament_id, email)`.
- Waiver webhook → looks up `registrations` by lower-cased email. Match
  found = stamps `waiver_signed_at`. No match = row lands in
  `pending_waivers` for admin to manually resolve via
  `/admin/teams` → 「未配對 waiver」section.
- Admin confirms payment (`/admin/teams` → 候補 tab → 確認 button) →
  registrant moves onto the active roster, subject to the total cap and
  the non-Taiwanese sub-cap.

## Smoke testing without a live submission

Each script includes a `testOnFormSubmit` function that POSTs a mocked
event. Select it in the Apps Script editor and click Run. Check:

- Executions log for `2XX` response.
- Supabase `registrations` table (for registration tests) or
  `pending_waivers` / matched row's `waiver_signed_at` (for waiver tests).

## Trigger scope

`removeExistingFormTriggers_()` in each script only removes triggers
pointing at the SAME form as the one being installed. This means the
registration and waiver forms can safely live under separate Apps Script
projects (or even the same project) without wiping each other's triggers.
