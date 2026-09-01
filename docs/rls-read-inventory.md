# Who reads what: an inventory for the read policies

The baseline schema granted every signed-in user `SELECT` on the operational
tables through `TO authenticated USING (true)`. That is not authorization. It
means any tutor or student can read every row over the Data API regardless of
what the page in front of them shows, because the page is not what guards the
data.

Replacing those policies safely needs an inventory first, because several
legitimate features read rows that do not belong to the caller. This file is
that inventory and the record of what has been scoped so far.

A read only matters here if it goes through the caller's own session. Reads
made with `createAdminClient()` use the service-role key and bypass row-level
security entirely, so they neither constrain nor benefit from any policy.

## Scoped already

`supabase/migrations/20260831120000_scope_operational_table_reads.sql`

| Table                 | Who may read                                | Why that is safe                                                                                                                                                                         |
| --------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Pairings`            | the pairings you are in, or an active admin | Every non-admin read is already self-scoped: the tutor's student list filters on their own id, the chat gate rejects non-participants, and the account-pairings function filters in SQL. |
| `pairing_matches`     | the matches you are in, or an active admin  | A tutor opens their own match; the matching engine reads these under the service role.                                                                                                   |
| `pairing_requests`    | your own request, or an active admin        | The one non-admin read is a person fetching their own queue entry.                                                                                                                       |
| `pairing_logs`        | active admins only                          | An audit view with no per-user notion of "mine". Students and tutors still write to it when they enter the queue or answer a match, and their insert policy is untouched.                |
| `User_Availabilities` | active admins only                          | Nothing in the application reads this table from any client. The availability shown in the interface comes from a column on `Profiles`.                                                  |

`public.my_profile_ids()` backs the first three. One person may hold several
profiles under a single login, so "mine" means every profile sharing their
user id, not just the active one. It is security definer so that scoping
`Profiles` later cannot make it recurse through a policy that calls it.

## Not scoped yet, and why

`Profiles` and `Sessions` both carry cross-user reads that a naive
own-rows-only policy would break. Each needs a change in the code that reads
it before the policy can narrow.

**Profiles**

1. Every signed-in user reads all admin profiles to label messages in pairing
   chats, announcements and admin conversations.
2. A tutor reads the full profile of every student paired with them.
3. A tutor or student reads the other party of any pairing, enrollment or
   session they belong to. This one is pervasive: the counterpart profile is
   embedded in almost every session query in the app.
4. People with several profiles read their siblings under the same user id.
   A policy written against the active profile id alone would break the
   profile switcher, and with it the helper that every other guard is built
   on.

**Sessions**

5. The reschedule and edit-session dialogs read other people's sessions in a
   twelve-hour window to decide whether a Zoom room is already booked.
   Own-rows-only would hide the conflicts and turn them into double bookings.
   A narrow security-definer function returning room occupancy, rather than
   rows, would let the policy narrow.
6. The student dashboard reads sessions unfiltered today. It very likely only
   needs its own, but it is written against global data and needs checking
   before the policy decides for it.

## Fixed alongside, because scoping would have exposed them

Three reads ran through a session client where no session exists, or none was
checked. Each would have started returning nothing the moment a policy
narrowed, and two of them would have failed silently.

- The user-growth metrics action read role, status and creation date for every
  profile with no authorization check at all, and the page rendering it sits
  outside the admin route group. Both now require an active admin.
- The session-reminder email route authenticates with a bearer token rather
  than a user session, so it now uses the service-role client.
- The pairing workflow's rejected-tutor lookup runs from cron as well as from
  the admin interface. It was the one read in that workflow still using a
  session client, and an empty exclusion list degrades match quality without
  raising anything. It now uses the service-role client like the rest.

## A caveat about route groups

The `(admin)`, `(tutor)` and `(students)` folders carry no role guard of their
own; their layouts render their children unchanged. A folder name is not a
permission. What actually protects an admin page is the guard inside the
server action it calls, or row-level security when the page reads from the
browser. Several admin screens read through the browser client with no server
guard at all, so for those the policies in this migration are the only control.

## Running the tests

```sh
bash scripts/db-access-tests.sh
```

It builds a throwaway Postgres from the migrations as they will exist once
this branch merges, then asserts what each class of caller may do: anonymous,
student, tutor, inactive admin, active admin, and service role. The
expectations live in `supabase/tests/access_controls.sql`.
