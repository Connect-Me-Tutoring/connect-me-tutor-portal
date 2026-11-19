// -*- mode: Bluespec; -*-
//
// Connect Me portal: session reminders and early check-ins.
//
// Reminders (lib/email/session-reminders.ts):
//   /api/cron/send-session-reminders runs every 5 minutes and picks sessions
//   starting in the next 20 minutes. For each recipient (tutor, student):
//     1. claim: INSERT session_reminders(session_id, recipient_id), unique
//        index session_reminders_one_per_recipient; 23505 = already scheduled
//     2. publish a QStash message, notBefore = start - 15 min, carrying
//        scheduledFor = the session's start
//     3. store message_id (on failure: delete the message and the claim)
//   QStash calls /api/admin/email/send-email-reminder, which drops the message
//   if the session is gone, Cancelled, or its date != scheduledFor.
//   updateSession clears reminders (removeSessionReminders); rescheduleSession
//   and cancelSession do not.
//
// Time: one slot = one 20-minute reminder window. A session at slot t is
// picked up by cron ticks during slot t-1, and its message fires at the end
// of slot t-1.
//
// Early check-ins (sendEarlySessionCheckInEmails): once a day at noon ET, for
// enrollments that started exactly 14 days ago: for each recipient, skip if
// logged, else send the email, then insert the log row (a failed insert
// throws and aborts the rest of the run).
//
// Run:
//   quint run specs/quint/notifications.qnt --invariant=safety
//   quint run specs/quint/notifications.qnt --invariant=<name> --mbt
module notifications {

  // ===========================================================================
  // Constants
  // ===========================================================================
  pure val SESSIONS = Set("x1", "x2")
  pure val RECIPIENTS = Set("tutor", "student")
  pure val LAST_SLOT = 5
  // Recipients due an early check-in today, in the order the loop visits them.
  pure val CHECKIN_RECIPIENTS = List("r1", "r2", "r3")

  // ===========================================================================
  // Types
  // ===========================================================================
  type SessionStatus = SActive | SCancelled | SComplete
  type Session = { slot: int, status: SessionStatus }
  type Claim = { hasMessage: bool }
  type Message = { session: str, recipient: str, scheduledFor: int, fireAt: int }

  // ===========================================================================
  // State
  // ===========================================================================
  var sessions: str -> Session
  // session_reminders rows (description = 'Session Reminder')
  var claims: (str, str) -> Claim
  // QStash messages not yet delivered
  var queue: Set[Message]
  var now: int
  // whether a reminder cron tick ran during the current slot
  var cronTicked: bool

  // early check-ins
  var checkinLogged: Set[str]
  var checkinSent: Set[str]
  var checkinRunDone: bool

  // ---- ghost ----
  // (session, recipient, slot) reminders actually emailed
  var delivered: Set[(str, str, int)]
  // reminders emailed for a session that was cancelled or had moved
  var staleDelivered: Set[(str, str)]
  var lastAction: str

  // ===========================================================================
  // Helpers
  // ===========================================================================
  def inWindow(x: str): bool =
    sessions.get(x).slot == now + 1 and sessions.get(x).status == SActive

  action keepCheckins = all {
    checkinLogged' = checkinLogged, checkinSent' = checkinSent, checkinRunDone' = checkinRunDone,
  }

  action init = all {
    nondet s1 = oneOf(1.to(LAST_SLOT))
    nondet s2 = oneOf(1.to(LAST_SLOT))
    sessions' = Map("x1" -> { slot: s1, status: SActive }, "x2" -> { slot: s2, status: SActive }),
    claims' = Map(),
    queue' = Set(),
    now' = 0,
    cronTicked' = false,
    checkinLogged' = Set(),
    checkinSent' = Set(),
    checkinRunDone' = false,
    delivered' = Set(),
    staleDelivered' = Set(),
    lastAction' = "init",
  }

  // ===========================================================================
  // Reminder cron, one recipient at a time so concurrent ticks interleave.
  // ===========================================================================

