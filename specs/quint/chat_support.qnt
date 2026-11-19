// -*- mode: Bluespec; -*-
//
// Connect Me portal: chat rooms, chat emails and support tickets.
//
// Rooms (lib/chat/resolve-chat-recipients.ts, private.chat_room_ids()):
//   pairing room       id = Pairings.id; members = that tutor and student
//   admin conversation conversations.admin_conversation; members =
//                      conversation_participant rows + every admin
//   announcements      two fixed ids; recipients = every profile with the role
// sendChatMessage inserts the message (RLS messages_insert_participant), then
// dispatchChatMessageEmails emails the room's recipients unless they muted it.
// createAdminConversation: fetch existing -> insert conversation -> insert
// participant (error ignored). No unique constraint per user.
//
// Tickets (20260930000000_create_tickets.sql): users insert their own with
// status 'open'; only admins update or delete.
//
// Run:
//   quint run specs/quint/chat_support.qnt --invariant=safety
//   quint run specs/quint/chat_support.qnt --invariant=<name> --mbt
module chat_support {

  // ===========================================================================
  // Constants
  // ===========================================================================
  pure val USERS = Set("t1", "s1")
  pure val ADMIN = "A"
  pure val MAX_CONVS = 3
  pure val MAX_TICKETS = 2
  // concurrent requests per user (two tabs, or a double click)
  pure val TABS = Set(1, 2)

  // ===========================================================================
  // Types
  // ===========================================================================
  type ProfileStatus = Active | Inactive
  type TicketStatus = TOpen | TInProgress | TResolved | TClosed
  type Ticket = { owner: str, status: TicketStatus }
  // createAdminConversation progress per user
  type Creating = NotCreating | SawNone | Inserted(int)

  // ===========================================================================
  // State
  // ===========================================================================
  var status: str -> ProfileStatus
  var muted: Set[str]                  // muted the announcements room
  // admin conversations: id -> participants
  var convs: int -> Set[str]
  var creating: (str, int) -> Creating
  // pairing room t1-s1: exists while the Pairings row does
  var pairingRoomLive: bool
  var pairingGeneration: int           // a re-pair gets a new Pairings.id
  var messagesInGeneration: Set[int]   // generations that have messages
  var tickets: int -> Ticket

  // ---- ghost ----
  var emailedInactive: Set[str]
  var inactivePosted: Set[str]
  var ticketChangedBy: Set[str]
  var lastAction: str

  // ===========================================================================
  // Helpers
  // ===========================================================================
  def convsOf(u: str): Set[int] = convs.keys().filter(c => convs.get(c).contains(u))

  action keepTickets = all { tickets' = tickets, ticketChangedBy' = ticketChangedBy }
  action keepPairing = all {
    pairingRoomLive' = pairingRoomLive, pairingGeneration' = pairingGeneration,
    messagesInGeneration' = messagesInGeneration,
  }

  action init = all {
    status' = USERS.mapBy(_ => Active),
    muted' = Set(),
    convs' = Map(),
    creating' = tuples(USERS, TABS).mapBy(_ => NotCreating),
    pairingRoomLive' = true,
    pairingGeneration' = 0,
    messagesInGeneration' = Set(),
    tickets' = Map(),
    emailedInactive' = Set(),
    inactivePosted' = Set(),
    ticketChangedBy' = Set(),
    lastAction' = "init",
  }

  // ===========================================================================
  // Admin conversations (each step is one round trip, so two tabs or a
  // double click interleave)
  // ===========================================================================
  action convFetch(u: str, tab: int): bool = all {
    creating.get((u, tab)) == NotCreating,
    convsOf(u).size() == 0,
    creating' = creating.set((u, tab), SawNone),
    status' = status, muted' = muted, convs' = convs, keepPairing, keepTickets,
    emailedInactive' = emailedInactive, inactivePosted' = inactivePosted,
    lastAction' = "convFetch",
  }

  action convInsert(u: str, tab: int): bool = all {
    creating.get((u, tab)) == SawNone,
    convs.keys().size() < MAX_CONVS,
    val id = convs.keys().size()
    all {
      convs' = convs.put(id, Set()),
      creating' = creating.set((u, tab), Inserted(id)),
    },
    status' = status, muted' = muted, keepPairing, keepTickets,
    emailedInactive' = emailedInactive, inactivePosted' = inactivePosted,
    lastAction' = "convInsert",
  }

  // The participant insert's error is not checked.
  action convAddParticipant(u: str, tab: int, ok: bool): bool = all {
    val id = match creating.get((u, tab)) { | Inserted(i) => i | _ => -1 }
    all {
      id >= 0,
      convs' = if (ok) convs.set(id, convs.get(id).union(Set(u))) else convs,
      creating' = creating.set((u, tab), NotCreating),
    },
    status' = status, muted' = muted, keepPairing, keepTickets,
    emailedInactive' = emailedInactive, inactivePosted' = inactivePosted,
    lastAction' = "convAddParticipant",
  }

  // ===========================================================================
  // Messages and emails
  // ===========================================================================

