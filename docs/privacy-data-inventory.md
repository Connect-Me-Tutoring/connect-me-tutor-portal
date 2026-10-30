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

Question for counsel: _"As a 501(c)(3) tutoring nonprofit with under-13 students, are we
exempt from COPPA and state privacy laws at our size, and is our privacy policy
accurate?"_

## What is in place

- **Parental consent for under-13 students is collected at intake**, outside the
  portal, before an admin adds the student. The portal keeps no consent record of its
  own; the intake forms are the record. `parental_consents` holds only rows from the
  retired emailed approval link (`lib/consent/`).
- **Public signup off:** prod Supabase has `disable_signup: true`, and the OTP pages
  pass `shouldCreateUser: false`. Accounts come only from admin invites.
- **Login pages don't reveal which emails exist:** they show a generic "If an account
  exists…" message.
- **Privacy Policy** at `/privacy`, linked from login and set-password.

## Personal data by table

| Table                                                                                     | Personal data                                                                                                                                                 | Notes                                  |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `Profiles`                                                                                | first/last name, email, phone_number, date_of_birth, age, grade, gender, timezone, languages_spoken, subjects_of_interest, availability, student_number, role | Core account record                    |
| `Profiles` (parent fields)                                                                | parent_name, parent_phone, parent_email                                                                                                                       |                                        |
| `Profiles.subject_embed`                                                                  | vector derived from interests                                                                                                                                 | Derived data                           |
| `Profiles.ai_tutor_chatlogs`                                                              | —                                                                                                                                                             | Column exists but is unused by the app |
| `parental_consents`                                                                       | parent email/name, child first name, IP and user agent at approval                                                                                            | Retired email-link flow only           |
| `user_settings`, notification settings tables                                             | email, preferences                                                                                                                                            |                                        |
| `Sessions`                                                                                | ids, date, duration, summary, session_exit_form, concern flag                                                                                                 | Free text                              |
| `Enrollments`, `Pairings`, `pairing_*`, `weekly_meeting_schedules`, `User_Availabilities` | relationships, schedules, notes                                                                                                                               |                                        |
| `Meetings`                                                                                | Zoom link, meeting id, password                                                                                                                               |                                        |
| `zoom_participant_events`                                                                 | Zoom display name, email, join/leave times                                                                                                                    | From Zoom webhooks                     |
| `messages`, `conversations`, `conversation_participant`                                   | chat content and attachments                                                                                                                                  |                                        |
| `discord_chatbot_conversations`                                                           | —                                                                                                                                                             | Table exists but is unused by the app  |
| `emails`                                                                                  | recipient, subject, rendered content                                                                                                                          | Log of sent email                      |
| `Notifications`, `Requests`, `Forms`, `Events`                                            | reschedule requests, forms, hours                                                                                                                             |                                        |

## Processors

- **Supabase:** database, auth, storage
- **Vercel:** hosting
- **PostHog:** browser pageviews, autocapture, exceptions; server error logs; and
  server-side deletion audit events. Deletion events include the acting account/profile
  identifiers and a snapshot of the deleted enrollment, session, pairing, event, or
  profile. Profile audit events retain only name and email; enrollment audit events retain
  date, duration, and the student/tutor names and emails; pairing audit events retain only
  the student/tutor names and emails. No `identify` call is made in the browser, but server
  events can be linked to account identifiers and error contexts can include account
  emails. The exact audit schema is documented in `docs/posthog-deletion-audit.md`.
- **Zoom:** sessions and participant webhooks
- **Resend:** transactional email
- **Google Gemini:** via Mastra, used by the tutor-only AI assistant at
  `/dashboard/ai-chatbot` (its nav link is currently commented out). Students don't
  use it.

## Deferred (revisit if counsel says these laws apply, or as we grow)

- Data processing agreements with each processor.
- A written retention schedule, including how long intake consent forms are kept.
- Terms of Service page (the placeholder was removed so it doesn't ship half-written).
