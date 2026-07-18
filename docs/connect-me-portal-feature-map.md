# Connect Me Tutor Portal — Requirements ↔ Code Map

This document ties the Connect Me tutor portal **product requirements** (introduction, stack, and requested features) to **where those concerns live in this repository**. It is meant for onboarding and for tracing “does the code satisfy X?” questions.

---

## Development technologies (as stated in the brief)

| Requirement | Where it shows up in this repo |
|-------------|-------------------------------|
| **Next.js** (App Router, server + client components) | App routes under `app/`, API routes under `app/api/`, server actions under `lib/actions/`. |
| **React** | Components under `components/`, pages composed in `app/`. |
| **Tailwind CSS** | `tailwind.config.ts`, utility classes throughout UI; global styles typically in `app/globals.css` (if present). |
| **shadcn/ui** | Radix-based primitives under `components/ui/`; project config in `components.json`. |
| **Supabase** (Postgres + client) | `lib/supabase/` (client/server helpers), `supabase/migrations/` (schema and RPCs), typed tables in `lib/supabase/tables.ts`. |
| **Vercel** | Typical Next.js deployment target; `@vercel/speed-insights` in `package.json`. Hosting config is environment-specific (not always checked into the repo). |

---

## Current state (sessions, hours, rescheduling, admin consolidation)

High-level behavior is summarized in `README.md`. Concrete implementation areas:

- **Sessions & scheduling**: `components/admin/ScheduleManagement.tsx`, `lib/actions/admin.actions.ts` (`updateSession`, `addOneSession`, etc.), `lib/actions/session.actions.ts`.
- **Volunteer / session hours**: flows tied to session completion (e.g. exit forms) and admin hours views — see `README.md` admin section and `lib/actions/hours.actions.ts` references.
- **Rescheduling**: tutor-facing reschedule UI such as `components/tutor/components/RescheduleDialog.tsx` and related session actions.

---

## Requested features (priority order in the original brief)

Below, each item lists **what exists in code**, **key files**, and **notable gaps** relative to the full vision in the requirements text.

### 1. Timestamp Zoom (join/leave → Supabase; verify attendance; export)

**Implemented (core path)**

- **Webhook ingestion**: Primary handler `app/api/zoom/webhooks/route.ts` (Zoom events such as `meeting.participant_joined` / `meeting.participant_left`). There is also `app/api/zoom/route.ts` for a simpler event switch.
- **Persistence**: `lib/actions/zoom.server.actions.ts` — `logZoomMetadata`, `updateParticipantLeaveTime`, and related helpers insert into Supabase table **`zoom_participant_events`** (see migrations under `supabase/migrations/` for `zoom_participant_events`, including UUID typing such as `20260407140000_zoom_participant_events_meeting_uuid_to_text.sql`).
- **Session linkage**: Events store `session_id` when resolvable plus `zoom_meeting_uuid` for correlation (`resolveAppSessionIdForZoomEvent` in the same actions file).
- **Verification UI**: Participation views use `getParticipationData` in `lib/actions/session.server.actions.ts`; per-session page `app/(protected)/dashboard/session/[sessionID]/participation/page.tsx` loads events and summaries.
- **Spreadsheet export**: The participation page builds an **Excel** workbook (`.xlsx`) via `exceljs` — participant summaries and an activity timeline. Plain **`.txt`** export is not the primary path here; CSV/txt could be added alongside the existing download logic.

**Gaps / notes**

- Organization-wide “all 10 Zoom links” rollups and a single admin export across every link would be **additional** reporting or SQL/API work on top of per-session participation.
- Ensure Zoom app webhook URLs and event subscriptions match production (`meeting.participant_*`).

---

### 2. Option to edit session length & frequency (admin)

**Implemented**

- **Enrollment model**: `types/enrollment.ts` includes `duration` and related fields; `lib/actions/enrollment.server.actions.ts` reads/writes `duration`, `frequency`, etc.
- **Admin UI**: `components/admin/EnrollmentsManagement.tsx` — validation (`durationSchema`), defaults such as `duration: 1`, `frequency: "weekly"`, and controls to change frequency when creating/editing enrollments.

