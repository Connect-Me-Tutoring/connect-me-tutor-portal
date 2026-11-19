// -*- mode: Bluespec; -*-
//
// Connect Me portal: tutor/student lifecycle.
//
// Models the state that the database and server actions share:
//   Profiles.status, pairing_requests.in_queue, pairing_matches.tutor_status,
//   Pairings, Enrollments.paused, Sessions.status
// and the transitions that change it: the pairing cron (/api/pairing),
// updatePairingMatchStatus, profile (de)activation triggers, the add-sessions
// and cleanup-schedule crons, session exit forms / cancellations, and
// deletePairingServer.
//
// Not modelled: auth/RLS beyond "who may call this", emails other than the
// pairing confirmation (whose failure triggers a rollback), Zoom, chat, hours,
// tickets, consent. Time is coarse: one step of `week` is one calendar week;
// "older than 48h" means "in an earlier week".
//
// Run:
//   quint typecheck specs/quint/connect_me.qnt
//   quint run specs/quint/connect_me.qnt --invariant=safety --max-steps=30 --max-samples=20000
//   quint run specs/quint/connect_me.qnt --invariant=<name>   (see INVARIANTS below)
module connect_me {

  // ===========================================================================
  // Constants (keep small: the simulator explores all interleavings)
  // ===========================================================================
  pure val TUTORS = Set("t1", "t2")
  pure val STUDENTS = Set("s1", "s2")
  pure val PROFILES = TUTORS.union(STUDENTS)
  pure val MAX_WEEK = 6
  // deleteInactiveEnrollments uses 5 weeks; shrunk so the simulator reaches it.
  pure val MISSING_SEF_WEEKS = 2

  // ===========================================================================
  // Types
  // ===========================================================================
  type ProfileStatus = Active | Inactive

  // pairing_matches.tutor_status
  type MatchStatus = MPending | MAccepted | MRejected

  // session_status enum, restricted to the values the live code writes.
  // (Rescheduled / Sub-Request / Expired / Standalone / Unsubmitted are legacy.)
  type SessionStatus = SActive | SComplete | SCancelled | SDidNotAttend | SUnconfirmed

  type Pair = { tutor: str, student: str }

  // One enrollment per pair is enough to exercise every rule below.
  // resumedByParticipant is ghost: set when a non-admin unpaused it while a
  // party was Inactive.
  type Enrollment = { paused: bool, startWeek: int, resumedByParticipant: bool }

  type SessionKey = { pair: Pair, week: int }

  // ===========================================================================
  // State
  // ===========================================================================
  var status: str -> ProfileStatus
  // pairing_requests.in_queue (row exists for everyone; false = archived/draft)
  var inQueue: str -> bool
  // pairing_requests.exclude_rejected_tutors (students only)
  var excludeRejected: str -> bool
  // pairing_matches; keyed by pair because of UNIQUE (tutor_id, student_id)
  var matches: Pair -> MatchStatus
  // Pairings (no uniqueness constraint in the schema)
  var pairings: Set[Pair]
  var enrollments: Pair -> Enrollment
  // Sessions; keyed like UNIQUE (tutor_id, student_id, date)
  var sessions: SessionKey -> SessionStatus
  var week: int

  // ---- ghost state: history the invariants need, not in the database ----
  // Sessions currently in a terminal, hour-counting status (an admin may move
  // one back out, after which it is fair game for deletion again).
  var terminalKeys: Set[SessionKey]
  // Pairs an admin or tutor deliberately unpaired (deletePairingServer).
  var unpaired: Set[Pair]
  // Pairs whose enrollment the cleanup cron deleted on purpose.
  var enrollmentReaped: Set[Pair]
  // Set when an Inactive tutor turns a match into a Pairing.
  var inactivePaired: Set[Pair]
  var lastAction: str

  // ===========================================================================
  // Helpers
  // ===========================================================================
  pure def allPairs = tuples(TUTORS, STUDENTS).map(((t, s)) => { tutor: t, student: s })
  def involves(p: Pair, u: str): bool = p.tutor == u or p.student == u
  def hasMatch(p: Pair): bool = matches.keys().contains(p)
  def matchIs(p: Pair, st: MatchStatus): bool = hasMatch(p) and matches.get(p) == st
  def isTerminal(st: SessionStatus): bool = st == SComplete or st == SDidNotAttend