  // Step 1: claim. A concurrent tick that loses the insert race stops here.
  action claim(x: str, r: str): bool = all {
    inWindow(x),
    not(claims.keys().contains((x, r))),
    claims' = claims.put((x, r), { hasMessage: false }),
    cronTicked' = true,
    sessions' = sessions, queue' = queue, now' = now,
    delivered' = delivered, staleDelivered' = staleDelivered, keepCheckins,
    lastAction' = "claim",
  }

  // Steps 2-3: publish and record message_id. On failure the claim is
  // deleted so a later tick in the same window retries.
  action publish(x: str, r: str, ok: bool): bool = all {
    claims.keys().contains((x, r)),
    not(claims.get((x, r)).hasMessage),
    if (ok) all {
      claims' = claims.set((x, r), { hasMessage: true }),
      queue' = queue.union(Set({ session: x, recipient: r, scheduledFor: sessions.get(x).slot,
                                 fireAt: sessions.get(x).slot - 1 })),
    } else all {
      claims' = claims.keys().exclude(Set((x, r))).mapBy(k => claims.get(k)),
      queue' = queue,
    },
    cronTicked' = true,
    sessions' = sessions, now' = now,
    delivered' = delivered, staleDelivered' = staleDelivered, keepCheckins,
    lastAction' = "publish",
  }

  // A cron tick that finds nothing new to do.
  action idleTick = all {
    cronTicked' = true,
    sessions' = sessions, claims' = claims, queue' = queue, now' = now,
    delivered' = delivered, staleDelivered' = staleDelivered, keepCheckins,
    lastAction' = "idleTick",
  }

  // ===========================================================================
  // Session changes
  // ===========================================================================

  // rescheduleSession: date changes, reminders untouched.
  action rescheduleKeepClaims(x: str, slot: int): bool = all {
    sessions.get(x).status == SActive,
    sessions.get(x).slot > now,
    // leave at least one cron window before the new start
    slot >= now + 2, slot <= LAST_SLOT,
    sessions' = sessions.set(x, { ...sessions.get(x), slot: slot }),
    claims' = claims, queue' = queue, now' = now, cronTicked' = cronTicked,
    delivered' = delivered, staleDelivered' = staleDelivered, keepCheckins,
    lastAction' = "rescheduleKeepClaims",
  }

  // updateSession (admin edit / tutor dashboard): date changes, then
  // removeSessionReminders cancels the messages and deletes the claims.
  action updateSessionClearClaims(x: str, slot: int): bool = all {
    sessions.get(x).status == SActive,
    sessions.get(x).slot > now,
    slot >= now + 2, slot <= LAST_SLOT,
    sessions' = sessions.set(x, { ...sessions.get(x), slot: slot }),
    claims' = claims.keys().filter(k => k._1 != x).mapBy(k => claims.get(k)),
    queue' = queue.filter(m => m.session != x),
    now' = now, cronTicked' = cronTicked,
    delivered' = delivered, staleDelivered' = staleDelivered, keepCheckins,
    lastAction' = "updateSessionClearClaims",
  }

  action cancel(x: str): bool = all {
    sessions.get(x).status == SActive,
    sessions.get(x).slot > now,
    sessions' = sessions.set(x, { ...sessions.get(x), status: SCancelled }),
    claims' = claims, queue' = queue, now' = now, cronTicked' = cronTicked,
    delivered' = delivered, staleDelivered' = staleDelivered, keepCheckins,
    lastAction' = "cancel",
  }

  // ===========================================================================
  // Time: at the end of a slot QStash delivers due messages, and the send
  // route filters them. At least one cron tick runs in every slot.
  // ===========================================================================
  action advance = {
    val due = queue.filter(m => m.fireAt <= now)
    val sendable = due.filter(m =>
      sessions.get(m.session).status != SCancelled and sessions.get(m.session).slot == m.scheduledFor)
    all {
      now < LAST_SLOT,
      cronTicked,
      // the 5-minute cron is reliable: every in-window session has a claim
      // with a message for each recipient before the window closes
      SESSIONS.forall(x => inWindow(x) implies
        RECIPIENTS.forall(r => claims.keys().contains((x, r)) and claims.get((x, r)).hasMessage)),
      queue' = queue.exclude(due),
      delivered' = delivered.union(sendable.map(m => (m.session, m.recipient, m.scheduledFor))),
      staleDelivered' = staleDelivered.union(
        sendable.filter(m => sessions.get(m.session).status != SActive or sessions.get(m.session).slot != m.scheduledFor)
          .map(m => (m.session, m.recipient))),
      now' = now + 1,
      cronTicked' = false,
      sessions' = sessions, claims' = claims, keepCheckins,
      lastAction' = "advance",
    }
  }

  // ===========================================================================
  // Early check-in run (once a day). `failAt` is the index whose log insert
  // fails (-1: none); the loop throws there.
  // ===========================================================================
  action checkinRun(failAt: int): bool = all {
    not(checkinRunDone),
    val n = CHECKIN_RECIPIENTS.length()
    val stop = if (failAt >= 0) failAt else n
    val visited = 0.to(n - 1).filter(i => i <= stop and i < n).map(i => CHECKIN_RECIPIENTS[i])
    val logged = 0.to(n - 1).filter(i => i < stop).map(i => CHECKIN_RECIPIENTS[i])
    all {
      checkinSent' = checkinSent.union(visited.exclude(checkinLogged)),
      checkinLogged' = checkinLogged.union(logged),
    },
    checkinRunDone' = true,
    sessions' = sessions, claims' = claims, queue' = queue, now' = now, cronTicked' = cronTicked,
    delivered' = delivered, staleDelivered' = staleDelivered,
    lastAction' = "checkinRun",
  }

  // ===========================================================================
  // Step
  // ===========================================================================
  action step = {
    nondet x = oneOf(SESSIONS)
    nondet r = oneOf(RECIPIENTS)
    nondet ok = oneOf(Set(true, false))
    nondet slot = oneOf(0.to(LAST_SLOT))
    nondet failAt = oneOf(Set(-1, 0, 1, 2))
    any {
      claim(x, r),
      publish(x, r, true),
      idleTick,
      rescheduleKeepClaims(x, slot),
      updateSessionClearClaims(x, slot),
      cancel(x),
      advance,
      checkinRun(failAt),
    }
  }

  // ===========================================================================
  // INVARIANTS
  // ===========================================================================

  // --- Intended to hold ---

  // At most one queued message per (session, recipient) (claim-first design).
  val oneMessagePerRecipient =
    queue.forall(a => queue.forall(b => (a.session == b.session and a.recipient == b.recipient) implies a == b))

  // Nobody is reminded about a cancelled or moved session (send-route checks).
  val noStaleReminder = staleDelivered == Set()

  // No reminder is emailed twice for the same session time.
  val claimsMatchQueue =
    queue.forall(m => claims.keys().contains((m.session, m.recipient)))

  val safety = oneMessagePerRecipient and noStaleReminder and claimsMatchQueue

  // --- Expected to FAIL: findings, see README.md ---

  // N1. Every Active session that has started got both reminders for its
  //     current time. Broken by rescheduleSession after the claim was made:
  //     the old message is dropped (time changed) and the new window's claim
  //     hits the unique index ("already scheduled"), so nobody is reminded.
  //     (publish failures are excluded from step, so this is not about outages.)
  val startedSessionsWereReminded =
    SESSIONS.forall(x =>
      (sessions.get(x).status == SActive and sessions.get(x).slot <= now and sessions.get(x).slot >= 1)
        implies RECIPIENTS.forall(r => delivered.contains((x, r, sessions.get(x).slot))))

  // N2. After the day's run, every due recipient got their check-in. A failed
  //     log insert aborts the loop, and the next noon run targets a different
  //     start date, so later recipients never get one.
  val everyDueRecipientCheckedIn =
    checkinRunDone implies CHECKIN_RECIPIENTS.indices().forall(i => checkinSent.contains(CHECKIN_RECIPIENTS[i]))
}
