# Privacy data inventory

What the portal stores and who processes it. Keep this in sync with
`app/(public)/privacy/page.tsx`. Derived from `supabase/migrations/` and the app
code; verify against the live database, since prod migrations have drifted.

## Legal position (to confirm with counsel)

Connect Me is a 501(c)(3). Our understanding, not yet confirmed by a lawyer:

- **COPPA** likely does not apply by law. The FTC Act does not reach genuine
  nonprofits. We follow it anyway: our public policy promises parental consent for
  children under 13, and that promise has to be true.
- **State privacy laws** that cover nonprofits (CO, OR, DE, MD, MN, NJ) only apply
  above per-state thresholds of roughly 35k–100k residents. California's applies only to
  for-profit businesses. Michigan has no comprehensive privacy law.
- **FERPA** applies only if schools share student records with us as a contractor.

Question for counsel: *"As a 501(c)(3) tutoring nonprofit with under-13 students, are we
exempt from COPPA and state privacy laws at our size, and is our privacy policy
accurate?"*

## What is in place

- **Parental consent before an under-13 account exists:** `lib/consent/`,
  `app/(public)/parental-consent/`. The consent record lives in `parental_consents`.
- **Public signup off:** prod Supabase has `disable_signup: true`, and the OTP pages
  pass `shouldCreateUser: false`. Accounts come only from admin invites.
- **Login pages don't reveal which emails exist:** they show a generic "If an account
  exists…" message.
- **Privacy Policy** at `/privacy`, linked from login, set-password, and the consent
  page.

## Personal data by table

| Table | Personal data | Notes |
|---|---|---|
| `Profiles` | first/last name, email, phone_number, date_of_birth, age, grade, gender, timezone, languages_spoken, subjects_of_interest, availability, student_number, role | Core account record |
| `Profiles` (parent fields) | parent_name, parent_phone, parent_email | Consent email goes here |
| `Profiles.subject_embed` | vector derived from interests | Derived data |
| `Profiles.ai_tutor_chatlogs` | — | Column exists but is unused by the app |
| `parental_consents` | parent email/name, child first name, IP and user agent at approval | Child's form data is held only while pending |
| `user_settings`, notification settings tables | email, preferences | |
| `Sessions` | ids, date, duration, summary, session_exit_form, concern flag | Free text |
| `Enrollments`, `Pairings`, `pairing_*`, `weekly_meeting_schedules`, `User_Availabilities` | relationships, schedules, notes | |
| `Meetings` | Zoom link, meeting id, password | |
| `zoom_participant_events` | Zoom display name, email, join/leave times | From Zoom webhooks |
| `messages`, `conversations`, `conversation_participant` | chat content and attachments | |
| `discord_chatbot_conversations` | — | Table exists but is unused by the app |
| `emails` | recipient, subject, rendered content | Log of sent email |
| `Notifications`, `Requests`, `Forms`, `Events` | reschedule requests, forms, hours | |

## Processors

- **Supabase:** database, auth, storage
- **Vercel:** hosting
- **PostHog:** browser pageviews, autocapture, exceptions; server error logs. No
  `identify` call in the browser, but server `logError` contexts can include account
  emails.
- **Zoom:** sessions and participant webhooks
- **Resend:** transactional email
- **Google Gemini:** via Mastra, used by the tutor-only AI assistant at
  `/dashboard/ai-chatbot` (its nav link is currently commented out). Students don't
  use it.

## Deferred (revisit if counsel says these laws apply, or as we grow)

- Backfill parental consent for under-13 students created before the consent flow.
- Data processing agreements with each processor.
- A written retention schedule, plus a cleanup job for expired `parental_consents` rows.
- Terms of Service page (the placeholder was removed so it doesn't ship half-written).
