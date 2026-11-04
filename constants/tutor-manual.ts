import { z } from "zod";

// The Tutor Portal Manual (/dashboard/manual). Admins edit it in the portal; every save is
// stored as a new row in tutor_manual_versions and the newest row is what tutors see. Until
// an admin saves for the first time, the page shows DEFAULT_TUTOR_MANUAL_SECTIONS.
// Section bodies are Markdown (GitHub-flavoured, so tables work). Links that start with "/"
// stay in the portal; anything else opens in a new tab. A "> quote" renders as a callout.

export const TUTOR_MANUAL_LIMITS = {
  sections: 50,
  title: 120,
  body: 20_000,
} as const;

export const tutorManualSectionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Every section needs a title")
    .max(TUTOR_MANUAL_LIMITS.title, `Keep titles under ${TUTOR_MANUAL_LIMITS.title} characters`),
  body: z
    .string()
    .max(
      TUTOR_MANUAL_LIMITS.body,
      `Keep each section under ${TUTOR_MANUAL_LIMITS.body} characters`,
    ),
});

export const tutorManualSchema = z.object({
  sections: z
    .array(tutorManualSectionSchema)
    .min(1, "The manual needs at least one section")
    .max(
      TUTOR_MANUAL_LIMITS.sections,
      `The manual can have at most ${TUTOR_MANUAL_LIMITS.sections} sections`,
    ),
});

export type TutorManualSection = z.infer<typeof tutorManualSectionSchema>;

export interface TutorManual {
  sections: TutorManualSection[];
  /** Null while the built-in default is showing (no admin has saved yet). */
  updatedAt: string | null;
  updatedByName: string | null;
}

/** Stable, unique anchor ids for the table of contents. */
export function tutorManualSectionIds(sections: Pick<TutorManualSection, "title">[]) {
  const seen = new Map<string, number>();
  return sections.map((section) => {
    const base =
      section.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  });
}

const LINKS = {
  welcomeTemplate:
    "https://docs.google.com/document/d/19I-JABrf7u2UHb-v8rZLx4aQ6z9QKaNQ7LCmxtvWODk/edit",
  starterPacket:
    "https://docs.google.com/document/d/1eVQPX2Rjx-b5n93070zHjXSMpzBs0twwGpRPAOYmHec/edit?tab=t.0#heading=h.vrhvb96nxxe9",
  hoursVerification: "https://forms.gle/dqZ822Wj5zeC1eWa8",
};