**Gaps / notes**

- Defaults are oriented to **weekly / 1-hour** style programs; multi-session-per-week programs are supported at the **enrollment** level where the UI exposes `duration` / `frequency`. Any remaining hard-coded assumptions elsewhere should be checked when onboarding new program types.

---

### 3. “Shared resources” tab (tutor ↔ student, Drive, links, retention after unpair)

**Partially implemented**

- **Curated org resources**: Static lists such as `constants/tutor.ts` (`tutorResources`) and UI `components/tutor/ResourceList.tsx` (handbook/manual cards, etc.). Route: `app/(protected)/dashboard/(tutor)/resources/page.tsx`.

**Not implemented as described in the brief**

- Per-pairing **student ↔ tutor** shared folders, **Google OAuth** to Drive, or **student-uploaded homework** stored for the tutor with guaranteed retention after pairing end would require new tables, storage buckets, and auth scopes — not present as a full feature in the paths above.

---

### 4. Editing availability, preferred subjects, and languages (profile)

**Implemented**

- **Types**: `types.d.ts` — `Profile` includes `availability`, `subjects_of_interest`, `languages_spoken`, `timeZone`.
- **Self-serve profile**: `app/(protected)/dashboard/profile/page.tsx` (availability slots, subjects, languages).
- **Reusable editor**: `components/profile/profile-editor.tsx`.
- **Server updates**: `lib/actions/profile.actions.ts` (`updateProfileDetails` and related).
- **Admin editing**: `components/admin/components/CondensedProfileForm.tsx` and flows in admin enrollment/tutor forms.

---

### 5. Suggested pairings (language → time → subjects priority)

**Implemented (database + automation)**

- **Ranked candidate list (SQL)**: `public.lookup_proposed_matches` and `public.lookup_proposed_matches_static` — migrations such as `supabase/migrations/20260403120000_lookup_proposed_matches.sql`, refined in `20260408120000_pairing_subject_priority_alignment.sql` and `20260408130000_subject_alignment_json_output.sql`. Scoring uses **pairing queue priority** plus **priority-ordered subject alignment** (`pairing_subject_priority_alignment`).
- **Batch / worker matching**: `lib/pairing/index.ts` calls Supabase RPC **`get_best_match`** to propose pairings for queued requests.
- **Client pairing UX**: `components/pairing/pairing-interface.tsx`, `lib/actions/pairing.actions.ts` (`getAllPairingRequests`, `getIncomingPairingMatches`, pairing request tables via `pairing_requests`).
- **Performance / demos**: `scripts/lookup-proposed-matches-perf/` (benchmarks, JSON fixtures, `package.json` scripts `perf:lookup-matches`, `demo:lookup-matches`, etc.).

**Gaps / notes**

- The **written priority** in the requirements (“common language, then time availability, then subjects”) is a **product ordering**. The **implemented** `lookup_proposed_matches` logic (see migration comments) combines **queue priority** and **subject alignment**; **explicit language-overlap and availability-overlap terms** in the same ranking function should be verified against product intent—some of that may live in **`get_best_match`** (RPC defined in Supabase, not fully inlined in this repo’s migrations) or in overlap helpers used during enrollment (`getOverlappingAvailabilites` in `lib/actions/enrollment.actions.ts`).

---

### 6. Built-in messaging (tutor ↔ student ↔ admin; unread alerts; broadcast)

**Implemented (core)**

- **UI**: `components/chat/chat-room.tsx` — inserts into Supabase **`messages`**, file upload hooks, modes such as `pairing` and `admin`.
- **Routes**: e.g. `app/(protected)/dashboard/enrollment/[id]/chat/page.tsx`, `app/(protected)/dashboard/chats/[id]/page.tsx`, `app/(protected)/dashboard/(admin)/announcements/page.tsx`.
- **Supporting actions**: `lib/actions/chat.actions.ts`, `lib/actions/chat.server.actions.ts`.

**Gaps / notes**

