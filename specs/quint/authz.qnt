// -*- mode: Bluespec; -*-
//
// Connect Me portal: what each role can write through the database API.
//
// The app's server actions add checks, but the browser holds a Supabase
// session and can call PostgREST directly, so the real permission boundary is
// RLS plus the guard_* triggers. This module enables every write the live
// policies allow (pg_policies on prod, 2026-10-24) and checks it against the
// permissions the product intends.
//
// Actors: admin A; tutors t1, t2; students s1, s2. t1 tutors s1.
//
// Run:
//   quint run specs/quint/authz.qnt --invariant=safety
//   quint run specs/quint/authz.qnt --invariant=<name> --mbt
module authz {

  // ===========================================================================
  // Constants
  // ===========================================================================
  pure val ADMIN = "A"
  pure val TUTORS = Set("t1", "t2")
  pure val STUDENTS = Set("s1", "s2")
  pure val PEOPLE = TUTORS.union(STUDENTS)
  pure val ACTORS = PEOPLE.union(Set(ADMIN))
  pure val MAX_SESSIONS = 4
  // Enrollment-scheduled sessions are 1 hour in this model.
  pure val PLANNED_HOURS = 1

  // ===========================================================================
  // Types
  // ===========================================================================
  type ProfileStatus = Active | Inactive
  type SessionStatus = SActive | SComplete | SCancelled
  type Session = {
    tutor: str, student: str, status: SessionStatus,
    // hours credited if Complete (Sessions.duration; tutor-writable)
    duration: int,
    // ghost: hours the schedule planned for it
    planned: int,
    // ghost: who inserted the row
    createdBy: str,
  }
  type Event = { tutor: str, hours: int, author: str }

  // ===========================================================================
  // State
  // ===========================================================================
  var status: str -> ProfileStatus
  var pairings: Set[(str, str)]       // (tutor, student)
  var paused: (str, str) -> bool      // Enrollments.paused, keyed by pair
  var sessions: int -> Session
  var events: Set[Event]
  var priority: str -> int            // pairing_requests.priority
  var oriented: str -> bool           // Profiles.orientation_completed_at is set

  // ---- ghost ----
  var resumedWhileInactiveBy: Set[str]
  var prioritySetBy: Set[str]
  var orientationBypassedBy: Set[str]
  var reactivatedBy: Set[str]
  var lastAction: str

  // ===========================================================================
  // Helpers
  // ===========================================================================
  // private.visible_profile_ids() restricted to what a tutor can see of students.
  def visibleStudents(t: str): Set[str] =
    pairings.filter(((pt, ps)) => pt == t).map(((pt, ps)) => ps)
      .union(sessions.keys().filter(k => sessions.get(k).tutor == t).map(k => sessions.get(k).student))

  // Students the product links to a tutor: a pairing (match accepted or admin enrollment).
  def linkedStudents(t: str): Set[str] =
    pairings.filter(((pt, ps)) => pt == t).map(((pt, ps)) => ps)

  action unchangedAll = all {
    status' = status, pairings' = pairings, paused' = paused, sessions' = sessions,
    events' = events, priority' = priority, oriented' = oriented,
    resumedWhileInactiveBy' = resumedWhileInactiveBy, prioritySetBy' = prioritySetBy,
    orientationBypassedBy' = orientationBypassedBy, reactivatedBy' = reactivatedBy,
  }