export const DEFAULT_TUTOR_MANUAL_SECTIONS: TutorManualSection[] = [
  {
    title: "Welcome",
    body: `Everything you need to get set up, get paired with a student, and run your sessions each week.

Can't find what you need? Use **Get Help** in the sidebar menu or contact a Connect Me Board member on Remind or Discord.`,
  },
  {
    title: "Signing up and logging in",
    body: `### Sign up

1. Within 1–2 days of joining the Discord, you'll receive a sign-up link by email. Check your spam folder too.
2. Open the link and set your password (enter it twice to confirm).
3. Never got the email? Contact a Connect Me Board member on Remind or Discord.

### Forgot your password

1. On the login page, click **Forgot Password?**
2. Enter the email address on your account.
3. Enter the **6-digit code** we email you on the **Enter Verification Code** screen.
4. Once the code is accepted, set a new password.

> If the code doesn't arrive, wait a minute and request a new one. For security, the portal shows the same message whether or not an account exists for that email.`,
  },
  {
    title: "Orientation",
    body: `New tutors complete orientation before the rest of the portal unlocks. Until you finish, **Orientation** is the only item in the sidebar.

| Module | What it covers |
| --- | --- |
| **Orientation slideshow** | Connect Me policies, expectations, and FAQs. |
| **Portal walkthrough** | A guided practice tour with sample data. Nothing you do here affects real sessions. |
| **Experienced Tutor Examples** | Real tutoring moments: spot effective teaching moves and reflect on how you'd use them. |
| **Knowledge check** | A short quiz. You can retry a question until you get it right, and send questions to the Operations team at the end. |

**Finishing the quiz unlocks the full portal.** You can reopen the portal walkthrough any time from [Settings](/dashboard/settings) → Orientation resources.`,
  },
  {
    title: "Getting a student",
    body: `### Step 1: Complete your profile

Matching is based on your availability, subjects, and languages, so keep these up to date. Open [Profile](/dashboard/profile) (or **Edit profile settings** on the right side of the Pairings tab) and add your availability, subjects of interest, and languages spoken.

### Step 2: Join the pairing queue

1. Go to [Pairings](/dashboard/pairings).
2. Optionally, add notes about your goals, preferred subjects, or requirements.
3. Turn on **In pairing queue**. While it's on, you can be matched.
4. To pause without losing your notes, turn it off. Turn it back on to rejoin with the same preferences.

### Step 3: Accept or decline a match

Matches appear under **Incoming pairings**, showing the student's subjects, languages, and availability. Click **Accept** if the student is a good fit, or **Decline** if not (for example, if your schedules don't line up).

> **What happens when you accept:** an enrollment (a recurring weekly session at a time within both your availability and the student's) is created automatically, a Zoom link is assigned, and the parent/guardian is emailed the date, time, and Zoom link. If the time doesn't work, agree on another with the parent and change it in [My Enrollments](/dashboard/my-enrollments).

### Step 4: Text the parent/guardian

You **must** send a welcome message introducing yourself as their child's tutor. Use the [welcome message template](${LINKS.welcomeTemplate}). Parent contact details are on [My Students](/dashboard/my-students).

### Step 5: Read the Starter Packet

Read the [Connect Me Tutor Starter Packet](${LINKS.starterPacket}) carefully before your first session. The **Tutor Handbook** on [Resources](/dashboard/resources) is also required reading.`,
  },
  {
    title: "Your weekly routine",
    body: `1. **Before the session:** check the [Dashboard](/dashboard) for this week's time and Zoom link.
2. **Join** by clicking **Meeting** on the session, then **Join Meeting**.
3. **After the session:** submit the Session Exit Form (SEF) within 48 hours.
4. **If something changes:** reschedule, request a substitute, or cancel from the Dashboard.

> **Always join Zoom through the portal.** Zoom links are booked for specific time slots, so don't reuse a link at a different time without rescheduling in the portal first. On the meeting page you can also **Copy Meeting Link** to share it.`,
  },
  {
    title: "Session Exit Forms",
    body: `**You only receive volunteer hours for sessions with a submitted SEF.**

The SEF button unlocks once the session's start time has passed. It's due **by 11:59pm EST, two days after the session**, and counts down for you:

| Button says | Meaning |
| --- | --- |
| SEF Due MM/DD (grey) | More than 2 days left |
| SEF Due in 2 days (yellow) | 2 days left |
| SEF Due Tomorrow (orange) | Due tomorrow |
| SEF Due TODAY by 11:59pm EST (red) | Last day to submit on time |
| Submit overdue SEF (dark grey) | Late, but you can still submit it |
| SEF Submitted (green) | Done |

### Filling out the SEF

- In 2–4 sentences, describe what you covered.
- Check **My student knows about our next class** (required).
- Have a **question or concern**? Check that box, pick a category (Attendance & Engagement, Technical and Portal Issues, Student Behavior and Support, or Urgent Escalation), and describe it. The team will follow up.
- Session didn't happen? Click **The session did not happen** at the top of the form and choose a reason.

### Late or mistaken SEFs

- **Missed the deadline?** The session is marked *Unconfirmed*, but you can still click **Submit overdue SEF** under Past Sessions and earn the hours.
- **Made a mistake?** Under Past Sessions, open the session's actions and click **Undo** to reopen it, up to 7 days after submitting.

### Missing SEFs can end an enrollment

If you stop submitting SEFs, the portal assumes the sessions aren't happening:

| Weeks without an SEF | What happens |
| --- | --- |
| 3 weeks | Warning email, plus a banner on your Dashboard |
| 4 weeks | Second warning email |
| 5 weeks | **The enrollment and its future sessions are deleted**, and you're emailed |

Submitting your overdue SEFs resets this. Taking an agreed break? Let a board member know.`,
  },
  {
    title: "Rescheduling, substitutes & cancelling",
    body: `### Rescheduling one session

1. On the [Dashboard](/dashboard), click the **edit** (pencil) icon on the session, or **Actions → Edit** under Active Sessions.
2. Pick the new date and time.
3. Choose a **Meeting Link** that's free at that time. Booked links are marked unavailable.
4. Save. The new time and Zoom link are emailed to the student's email on file. It's still a good idea to text the parent/guardian.

To change the time **every week**, edit the enrollment in [My Enrollments](/dashboard/my-enrollments) instead.

### Requesting a substitute

1. Click the **Request a Substitute** icon (person with a +) on the session, or **Actions → Request Substitute** under Active Sessions.
2. Confirm. The session is marked **Sub Requested** and the substitute request form opens in a new tab.
3. Submit the form so a substitute can be found. Requests should be made at least 24 hours in advance.

A Sub Requested session doesn't need a Session Exit Form and doesn't count toward your volunteer hours. Teaching it after all? Click the icon again (person with a ✓) and choose **Undo sub request**.

### Cancelling a session

1. Click the red **cancel** (calendar ✕) icon, or **Actions → Cancel**.
2. Choose a reason: student cancelled with prior notice, Student Did Not Attend, I am cancelling with prior notice, Last Minute Emergency, or Other.
3. Add any details and confirm.

Cancelled by mistake? Click **Undo Cancel** (green ✕) on the session.`,
  },
  {
    title: "Navigating the portal",
    body: `### [Dashboard](/dashboard)

- **This Week:** this week's sessions with the Zoom link, SEF button, and actions.
- **Active Sessions:** all upcoming sessions.
- **Past Sessions:** completed, cancelled, no-show, and unconfirmed sessions. Submit overdue SEFs, undo a recent SEF, and view meeting notes here.

### [Announcements](/dashboard/announcements)

Important updates from the Connect Me team. Check here regularly.

### [My Students](/dashboard/my-students)

Each student's start date, availability, subjects, email, and parent/guardian email and phone.

> **Removing a student:** if a student no longer wants tutoring, click the red trash can, then **Remove Student**. This also deletes their enrollments and future sessions, so you don't need to delete those separately. Please let the team know too.

### [My Enrollments](/dashboard/my-enrollments)

An **enrollment** is a recurring session with a student: day, time, Zoom link, and how often you meet.

- **Edit** to change the regular day/time or Zoom link. Upcoming sessions on the regular schedule move with it; sessions you rescheduled individually keep their new time.
- **Add** an enrollment for an extra weekly session: choose the student, frequency (**Weekly** or **Biweekly**; biweekly can only be set when creating), start date, and a time within the student's availability.
- When picking a Zoom link, a **green dot** means it's free at that time and a **red dot** means it's taken.
- **Copy link** copies the Zoom link to share; **Chat** opens that enrollment's chat; filters narrow the list by name, day, or time.
- **Delete** ends that recurring session. If the student is stopping entirely, use Remove Student on My Students instead.

> Need a **one-time** extra session? Don't create an enrollment for it. Reschedule an existing session, or use **Get Help** so the team can add a one-off. Can't find a free time or Zoom link? Use Get Help (category *Sessions, scheduling, or Zoom links*).

### [Chats](/dashboard/chats)

Message the Connect Me admin team. Each enrollment also has its own chat, opened from My Enrollments.

### [My Hours](/dashboard/my-stats)

Your session hours, event hours, and total, broken down by student and by event. Only sessions with a submitted SEF count.

- Need a signature for your school or organization? Fill out the [hours verification request form](${LINKS.hoursVerification}).
- Hours look wrong? Check for missing or overdue SEFs first, then use Get Help (category *Volunteer hours*).

### [Resources](/dashboard/resources)

The Tutor Handbook (read before your first session) and a searchable table of curated teaching resources: math, reading comprehension, phonics, virtual science labs, writing, and more.

### [Worksheets](/dashboard/worksheets)

A searchable library of worksheets and lesson plans. Filter by category or collection, then preview or download.

### [Pairings](/dashboard/pairings)

Join or leave the pairing queue and respond to matches. Already have a student and want another? Turn **In pairing queue** back on.

### [Profile](/dashboard/profile)

Your availability, subjects of interest, and languages spoken.`,
  },
  {
    title: "Settings",
    body: `Open [Settings](/dashboard/settings) from the menu at the bottom of the sidebar.

- **Profiles:** switch between profiles if your account has more than one.
- **Notification Settings:** turn session and webinar reminder emails on or off. Text reminders are still in development.
- **Orientation resources:** reopen the portal walkthrough.
- **Email Address:** change your login email. Confirmation links go to both your current and new address; the change takes effect once both are clicked.
- **Account Settings:** your name, phone number, age, bio, subjects, languages, and account status.`,
  },
  {
    title: "Getting help",
    body: `**Get Help** in the sidebar menu opens a support ticket. Pick a category and urgency, then describe what happened. You'll get an emailed copy, and the team follows up by email.

> **Serious incidents:** safety concerns, harassment, misconduct, or other serious incidents go through the **serious incident report form**, linked inside the Get Help window. Don't use a regular ticket for these.

You can also reach a Connect Me Board member on Remind or Discord.`,
  },
  {
    title: "Quick reference",
    body: `| I want to… | Go to |
| --- | --- |
| Join my session | [Dashboard](/dashboard) → Meeting → Join Meeting |
| Get credit for a session | [Dashboard](/dashboard) → SEF button (within 48 hours) |
| Submit a late SEF | [Dashboard](/dashboard) → Past Sessions → Submit overdue SEF |
| Move one session | [Dashboard](/dashboard) → edit (pencil) icon |
| Change my weekly time | [My Enrollments](/dashboard/my-enrollments) → edit |
| Add a weekly session | [My Enrollments](/dashboard/my-enrollments) → add |
| Get a substitute | [Dashboard](/dashboard) → Request a Substitute icon |
| Cancel a session | [Dashboard](/dashboard) → red cancel icon |
| Stop tutoring a student | [My Students](/dashboard/my-students) → trash can → Remove Student |
| Find a new student | [Pairings](/dashboard/pairings) → turn on In pairing queue |
| Update availability or subjects | [Profile](/dashboard/profile) |
| Check or verify my hours | [My Hours](/dashboard/my-stats) / [verification form](${LINKS.hoursVerification}) |
| Report a problem | Sidebar menu → Get Help |`,
  },
];
