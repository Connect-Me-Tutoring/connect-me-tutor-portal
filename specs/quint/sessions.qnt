// -*- mode: Bluespec; -*-
//
// Connect Me portal: session scheduling, Zoom rooms and attendance.
//
// Time is a sequence of slots; each week has SLOTS_PER_WEEK slots (one per
// tutoring day), so slot = week * SLOTS_PER_WEEK + day. Rooms are the shared
// Zoom accounts in Meetings (25 in prod), reused across enrollments.
//
// Models:
//   addEnrollment (UI room check -> insert -> first session via addStandaloneSession)
//   /api/cron/add-sessions -> addSessionsForCron
//   rescheduleSession, addStandaloneSession, cancelSession, SEF submission
//   updateEnrollment -> updateFutureSessions -> computeSessionDateForSchedule
//   /api/cron/cleanup-schedule -> markUnconfirmedSEFCron
//   /api/zoom/webhooks -> resolvePortalSessionForZoomMeetingNumber
//
// Run:
//   quint run specs/quint/sessions.qnt --invariant=safety
//   quint run specs/quint/sessions.qnt --invariant=<name> --mbt
module sessions {

  // ===========================================================================
  // Constants
  // ===========================================================================
  pure val SLOTS_PER_WEEK = 2
  pure val MAX_WEEK = 3
  pure val LAST_SLOT = MAX_WEEK * SLOTS_PER_WEEK - 1
  pure val ROOMS = Set("r1", "r2")
  pure val DAYS = Set(0, 1)
  // e1 is weekly, e2 biweekly (one biweekly enrollment is live in prod).
  pure val ENRS = Set("e1", "e2")
  pure def freqOf(e: str): Freq = if (e == "e2") Biweekly else Weekly
  pure val MAX_SESSIONS = 8

  // ===========================================================================
  // Types
  // ===========================================================================
  type Freq = Weekly | Biweekly
  type SessionStatus = SActive | SComplete | SCancelled | SDidNotAttend | SUnconfirmed
  type Enrollment = { day: int, room: str, startWeek: int, paused: bool }
  type Session = {
    enr: str, slot: int, room: str, status: SessionStatus,
    standalone: bool,
    // ghost: the week the cron generated it for (-1 for extra standalone sessions)
    origin: int,
  }

  // ===========================================================================
  // State
  // ===========================================================================
  var enrollments: str -> Enrollment
  // Room checked as free in the browser, not yet saved.
  var pendingBooking: str -> { day: int, room: str }
  var sessions: int -> Session
  var now: int
  var cronRanWeek: Set[int]

  // ---- ghost ----
  // (enrollment, week) the cron skipped although no session was generated for that week
  var skippedRegular: Set[(str, int)]
  // past Active sessions the cleanup cron left Active
  var cleanupLeftActive: Set[int]
  // sessions that lost Zoom participant events to another session in the same room
  var misattributed: Set[int]
  // sessions an enrollment edit moved from the future into the past
  var movedIntoPast: Set[int]
  var lastAction: str

  // ===========================================================================
  // Helpers
  // ===========================================================================
  pure def weekOf(slot: int): int = slot / SLOTS_PER_WEEK
  pure def slotOf(week: int, day: int): int = week * SLOTS_PER_WEEK + day
  def week = weekOf(now)
  def nextId = sessions.keys().size()
  def roomFreeForEnrollment(e: str, day: int, room: str): bool =
    enrollments.keys().forall(o => o == e or enrollments.get(o).day != day or enrollments.get(o).room != room)
  def live(k: int): bool = sessions.get(k).status != SCancelled

  action keepGhosts = all {
    skippedRegular' = skippedRegular, cleanupLeftActive' = cleanupLeftActive,
    misattributed' = misattributed, movedIntoPast' = movedIntoPast,
  }

  action init = all {
    enrollments' = Map(),
    pendingBooking' = Map(),
    sessions' = Map(),
    now' = 0,
    cronRanWeek' = Set(),
    skippedRegular' = Set(),
    cleanupLeftActive' = Set(),
    misattributed' = Set(),
    movedIntoPast' = Set(),
    lastAction' = "init",
  }