  // ===========================================================================
  // Init: everyone Active, nobody queued, nothing paired.
  // ===========================================================================
  action init = all {
    status' = PROFILES.mapBy(_ => Active),
    inQueue' = PROFILES.mapBy(_ => false),
    excludeRejected' = STUDENTS.mapBy(_ => true),
    matches' = Map(),
    pairings' = Set(),
    enrollments' = Map(),
    sessions' = Map(),
    week' = 0,
    terminalKeys' = Set(),
    unpaired' = Set(),
    enrollmentReaped' = Set(),
    inactivePaired' = Set(),
    lastAction' = "init",
  }

  action unchangedPairing = all {
    matches' = matches, pairings' = pairings, unpaired' = unpaired, inactivePaired' = inactivePaired,
  }
  action unchangedSchedule = all {
    enrollments' = enrollments, sessions' = sessions, week' = week,
    terminalKeys' = terminalKeys, enrollmentReaped' = enrollmentReaped,
  }
  action unchangedProfiles = all {
    status' = status, inQueue' = inQueue, excludeRejected' = excludeRejected,
  }

  // ===========================================================================
  // Pairing queue
  // ===========================================================================

  // createPairingRequest / provision-user / handle_new_user.
  // block_inactive_pairing_requests rejects in_queue = true for Inactive users.
  action joinQueue(u: str): bool = all {
    status.get(u) == Active,
    not(inQueue.get(u)),
    inQueue' = inQueue.set(u, true),
    status' = status, excludeRejected' = excludeRejected,
    unchangedPairing, unchangedSchedule,
    lastAction' = "joinQueue",
  }

  // removePairingRequest: archive (in_queue = false).
  action leaveQueue(u: str): bool = all {
    inQueue.get(u),
    inQueue' = inQueue.set(u, false),
    status' = status, excludeRejected' = excludeRejected,
    unchangedPairing, unchangedSchedule,
    lastAction' = "leaveQueue",
  }

  action setExcludeRejected(s: str, b: bool): bool = all {
    excludeRejected' = excludeRejected.set(s, b),
    status' = status, inQueue' = inQueue,
    unchangedPairing, unchangedSchedule,
    lastAction' = "setExcludeRejected",
  }

  // One proposal made by runPairingWorkflow (daily cron / admin "run pairing").
  // get_best_match: both sides in_queue, no existing Pairings row for the pair,
  // and (if the student opted in) not a tutor who rejected them. It does NOT
  // look at Profiles.status, at existing pending matches, or at whether either
  // side is already paired with someone else.
  // The insert is skipped on 23505, so a pair that ever had a match row can
  // never be proposed again, whatever the cooldown / exclude flag says.
  action proposeMatch(p: Pair): bool = all {
    inQueue.get(p.tutor),
    inQueue.get(p.student),
    not(pairings.contains(p)),
    not(excludeRejected.get(p.student) and matchIs(p, MRejected)),
    not(hasMatch(p)),
    matches' = matches.put(p, MPending),
    pairings' = pairings, unpaired' = unpaired, inactivePaired' = inactivePaired,
    unchangedProfiles, unchangedSchedule,
    lastAction' = "proposeMatch",
  }

  // updatePairingMatchStatus(..., "accepted"), called by the tutor.
  // The UPDATE filters only on id and tutor_id, the RLS policy only on
  // ownership, and the column guard lets tutors change tutor_status freely:
  // any existing match, in any status, can be accepted, by a tutor in any
  // profile status (Inactive users can still log in).
  //
  // Outcomes after tutor_status := accepted:
  //   dupPairing  -> Pairings insert hits 23505, throws; nothing else changes
  //   !overlap    -> Pairings row inserted, no enrollment, throws
  //   !emailOk    -> enrollment + Pairings row deleted again (rollback);
  //                  match stays accepted
  //   otherwise   -> Pairings row + unpaused enrollment
  action acceptMatch(p: Pair, overlap: bool, emailOk: bool): bool = all {
    hasMatch(p),
    val dupPairing = pairings.contains(p)
    val createsPairing = not(dupPairing) and (not(overlap) or emailOk)
    val createsEnrollment = createsPairing and overlap
    all {
      matches' = matches.set(p, MAccepted),
      pairings' = if (createsPairing) pairings.union(Set(p)) else pairings,
      enrollments' =
        if (createsEnrollment) enrollments.put(p, { paused: false, startWeek: week, resumedByParticipant: false })
        else enrollments,
      inactivePaired' =
        if (createsPairing and status.get(p.tutor) == Inactive) inactivePaired.union(Set(p))
        else inactivePaired,
    },
    unpaired' = unpaired,
    sessions' = sessions, week' = week, terminalKeys' = terminalKeys,
    enrollmentReaped' = enrollmentReaped,
    unchangedProfiles,
    lastAction' = "acceptMatch",
  }