  // ===========================================================================
  // Init
  // ===========================================================================
  action init = all {
    status' = ACTORS.mapBy(_ => Active),
    pairings' = Set(("t1", "s1")),
    paused' = Map(("t1", "s1") -> false),
    sessions' = Map(0 -> { tutor: "t1", student: "s1", status: SActive,
                           duration: PLANNED_HOURS, planned: PLANNED_HOURS, createdBy: "cron" }),
    events' = Set(),
    priority' = PEOPLE.mapBy(_ => 1),
    oriented' = Map("t1" -> true, "t2" -> false),
    resumedWhileInactiveBy' = Set(),
    prioritySetBy' = Set(),
    orientationBypassedBy' = Set(),
    reactivatedBy' = Set(),
    lastAction' = "init",
  }

  // ===========================================================================
  // Sessions (policies sessions_tutor_insert / sessions_tutor_update;
  // guard_session_columns blocks only tutor_id / student_id changes)
  // ===========================================================================

  // INSERT: tutor_id must be one of the caller's profiles; student_id is unchecked.
  action tutorInsertSession(t: str, s: str, hours: int): bool = all {
    sessions.keys().size() < MAX_SESSIONS,
    val k = sessions.keys().size()
    sessions' = sessions.put(k, { tutor: t, student: s, status: SActive,
                                  duration: hours, planned: hours, createdBy: t }),
    status' = status, pairings' = pairings, paused' = paused, events' = events,
    priority' = priority, oriented' = oriented,
    resumedWhileInactiveBy' = resumedWhileInactiveBy, prioritySetBy' = prioritySetBy,
    orientationBypassedBy' = orientationBypassedBy, reactivatedBy' = reactivatedBy,
    lastAction' = "tutorInsertSession",
  }

  // UPDATE: any column but the participants, on the tutor's own sessions.
  // The SEF form only sets status = Complete; the API also accepts duration.
  action tutorUpdateSession(t: str, k: int, st: SessionStatus, hours: int): bool = all {
    sessions.keys().contains(k),
    sessions.get(k).tutor == t,
    sessions' = sessions.set(k, { ...sessions.get(k), status: st, duration: hours }),
    status' = status, pairings' = pairings, paused' = paused, events' = events,
    priority' = priority, oriented' = oriented,
    resumedWhileInactiveBy' = resumedWhileInactiveBy, prioritySetBy' = prioritySetBy,
    orientationBypassedBy' = orientationBypassedBy, reactivatedBy' = reactivatedBy,
    lastAction' = "tutorUpdateSession",
  }

  // ===========================================================================
  // Events (volunteer hours outside sessions): policy events_own is FOR ALL
  // with tutor_id in the caller's profiles. The app only inserts from admin pages.
  // ===========================================================================
  action insertEvent(actor: str, t: str, hours: int): bool = all {
    actor == ADMIN or actor == t,
    events' = events.union(Set({ tutor: t, hours: hours, author: actor })),
    status' = status, pairings' = pairings, paused' = paused, sessions' = sessions,
    priority' = priority, oriented' = oriented,
    resumedWhileInactiveBy' = resumedWhileInactiveBy, prioritySetBy' = prioritySetBy,
    orientationBypassedBy' = orientationBypassedBy, reactivatedBy' = reactivatedBy,
    lastAction' = "insertEvent",
  }

  // ===========================================================================
  // Enrollments.paused (enrollments_participant_update)
  // ===========================================================================
  action setPaused(actor: str, pair: (str, str), b: bool): bool = all {
    paused.keys().contains(pair),
    actor == ADMIN or actor == pair._1 or actor == pair._2,
    val inactive = status.get(pair._1) == Inactive or status.get(pair._2) == Inactive
    all {
      paused' = paused.set(pair, b),
      resumedWhileInactiveBy' =
        if (actor != ADMIN and inactive and paused.get(pair) and not(b))
          resumedWhileInactiveBy.union(Set(actor))
        else resumedWhileInactiveBy,
    },
    status' = status, pairings' = pairings, sessions' = sessions, events' = events,
    priority' = priority, oriented' = oriented,
    prioritySetBy' = prioritySetBy, orientationBypassedBy' = orientationBypassedBy,
    reactivatedBy' = reactivatedBy,
    lastAction' = "setPaused",
  }

  // ===========================================================================
  // pairing_requests.priority (pairing_requests_self_update; no column guard)
  // get_top_pairing_request orders by priority DESC.
  // ===========================================================================
  action setPriority(actor: str, u: str, n: int): bool = all {
    actor == ADMIN or actor == u,
    priority' = priority.set(u, n),
    prioritySetBy' = if (actor != ADMIN) prioritySetBy.union(Set(actor)) else prioritySetBy,
    status' = status, pairings' = pairings, paused' = paused, sessions' = sessions,
    events' = events, oriented' = oriented,
    resumedWhileInactiveBy' = resumedWhileInactiveBy,
    orientationBypassedBy' = orientationBypassedBy, reactivatedBy' = reactivatedBy,
    lastAction' = "setPriority",
  }

  // ===========================================================================
  // Orientation: submitQuizCompletion, or a direct write to the unguarded column.
  // ===========================================================================
  action completeOrientation(t: str, viaQuiz: bool): bool = all {
    not(oriented.get(t)),
    oriented' = oriented.set(t, true),
    orientationBypassedBy' = if (viaQuiz) orientationBypassedBy else orientationBypassedBy.union(Set(t)),
    status' = status, pairings' = pairings, paused' = paused, sessions' = sessions,
    events' = events, priority' = priority,
    resumedWhileInactiveBy' = resumedWhileInactiveBy, prioritySetBy' = prioritySetBy,
    reactivatedBy' = reactivatedBy,
    lastAction' = "completeOrientation",
  }

  // A tutor accepts a match / admin adds an enrollment. The queue does not
  // look at orientation.
  action pair(t: str, s: str): bool = all {
    not(pairings.contains((t, s))),
    pairings' = pairings.union(Set((t, s))),
    paused' = paused.put((t, s), false),
    status' = status, sessions' = sessions, events' = events, priority' = priority,
    oriented' = oriented,
    resumedWhileInactiveBy' = resumedWhileInactiveBy, prioritySetBy' = prioritySetBy,
    orientationBypassedBy' = orientationBypassedBy, reactivatedBy' = reactivatedBy,
    lastAction' = "pair",
  }

  // ===========================================================================
  // Profiles.status (guard_profile_columns)
  // Allowed: admin -> anything; owner Student/Tutor Active -> Inactive.
  // ===========================================================================
  action setStatus(actor: str, target: str, st: ProfileStatus): bool = all {
    status.get(target) != st,
    actor == ADMIN or (actor == target and status.get(target) == Active and st == Inactive),
    status' = status.set(target, st),
    // deactivation trigger pauses the target's enrollments
    paused' = if (st == Inactive)
        paused.keys().mapBy(k => if (k._1 == target or k._2 == target) true else paused.get(k))
      else paused,
    reactivatedBy' = if (st == Active) reactivatedBy.union(Set(actor)) else reactivatedBy,
    pairings' = pairings, sessions' = sessions, events' = events, priority' = priority,
    oriented' = oriented,
    resumedWhileInactiveBy' = resumedWhileInactiveBy, prioritySetBy' = prioritySetBy,
    orientationBypassedBy' = orientationBypassedBy,
    lastAction' = "setStatus",
  }

  // ===========================================================================
  // Step
  // ===========================================================================
  action step = {
    nondet t = oneOf(TUTORS)
    nondet s = oneOf(STUDENTS)
    nondet actor = oneOf(ACTORS)
    nondet person = oneOf(PEOPLE)
    nondet hours = oneOf(Set(1, 5))
    nondet b = oneOf(Set(true, false))
    nondet st = oneOf(Set(SActive, SComplete, SCancelled))
    nondet ps = oneOf(Set(Active, Inactive))
    any {
      tutorInsertSession(t, s, hours),
      all {
        sessions.keys().size() > 0,
        nondet k = oneOf(sessions.keys())
        tutorUpdateSession(t, k, st, hours),
      },
      insertEvent(actor, t, hours),
      all {
        paused.keys().size() > 0,
        nondet pr = oneOf(paused.keys())
        setPaused(actor, pr, b),
      },
      setPriority(actor, person, hours),
      completeOrientation(t, b),
      pair(t, s),
      setStatus(actor, person, ps),
    }
  }

  // ===========================================================================
  // INVARIANTS
  // ===========================================================================

  // --- Intended to hold ---

  // Only an admin reactivates (guard_profile_columns).
  val onlyAdminReactivates = reactivatedBy.forall(a => a == ADMIN)

  // Sessions only ever name a real tutor and student (FKs + insert policy).
  val sessionsWellFormed =
    sessions.keys().forall(k => TUTORS.contains(sessions.get(k).tutor) and STUDENTS.contains(sessions.get(k).student))

  val safety = onlyAdminReactivates and sessionsWellFormed

  // --- Expected to FAIL: findings, see README.md ---

  // Z1. A tutor can only read profiles (parent name, email, phone) of their
  //     own students. A tutor who inserts a session naming any student id
  //     gains read access through visible_profile_ids().
  val tutorSeesOnlyLinkedStudents =
    TUTORS.forall(t => visibleStudents(t).subseteq(linkedStudents(t)))

  // Z2. Hours credited for a completed session are the hours scheduled.
  //     Tutors can rewrite Sessions.duration (and insert sessions with any
  //     duration, for any student).
  val creditedHoursMatchSchedule =
    sessions.keys().forall(k =>
      sessions.get(k).status == SComplete implies
        (sessions.get(k).duration == PLANNED_HOURS and sessions.get(k).createdBy == "cron"
          or linkedStudents(sessions.get(k).tutor).contains(sessions.get(k).student)
             and sessions.get(k).duration == sessions.get(k).planned
             and sessions.get(k).planned == PLANNED_HOURS))

  // Z3. Event hours are entered by admins (the only app path).
  val eventsEnteredByAdmin = events.forall(e => e.author == ADMIN)

  // Z4. Only an admin resumes an Inactive person's enrollment.
  val inactiveResumedOnlyByAdmin = resumedWhileInactiveBy == Set()

  // Z5. Queue priority is set by admins (PairingRequestCard), not by the requester.
  val priorityAdminOnly = prioritySetBy == Set()

  // Z6 (question). Orientation is completed through the quiz.
  val orientationViaQuiz = orientationBypassedBy == Set()

  // Z7 (question). Tutors complete orientation before they are paired.
  val pairedTutorsOriented = pairings.forall(((t, s)) => oriented.get(t))
}