  // Admin posts to the announcements room: every profile with the role is
  // emailed unless muted. Profiles.status is not consulted.
  action announce = all {
    emailedInactive' = emailedInactive.union(
      USERS.filter(u => status.get(u) == Inactive and not(muted.contains(u)))),
    status' = status, muted' = muted, convs' = convs, creating' = creating, keepPairing, keepTickets,
    inactivePosted' = inactivePosted,
    lastAction' = "announce",
  }

  // Post in the t1-s1 pairing room. RLS: room id is in the sender's
  // pairing_ids(); deactivation leaves the Pairings row in place.
  action postPairingRoom(u: str): bool = all {
    pairingRoomLive,
    messagesInGeneration' = messagesInGeneration.union(Set(pairingGeneration)),
    inactivePosted' = if (status.get(u) == Inactive) inactivePosted.union(Set(u)) else inactivePosted,
    pairingRoomLive' = pairingRoomLive, pairingGeneration' = pairingGeneration,
    status' = status, muted' = muted, convs' = convs, creating' = creating, keepTickets,
    emailedInactive' = emailedInactive,
    lastAction' = "postPairingRoom",
  }

  // deletePairingServer: messages (room_id has no FK) stay behind.
  action unpair = all {
    pairingRoomLive,
    pairingRoomLive' = false,
    pairingGeneration' = pairingGeneration, messagesInGeneration' = messagesInGeneration,
    status' = status, muted' = muted, convs' = convs, creating' = creating, keepTickets,
    emailedInactive' = emailedInactive, inactivePosted' = inactivePosted,
    lastAction' = "unpair",
  }

  // Same pair matched again: new Pairings.id, new empty room.
  action repair = all {
    not(pairingRoomLive),
    pairingRoomLive' = true,
    pairingGeneration' = pairingGeneration + 1,
    messagesInGeneration' = messagesInGeneration,
    status' = status, muted' = muted, convs' = convs, creating' = creating, keepTickets,
    emailedInactive' = emailedInactive, inactivePosted' = inactivePosted,
    lastAction' = "repair",
  }

  action setStatus(u: str, st: ProfileStatus): bool = all {
    status' = status.set(u, st),
    muted' = muted, convs' = convs, creating' = creating, keepPairing, keepTickets,
    emailedInactive' = emailedInactive, inactivePosted' = inactivePosted,
    lastAction' = "setStatus",
  }

  action mute(u: str): bool = all {
    muted' = muted.union(Set(u)),
    status' = status, convs' = convs, creating' = creating, keepPairing, keepTickets,
    emailedInactive' = emailedInactive, inactivePosted' = inactivePosted,
    lastAction' = "mute",
  }

  // ===========================================================================
  // Tickets
  // ===========================================================================
  // tickets_insert_own: status must be 'open'.
  action submitTicket(u: str): bool = all {
    tickets.keys().size() < MAX_TICKETS,
    tickets' = tickets.put(tickets.keys().size(), { owner: u, status: TOpen }),
    ticketChangedBy' = ticketChangedBy,
    status' = status, muted' = muted, convs' = convs, creating' = creating, keepPairing,
    emailedInactive' = emailedInactive, inactivePosted' = inactivePosted,
    lastAction' = "submitTicket",
  }

  // tickets_admin_update: only admins pass RLS.
  action updateTicket(actor: str, k: int, st: TicketStatus): bool = all {
    tickets.keys().contains(k),
    actor == ADMIN,
    tickets' = tickets.set(k, { ...tickets.get(k), status: st }),
    ticketChangedBy' = ticketChangedBy.union(Set(actor)),
    status' = status, muted' = muted, convs' = convs, creating' = creating, keepPairing,
    emailedInactive' = emailedInactive, inactivePosted' = inactivePosted,
    lastAction' = "updateTicket",
  }

  // ===========================================================================
  // Step
  // ===========================================================================
  action step = {
    nondet u = oneOf(USERS)
    nondet tab = oneOf(TABS)
    nondet ok = oneOf(Set(true, false))
    nondet st = oneOf(Set(Active, Inactive))
    nondet actor = oneOf(USERS.union(Set(ADMIN)))
    nondet ts = oneOf(Set(TOpen, TInProgress, TResolved, TClosed))
    any {
      convFetch(u, tab), convInsert(u, tab), convAddParticipant(u, tab, ok),
      announce, postPairingRoom(u), unpair, repair,
      setStatus(u, st), mute(u),
      submitTicket(u),
      all {
        tickets.keys().size() > 0,
        nondet k = oneOf(tickets.keys())
        updateTicket(actor, k, ts),
      },
    }
  }

  // ===========================================================================
  // INVARIANTS
  // ===========================================================================

  // --- Intended to hold ---
  val ticketsChangedOnlyByAdmin = ticketChangedBy.subseteq(Set(ADMIN))
  val ticketsHaveOwners = tickets.keys().forall(k => USERS.contains(tickets.get(k).owner))
  val safety = ticketsChangedOnlyByAdmin and ticketsHaveOwners

  // --- Expected to FAIL: findings / questions, see README.md ---

  // C1. A user has at most one admin conversation (fetch-then-insert race).
  val oneAdminConversationPerUser = USERS.forall(u => convsOf(u).size() <= 1)

  // C2. Every admin conversation has its user in it (participant insert
  //     error is ignored, leaving an empty conversation; the next visit
  //     creates another).
  val conversationsHaveParticipant =
    convs.keys().forall(c => convs.get(c).size() > 0 or
      creating.keys().exists(k => creating.get(k) == Inserted(c)))

  // C3 (question). Deactivated people get no announcement emails.
  val inactiveNotEmailed = emailedInactive == Set()

  // C4 (question). Deactivated people cannot post in their pairing room.
  val inactiveCannotPost = inactivePosted == Set()

  // C5 (question). Chat history survives an unpair / re-pair of the same people.
  val historyReachable = messagesInGeneration.forall(g => g == pairingGeneration and pairingRoomLive)
}