  // updatePairingMatchStatus(..., "rejected"). Request status goes back to
  // 'pending', which nothing reads, so it is not modelled.
  action rejectMatch(p: Pair): bool = all {
    hasMatch(p),
    matches' = matches.set(p, MRejected),
    pairings' = pairings, unpaired' = unpaired, inactivePaired' = inactivePaired,
    unchangedProfiles, unchangedSchedule,
    lastAction' = "rejectMatch",
  }

  // deletePairingServer (tutor or admin): delete future non-terminal sessions,
  // the enrollment, and the Pairings row. pairing_matches is left alone.
  action deletePairing(p: Pair): bool = all {
    pairings.contains(p),
    pairings' = pairings.exclude(Set(p)),
    enrollments' = enrollments.keys().exclude(Set(p)).mapBy(k => enrollments.get(k)),
    sessions' = sessions.keys()
      .filter(k => not(k.pair == p and k.week >= week and not(isTerminal(sessions.get(k)))))
      .mapBy(k => sessions.get(k)),
    unpaired' = unpaired.union(Set(p)),
    matches' = matches, inactivePaired' = inactivePaired,
    week' = week, terminalKeys' = terminalKeys, enrollmentReaped' = enrollmentReaped,
    unchangedProfiles,
    lastAction' = "deletePairing",
  }

  // ===========================================================================
  // Profile status (on_profile_status_change / guard_profile_columns)
  // ===========================================================================