  // ===========================================================================
  // Enrollment creation: the room picker (checkAvailableMeetingForEnrollments)
  // runs in the browser against a snapshot; the insert happens later and
  // nothing re-checks it. Two admins (or an admin and the auto-enrollment in
  // updatePairingMatchStatus) can both pass the check.
  // ===========================================================================
  action checkRoom(e: str, day: int, room: str): bool = all {
    not(enrollments.keys().contains(e)),
    not(pendingBooking.keys().contains(e)),
    roomFreeForEnrollment(e, day, room),
    pendingBooking' = pendingBooking.put(e, { day: day, room: room }),
    enrollments' = enrollments, sessions' = sessions, now' = now, cronRanWeek' = cronRanWeek,
    keepGhosts,
    lastAction' = "checkRoom",
  }

  // addEnrollment: insert, then the first session as a STANDALONE session at
  // the next occurrence (is_first_session = true, is_standalone = true).
  action commitEnrollment(e: str): bool = all {
    pendingBooking.keys().contains(e),
    nextId < MAX_SESSIONS,
    val b = pendingBooking.get(e)
    val first = if (slotOf(week, b.day) >= now) slotOf(week, b.day) else slotOf(week + 1, b.day)
    all {
      first <= LAST_SLOT,
      enrollments' = enrollments.put(e, { day: b.day, room: b.room, startWeek: week, paused: false }),
      sessions' = sessions.put(nextId, { enr: e, slot: first, room: b.room, status: SActive,
                                         standalone: true, origin: weekOf(first) }),
    },
    pendingBooking' = pendingBooking.keys().exclude(Set(e)).mapBy(k => pendingBooking.get(k)),
    now' = now, cronRanWeek' = cronRanWeek,
    keepGhosts,
    lastAction' = "commitEnrollment",
  }

  // ===========================================================================
  // Weekly generation (Sunday 00:00 ET, i.e. at the first slot of a week).
  // For each unpaused enrollment: skip if ANY session with this enrollment_id
  // falls in the week (whatever its status or where it came from); otherwise
  // create one on the enrollment's day. Enrollments.frequency is not read.
  // ===========================================================================
  action addSessionsCron = all {
    now % SLOTS_PER_WEEK == 0,
    not(cronRanWeek.contains(week)),
    val due = enrollments.keys().filter(e =>
      not(enrollments.get(e).paused) and enrollments.get(e).startWeek <= week)
    val hasAny = due.filter(e => sessions.keys().exists(k => sessions.get(k).enr == e and weekOf(sessions.get(k).slot) == week))
    val hasOwn = due.filter(e => sessions.keys().exists(k => sessions.get(k).enr == e and sessions.get(k).origin == week))
    val toCreate = due.exclude(hasAny)
    val ids = toCreate.fold(Map(), (m, e) => m.put(e, nextId + m.keys().size()))
    all {
      nextId + toCreate.size() <= MAX_SESSIONS,
      sessions' = toCreate.fold(sessions, (acc, e) =>
        acc.put(ids.get(e), { enr: e, slot: slotOf(week, enrollments.get(e).day),
                              room: enrollments.get(e).room, status: SActive,
                              standalone: false, origin: week })),
      skippedRegular' = skippedRegular.union(hasAny.exclude(hasOwn).map(e => (e, week))),
    },
    cronRanWeek' = cronRanWeek.union(Set(week)),
    enrollments' = enrollments, pendingBooking' = pendingBooking, now' = now,
    cleanupLeftActive' = cleanupLeftActive, misattributed' = misattributed, movedIntoPast' = movedIntoPast,
    lastAction' = "addSessionsCron",
  }

  // ===========================================================================
  // Session changes
  // ===========================================================================

  // rescheduleSession (tutor; the student's call fails on RLS). New date and
  // room are written as given: the room check is only in the browser.
  action reschedule(k: int, slot: int, room: str): bool = all {
    sessions.keys().contains(k),
    sessions.get(k).status == SActive,
    sessions.get(k).slot >= now,
    slot > now, slot <= LAST_SLOT,
    sessions' = sessions.set(k, { ...sessions.get(k), slot: slot, room: room }),
    enrollments' = enrollments, pendingBooking' = pendingBooking, now' = now, cronRanWeek' = cronRanWeek,
    keepGhosts,
    lastAction' = "reschedule",
  }

  // addStandaloneSession ("add a session"), tutor or admin.
  action addStandalone(e: str, slot: int, room: str): bool = all {
    enrollments.keys().contains(e),
    nextId < MAX_SESSIONS,
    slot >= now, slot <= LAST_SLOT,
    sessions' = sessions.put(nextId, { enr: e, slot: slot, room: room, status: SActive,
                                       standalone: true, origin: -1 }),
    enrollments' = enrollments, pendingBooking' = pendingBooking, now' = now, cronRanWeek' = cronRanWeek,
    keepGhosts,
    lastAction' = "addStandalone",
  }

  action setStatus(k: int, st: SessionStatus): bool = all {
    sessions.keys().contains(k),
    sessions.get(k).status == SActive,
    // SEF / did-not-attend once it has started; cancel any time before
    if (st == SCancelled) sessions.get(k).slot >= now else sessions.get(k).slot <= now,
    sessions' = sessions.set(k, { ...sessions.get(k), status: st }),
    enrollments' = enrollments, pendingBooking' = pendingBooking, now' = now, cronRanWeek' = cronRanWeek,
    keepGhosts,
    lastAction' = "setStatus",
  }

  // updateEnrollment -> updateFutureSessions: every future session of the
  // enrollment that isn't Cancelled / Rescheduled / Did-not-attend gets the
  // new room and is moved to the new weekday OF THE SAME WEEK
  // (computeSessionDateForSchedule), which can be earlier than now.
  action updateEnrollment(e: str, day: int, room: str): bool = all {
    enrollments.keys().contains(e),
    roomFreeForEnrollment(e, day, room),
    val moved = sessions.keys().filter(k =>
      sessions.get(k).enr == e and sessions.get(k).slot >= now and
      sessions.get(k).status != SCancelled and sessions.get(k).status != SDidNotAttend)
    all {
      enrollments' = enrollments.set(e, { ...enrollments.get(e), day: day, room: room }),
      sessions' = sessions.keys().mapBy(k =>
        if (moved.contains(k))
          { ...sessions.get(k), slot: slotOf(weekOf(sessions.get(k).slot), day), room: room }
        else sessions.get(k)),
      movedIntoPast' = movedIntoPast.union(
        moved.filter(k => slotOf(weekOf(sessions.get(k).slot), day) < now)),
    },
    pendingBooking' = pendingBooking, now' = now, cronRanWeek' = cronRanWeek,
    skippedRegular' = skippedRegular, cleanupLeftActive' = cleanupLeftActive, misattributed' = misattributed,
    lastAction' = "updateEnrollment",
  }

  action setPaused(e: str, b: bool): bool = all {
    enrollments.keys().contains(e),
    enrollments' = enrollments.set(e, { ...enrollments.get(e), paused: b }),
    sessions' = sessions, pendingBooking' = pendingBooking, now' = now, cronRanWeek' = cronRanWeek,
    keepGhosts,
    lastAction' = "setPaused",
  }

  // markUnconfirmedSEFCron: Active, older than 48h, is_standalone = false -> Unconfirmed.
  action cleanupCron = {
    val stale = sessions.keys().filter(k => sessions.get(k).status == SActive and sessions.get(k).slot < now)
    val converted = stale.filter(k => not(sessions.get(k).standalone))
    all {
      stale.size() > 0,
      sessions' = sessions.keys().mapBy(k =>
        if (converted.contains(k)) { ...sessions.get(k), status: SUnconfirmed } else sessions.get(k)),
      cleanupLeftActive' = cleanupLeftActive.union(stale.exclude(converted)),
      enrollments' = enrollments, pendingBooking' = pendingBooking, now' = now, cronRanWeek' = cronRanWeek,
      skippedRegular' = skippedRegular, misattributed' = misattributed, movedIntoPast' = movedIntoPast,
      lastAction' = "cleanupCron",
    }
  }

  // Zoom participant_joined in `room` during the current slot. The webhook
  // takes the Active sessions in that room whose window covers now, ordered by
  // start DESC, and credits the first. Anyone else's session in the same room
  // at the same time gets no attendance.
  action zoomJoin(room: str): bool = {
    val candidates = sessions.keys().filter(k =>
      sessions.get(k).room == room and sessions.get(k).slot == now and sessions.get(k).status == SActive)
    all {
      candidates.size() > 0,
      nondet chosen = oneOf(candidates)
      misattributed' = misattributed.union(candidates.exclude(Set(chosen))),
      enrollments' = enrollments, pendingBooking' = pendingBooking, sessions' = sessions,
      now' = now, cronRanWeek' = cronRanWeek,
      skippedRegular' = skippedRegular, cleanupLeftActive' = cleanupLeftActive, movedIntoPast' = movedIntoPast,
      lastAction' = "zoomJoin",
    }
  }

  action advance = all {
    now < LAST_SLOT,
    // the weekly cron fires at the start of every week
    now % SLOTS_PER_WEEK != 0 or cronRanWeek.contains(week),
    now' = now + 1,
    enrollments' = enrollments, pendingBooking' = pendingBooking, sessions' = sessions,
    cronRanWeek' = cronRanWeek,
    keepGhosts,
    lastAction' = "advance",
  }

  // ===========================================================================
  // Step
  // ===========================================================================
  action step = {
    nondet e = oneOf(ENRS)
    nondet day = oneOf(DAYS)
    nondet room = oneOf(ROOMS)
    nondet slot = oneOf(0.to(LAST_SLOT))
    nondet b = oneOf(Set(true, false))
    nondet st = oneOf(Set(SComplete, SCancelled, SDidNotAttend))
    any {
      checkRoom(e, day, room),
      commitEnrollment(e),
      addSessionsCron,
      all {
        sessions.keys().size() > 0,
        nondet k = oneOf(sessions.keys())
        any { reschedule(k, slot, room), setStatus(k, st) },
      },
      addStandalone(e, slot, room),
      updateEnrollment(e, day, room),
      setPaused(e, b),
      cleanupCron,
      zoomJoin(room),
      advance,
    }
  }

  // ===========================================================================
  // INVARIANTS
  // ===========================================================================

  // --- Intended to hold ---

  // Paused enrollments get no cron-generated sessions after the pause.
  // (Encoded by construction; kept as documentation.)
  // Sessions always point at an existing enrollment in this model.
  val sessionsHaveEnrollment = sessions.keys().forall(k => enrollments.keys().contains(sessions.get(k).enr))

  // One cron run per week.
  val cronAtMostWeekly = cronRanWeek.forall(w => w <= week)

  val safety = sessionsHaveEnrollment and cronAtMostWeekly

  // --- Expected to FAIL: findings, see README.md ---

  // S1. No two live sessions share a Zoom room at the same time. The room
  //     check is client-side only and is skipped by reschedule, extra
  //     sessions and enrollment edits.
  val noDoubleBooking =
    sessions.keys().forall(a => sessions.keys().forall(b =>
      (a != b and live(a) and live(b) and sessions.get(a).room == sessions.get(b).room)
        implies sessions.get(a).slot != sessions.get(b).slot))

  // S2. Two enrollments never hold the same room at the same weekly time
  //     (check-then-insert race).
  val enrollmentRoomsDisjoint =
    enrollments.keys().forall(a => enrollments.keys().forall(b =>
      a != b implies (enrollments.get(a).day != enrollments.get(b).day or enrollments.get(a).room != enrollments.get(b).room)))

  // S3. Zoom attendance goes to the session that was actually held.
  val zoomAttributionUnambiguous = misattributed == Set()

  // S4. The weekly cron creates each unpaused enrollment's session for the
  //     week. Broken when a session was rescheduled INTO this week from
  //     another week: the cron sees "has a session" and skips.
  val noRegularSessionSkipped = skippedRegular == Set()

  // S5. Biweekly enrollments meet every other week. frequency is never read.
  val biweeklyRespected =
    sessions.keys().forall(a => sessions.keys().forall(b =>
      (freqOf(sessions.get(a).enr) == Biweekly and sessions.get(a).enr == sessions.get(b).enr
        and not(sessions.get(a).standalone) and not(sessions.get(b).standalone))
        implies sessions.get(b).origin != sessions.get(a).origin + 1))

  // S6. The nightly cleanup leaves no session older than 48h Active. It skips
  //     is_standalone, which includes every enrollment's FIRST session.
  val cleanupResolvesPastSessions = cleanupLeftActive == Set()

  // S7. Editing an enrollment never moves an upcoming session into the past.
  val editKeepsUpcomingSessionsUpcoming = movedIntoPast == Set()
}