- **15-minute / 24-hour unread** email/SMS escalations and **admin broadcast to all tutors/students** with push-to-SMS/email are **not fully evidenced** as end-to-end automations in the snippets above; they would extend the current `messages` + notifications stack.
- Some chat pages still use **placeholder or minimal initial state**; confirm auth wiring and room IDs per environment.

---

### 7. Embedded Zoom meetings (“Client View” in portal)

**Partial / exploratory**

- **Meeting shell**: `app/(protected)/meeting/[meetingId]/page.tsx` — loads `Meeting` via `getMeeting`, primary UX is **open join link in a new tab** and copy link.
- **Embedded SDK**: A **commented-out** block shows the intended `@zoomus/websdk/embedded` flow (signature via `/api/zoom`). The live page explicitly leaves a placeholder for re-integration.

**Gap**

- **Full in-portal embed** per Zoom’s React sample is **not active**; production behavior is **external Zoom client** via link.

---

### 8. Time zone handling (fix “workaround” timestamps)

**Implemented**

- **Profile time zone**: `Profile.timeZone` / stored `timezone` mapping in `lib/type-utils.ts`, selectors like `components/admin/components/components/TimezoneSelector.tsx`.
- **Session week generation**: `lib/actions/session.actions.ts` and `app/api/sessions/update-week/route.ts` use **`date-fns-tz`** (`fromZonedTime`) when building session instants; comments note interaction with local `setHours` / `setMinutes`.
- **Admin**: `lib/actions/admin.actions.ts` also imports `fromZonedTime` from `date-fns-tz`.

**Gap**

- The requirements call out **non-optimized** workaround code; improving this means refactoring the session-generation paths above for consistent **UTC storage** and explicit **IANA zone** conversion in one place (and regression tests around DST).

---

### 9. Text reminder system (SMS, toggle)

**Implemented (infrastructure)**

- **Twilio**: `lib/twilio/index.ts` — `scheduleReminderSMS`, `scheduleMultipleSessionReminders`, cancellation helpers.
- **Call sites**: e.g. `lib/actions/session.server.actions.ts` imports `scheduleMultipleSessionReminders`; `lib/actions/admin.actions.ts` references the same module.
- **User toggles**: `components/settings/SettingsPage.tsx` includes **`sessionTextNotifications`** (and related switches) backed by settings state.

**Gaps / notes**

- Wire **settings** to Twilio scheduling everywhere sessions are created/updated so “off” truly suppresses SMS; confirm production **cron** or QStash jobs for reminder batches (`lib/actions/email.actions.ts` / `email.server.actions.ts` patterns for email can mirror SMS).

---

## Quick reference: feature → primary locations

| Feature area | Primary paths |
|--------------|----------------|
| Zoom timestamps & DB | `app/api/zoom/webhooks/route.ts`, `lib/actions/zoom.server.actions.ts`, `supabase/migrations/*zoom_participant*` |
| Participation report | `app/(protected)/dashboard/session/[sessionID]/participation/page.tsx` |
| Duration / frequency | `components/admin/EnrollmentsManagement.tsx`, `lib/actions/enrollment.server.actions.ts` |
| Profile fields | `app/(protected)/dashboard/profile/page.tsx`, `lib/actions/profile.actions.ts` |
| Pairing SQL | `supabase/migrations/20260408120000_pairing_subject_priority_alignment.sql`, `20260408130000_subject_alignment_json_output.sql` |
| Pairing app logic | `lib/pairing/index.ts`, `lib/actions/pairing.actions.ts`, `components/pairing/` |
| Chat | `components/chat/chat-room.tsx`, `app/(protected)/dashboard/**/chat/` |
| Embedded Zoom | `app/(protected)/meeting/[meetingId]/page.tsx` (commented SDK) |
| Time zones | `lib/actions/session.actions.ts`, `app/api/sessions/update-week/route.ts` |
| SMS | `lib/twilio/index.ts`, `components/settings/SettingsPage.tsx` |

---

## Related: Docker / local tooling

Container definitions (`Dockerfile`, `docker-compose.yml`) and performance scripts under `scripts/lookup-proposed-matches-perf/` support **local benchmarking** and parity checks for matching RPCs; they are not required for production Vercel hosting but document how matching behavior is validated offline.