  // Self-pause from Settings or admin Deactivate. The AFTER trigger:
  //   (a) archives the queue row, (b) pauses every enrollment,
  //   (c) withdraws pending matches (tutor_status = rejected).
  action deactivate(u: str): bool = all {
    status.get(u) == Active,
    status' = status.set(u, Inactive),
    inQueue' = inQueue.set(u, false),
    enrollments' = enrollments.keys().mapBy(k =>
      if (involves(k, u)) { ...enrollments.get(k), paused: true } else enrollments.get(k)),
    matches' = matches.keys().mapBy(k =>
      if (involves(k, u) and matches.get(k) == MPending) MRejected else matches.get(k)),
    excludeRejected' = excludeRejected,
    pairings' = pairings, unpaired' = unpaired, inactivePaired' = inactivePaired,
    sessions' = sessions, week' = week, terminalKeys' = terminalKeys,
    enrollmentReaped' = enrollmentReaped,
    lastAction' = "deactivate",
  }

  // Admin only. Deliberately undoes none of the deactivation side effects.
  action reactivate(u: str): bool = all {
    status.get(u) == Inactive,
    status' = status.set(u, Active),
    inQueue' = inQueue, excludeRejected' = excludeRejected,
    unchangedPairing, unchangedSchedule,
    lastAction' = "reactivate",
  }

  // ===========================================================================
  // Enrollments and sessions
  // ===========================================================================

  // Admin Enrollments page pause toggle.
  action adminSetPaused(p: Pair, b: bool): bool = all {
    enrollments.keys().contains(p),
    enrollments' = enrollments.set(p, { ...enrollments.get(p), paused: b }),
    sessions' = sessions, week' = week, terminalKeys' = terminalKeys,
    enrollmentReaped' = enrollmentReaped,
    unchangedProfiles, unchangedPairing,
    lastAction' = "adminSetPaused",
  }

  // A student or tutor on the enrollment flips `paused` with the browser
  // client: enrollments_participant_update allows it, and
  // guard_enrollment_columns only protects student_id / tutor_id.
  action participantSetPaused(p: Pair, b: bool): bool = all {
    enrollments.keys().contains(p),
    val e = enrollments.get(p)
    val partyInactive = status.get(p.tutor) == Inactive or status.get(p.student) == Inactive
    enrollments' = enrollments.set(p, { ...e, paused: b,
      resumedByParticipant: e.resumedByParticipant or (e.paused and not(b) and partyInactive) }),
    sessions' = sessions, week' = week, terminalKeys' = terminalKeys,
    enrollmentReaped' = enrollmentReaped,
    unchangedProfiles, unchangedPairing,
    lastAction' = "participantSetPaused",
  }

  // Admin "Add enrollment" (addEnrollment). The prod-only trigger
  // Automatically_create_pairing_from_new_enrollment reuses or inserts the
  // Pairings row, so this pairs people without any match.
  action adminCreateEnrollment(p: Pair): bool = all {
    not(enrollments.keys().contains(p)),
    enrollments' = enrollments.put(p, { paused: false, startWeek: week, resumedByParticipant: false }),
    pairings' = pairings.union(Set(p)),
    sessions' = sessions, week' = week, terminalKeys' = terminalKeys,
    enrollmentReaped' = enrollmentReaped,
    unchangedProfiles,
    matches' = matches, unpaired' = unpaired, inactivePaired' = inactivePaired,
    lastAction' = "adminCreateEnrollment",
  }

  // /api/cron/add-sessions (weekly): one Active session per unpaused
  // enrollment that has none this week.
  action addSessionsCron = all {
    val due = enrollments.keys().filter(p =>
      not(enrollments.get(p).paused) and not(sessions.keys().contains({ pair: p, week: week })))
    val newKeys = due.map(p => { pair: p, week: week })
    all {
      newKeys.size() > 0,
      sessions' = sessions.keys().union(newKeys).mapBy(k =>
        if (sessions.keys().contains(k)) sessions.get(k) else SActive),
    },
    enrollments' = enrollments, week' = week, terminalKeys' = terminalKeys,
    enrollmentReaped' = enrollmentReaped,
    unchangedProfiles, unchangedPairing,
    lastAction' = "addSessionsCron",
  }

  action setSession(k: SessionKey, st: SessionStatus): bool = all {
    sessions' = sessions.set(k, st),
    terminalKeys' = if (isTerminal(st)) terminalKeys.union(Set(k)) else terminalKeys.exclude(Set(k)),
    enrollments' = enrollments, week' = week, enrollmentReaped' = enrollmentReaped,
    unchangedProfiles, unchangedPairing,
  }

  // Tutor submits the session exit form.
  action submitSEF(k: SessionKey): bool = all {
    sessions.keys().contains(k),
    sessions.get(k) == SActive,
    setSession(k, SComplete),
    lastAction' = "submitSEF",
  }

  // CancellationForm (tutor) / student cancel.
  action cancelSession(k: SessionKey, didNotAttend: bool): bool = all {
    sessions.keys().contains(k),
    sessions.get(k) == SActive,
    setSession(k, if (didNotAttend) SDidNotAttend else SCancelled),
    lastAction' = "cancelSession",
  }

  // ManageTutorSessionForm / ScheduleManagement: admin overrides any status.
  action adminSetSession(k: SessionKey, st: SessionStatus): bool = all {
    sessions.keys().contains(k),
    setSession(k, st),
    lastAction' = "adminSetSession",
  }

  // /api/cron/cleanup-schedule (nightly):
  //   1. markUnconfirmedSEFCron: Active sessions older than 48h -> Unconfirmed
  //   2. deleteInactiveEnrollments: enrollments with no submitted SEF for
  //      MISSING_SEF_WEEKS weeks are deleted (their sessions are kept, with
  //      enrollment_id set NULL by the FK).
  action cleanupCron = all {
    val staleSessions = sessions.keys().filter(k => k.week < week and sessions.get(k) == SActive)
    val dead = enrollments.keys().filter(p =>
      week - enrollments.get(p).startWeek >= MISSING_SEF_WEEKS and
      not(sessions.keys().exists(k =>
        k.pair == p and k.week >= week - MISSING_SEF_WEEKS and sessions.get(k) == SComplete)))
    all {
      staleSessions.size() > 0 or dead.size() > 0,
      sessions' = sessions.keys().mapBy(k =>
        if (staleSessions.contains(k)) SUnconfirmed else sessions.get(k)),
      enrollments' = enrollments.keys().exclude(dead).mapBy(k => enrollments.get(k)),
      enrollmentReaped' = enrollmentReaped.union(dead),
    },
    week' = week, terminalKeys' = terminalKeys,
    unchangedProfiles, unchangedPairing,
    lastAction' = "cleanupCron",
  }

  action advanceWeek = all {
    week < MAX_WEEK,
    week' = week + 1,
    enrollments' = enrollments, sessions' = sessions, terminalKeys' = terminalKeys,
    enrollmentReaped' = enrollmentReaped,
    unchangedProfiles, unchangedPairing,
    lastAction' = "advanceWeek",
  }

  // ===========================================================================
  // Step
  // ===========================================================================
  action step = {
    val sessionKeys = sessions.keys()
    any {
      nondet u = oneOf(PROFILES)
      any { joinQueue(u), leaveQueue(u), deactivate(u), reactivate(u) },
      nondet s = oneOf(STUDENTS)
      nondet b = oneOf(Set(true, false))
      setExcludeRejected(s, b),
      nondet p = oneOf(allPairs)
      nondet overlap = oneOf(Set(true, false))
      nondet emailOk = oneOf(Set(true, false))
      nondet b = oneOf(Set(true, false))
      any {
        proposeMatch(p),
        acceptMatch(p, overlap, emailOk),
        rejectMatch(p),
        deletePairing(p),
        adminSetPaused(p, b),
        participantSetPaused(p, b),
        adminCreateEnrollment(p),
      },
      all {
        sessionKeys.size() > 0,
        nondet k = oneOf(sessionKeys)
        nondet b = oneOf(Set(true, false))
        nondet st = oneOf(Set(SActive, SComplete, SCancelled, SDidNotAttend, SUnconfirmed))
        any { submitSEF(k), cancelSession(k, b), adminSetSession(k, st) },
      },
      addSessionsCron,
      cleanupCron,
      advanceWeek,
    }
  }

  // ===========================================================================
  // INVARIANTS
  // ===========================================================================

  // --- Intended to hold (design intent stated in migrations / comments) ---

  // block_inactive_pairing_requests + on_profile_status_change (a).
  val inactiveNotQueued =
    PROFILES.forall(u => status.get(u) == Inactive implies not(inQueue.get(u)))

  // on_profile_status_change (c): an Inactive person has no open offers.
  val inactiveHasNoPendingMatch =
    matches.keys().forall(p =>
      matches.get(p) == MPending implies (status.get(p.tutor) == Active and status.get(p.student) == Active))

  // deletePairingServer keeps Complete / Student Did Not Attend; nothing
  // else deletes sessions.
  val terminalSessionsNeverDeleted =
    terminalKeys.forall(k => sessions.keys().contains(k))

  // Sessions only exist for real pairs.
  val sessionsBelongToPairs =
    sessions.keys().forall(k => pairings.contains(k.pair) or unpaired.contains(k.pair))

  // At most one session per pair per week (UNIQUE tutor_id, student_id, date).
  // Holds by construction of the map; kept so the encoding is explicit.
  val oneSessionPerWeek = true

  val safety = inactiveNotQueued and inactiveHasNoPendingMatch and terminalSessionsNeverDeleted and sessionsBelongToPairs

  // --- Expected to FAIL today: each one is a finding, see README.md ---

  // F1. Migration comment: "Closing the match also stops an Inactive tutor
  //     (who can still log in) from accepting it." Accept does not check the
  //     match's current status or the tutor's profile status.
  val inactiveTutorCannotPair = inactivePaired == Set()

  // F2. Inactive people only have paused enrollments. Broken by F1 (new
  //     enrollment is created unpaused) and by the admin pause toggle.
  val inactiveEnrollmentsPaused =
    enrollments.keys().forall(p =>
      (status.get(p.tutor) == Inactive or status.get(p.student) == Inactive)
        implies enrollments.get(p).paused)

  // F2b. Only an admin resumes an Inactive person's enrollment (migration
  //      20260926000000: "which enrollments resume are admin decisions").
  //      Broken by participantSetPaused.
  val onlyAdminResumesInactive =
    enrollments.keys().forall(p => not(enrollments.get(p).resumedByParticipant))

  // F3. An accepted match is a pairing unless someone unpaired it. Broken by
  //     the email-failure rollback, which leaves tutor_status = accepted.
  val acceptedMatchIsPaired =
    matches.keys().forall(p => matches.get(p) == MAccepted implies (pairings.contains(p) or unpaired.contains(p)))

  // F4. Every pairing has an enrollment unless cleanup reaped it. Broken when
  //     accept finds no overlapping availability: the Pairings row is
  //     inserted, then the action throws.
  val pairingHasEnrollment =
    pairings.forall(p => enrollments.keys().contains(p) or enrollmentReaped.contains(p))

  // F5 (question, may be intended). Accepting does not archive the queue
  //     rows, so a paired student keeps getting new tutors offered daily.
  val pairedStudentGetsNoNewOffers =
    matches.keys().forall(p =>
      matches.get(p) == MPending implies not(pairings.exists(q => q.student == p.student)))

  // F6 (question). A student can hold several open offers at once, and every
  //     tutor that accepts creates a pairing.
  val atMostOnePendingOfferPerStudent =
    STUDENTS.forall(s => matches.keys().filter(p => p.student == s and matches.get(p) == MPending).size() <= 1)

  // ===========================================================================
  // Reachability witnesses (run with --invariant; a violation = reachable)
  // ===========================================================================
  val witnessSessionCompleted = not(sessions.keys().exists(k => sessions.get(k) == SComplete))
  val witnessEnrollmentReaped = enrollmentReaped == Set()
  val witnessReactivatedAndRequeued =
    not(PROFILES.exists(u => status.get(u) == Active and inQueue.get(u) and lastAction == "joinQueue" and week > 0))
}
