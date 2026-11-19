// -*- mode: Bluespec; -*-
//
// Connect Me portal: accounts, profiles and provisioning.
//
// One auth user (login) can own several Profiles (a parent with several
// children, a tutor who is also a student). user_settings.last_active_profile_id
// picks which one the app acts as. Models:
//   provisionUser (lib/auth/provision-user.server.ts), called by admin
//     createUser and by provisionLegacyPendingParentalConsents
//   insert_user_settings trigger (prod only, not in migrations)
//   switchProfile, deleteUser (lib/actions/auth/server.actions.ts)
//   email changes: admin editProfile -> updateAccountEmail, self-service
//     requestEmailChange -> /auth/confirm syncConfirmedEmail, and direct
//     Profiles.email writes (profiles_update_own RLS; email is not a guarded
//     column in guard_profile_columns)
//
// Run:
//   quint run specs/quint/accounts.qnt --invariant=safety
//   quint run specs/quint/accounts.qnt --invariant=<name> --mbt
module accounts {

  // ===========================================================================
  // Constants
  // ===========================================================================
  pure val USERS = Set("u1", "u2", "u3", "u4")
  pure val PIDS = Set("p1", "p2", "p3", "p4", "p5")
  pure val EMAILS = Set("a@x", "b@x", "c@x")
  pure val CONSENTS = Set("c1")
  // The student email parked on legacy consent request c1.
  pure val CONSENT_EMAIL = "c@x"

  // ===========================================================================
  // Types
  // ===========================================================================
  type Role = Admin | Tutor | Student
  type Profile = { user: str, role: Role, email: str }
  type ConsentStatus = CPending | CProcessing | CApproved | CExpired

  // ===========================================================================
  // State
  // ===========================================================================
  // auth.users: live users and their login email
  var authEmail: str -> str
  // auth.users.new_email while a self-service change awaits confirmation
  var pendingEmail: str -> str
  var profiles: str -> Profile
  // user_settings.last_active_profile_id (FK to Profiles, no ON DELETE action)
  var active: str -> str
  var consent: str -> ConsentStatus

  // ---- ghost ----
  // Profiles each consent request produced.
  var consentMade: str -> Set[str]
  // Accounts with profiles that provisionUser's invite cleanup deleted.
  var wrongfullyDeleted: Set[str]
  // Profiles provisioned for email E but attached to a login whose email is not E.
  var misattached: Set[str]
  var lastAction: str

  // ===========================================================================
  // Helpers
  // ===========================================================================
  def freePids = PIDS.exclude(profiles.keys())
  def freeUsers = USERS.exclude(authEmail.keys())
  def profilesOf(u: str): Set[str] = profiles.keys().filter(p => profiles.get(p).user == u)
  def loginsWithEmail(e: str): Set[str] = authEmail.keys().filter(u => authEmail.get(u) == e)
  def profilesWithEmail(e: str): Set[str] = profiles.keys().filter(p => profiles.get(p).email == e)
  def consentAfter(c: str, ok: bool): str -> ConsentStatus =
    if (c == "") consent else consent.set(c, if (ok) CApproved else CPending)
  def consentMadeAfter(c: str, pid: str): str -> Set[str] =
    if (c == "") consentMade else consentMade.set(c, consentMade.get(c).union(Set(pid)))
  def withoutKeys(m: str -> a, ks: Set[str]): str -> a =
    m.keys().exclude(ks).mapBy(k => m.get(k))

  // ===========================================================================
  // Init: u1 is an admin, u2 a tutor; consent c1 is a legacy pending request.
  // ===========================================================================
  action init = all {
    authEmail' = Map("u1" -> "a@x", "u2" -> "b@x"),
    pendingEmail' = Map(),
    profiles' = Map(
      "p1" -> { user: "u1", role: Admin, email: "a@x" },
      "p2" -> { user: "u2", role: Tutor, email: "b@x" },
    ),
    active' = Map("u1" -> "p1", "u2" -> "p2"),
    consent' = Map("c1" -> CPending),
    consentMade' = Map("c1" -> Set()),
    wrongfullyDeleted' = Set(),
    misattached' = Set(),
    lastAction' = "init",
  }

  // ===========================================================================
  // provisionUser(email, role)
  // ===========================================================================
  // 1. prevProfile = Profiles where email = E, limit 1 (no ORDER BY: any match).
  //    If its role is Admin: throw "Multiple profiles prohibited".
  //    Otherwise attach the new profile to prevProfile.user_id.
  // 2. No prevProfile: inviteUserByEmail(E). If that fails (E is already a
  //    login), the cleanup looks up get_user_by_email(E) and DELETES that auth
  //    user. Profiles.user_id is ON DELETE CASCADE, so their profiles,
  //    enrollments and pairings go with it. Then it throws.
  // 3. New login: insert profile; insert_user_settings makes it active.
  // ensurePairingQueueForNewProfile runs after the insert and can throw
  // (queueFails); the profile stays but the caller sees an error.
  // `c` is the consent request driving this call, or "" for admin createUser.
  // 1a. prevProfile is an Admin: refused.
  action provisionRefused(email: str, c: str): bool = all {
    profilesWithEmail(email).exists(p => profiles.get(p).role == Admin),
    consent' = consentAfter(c, false),
    authEmail' = authEmail, pendingEmail' = pendingEmail, profiles' = profiles,
    active' = active, consentMade' = consentMade,
    wrongfullyDeleted' = wrongfullyDeleted, misattached' = misattached,
  }

  // 1b. prevProfile (any non-admin match): attach the new profile to its login.
  action provisionAttach(email: str, role: Role, queueFails: bool, c: str): bool = {
    val prevs = profilesWithEmail(email).filter(p => profiles.get(p).role != Admin)
    all {
      prevs.size() > 0,
      freePids.size() > 0,
      nondet prev = oneOf(prevs)
      nondet pid = oneOf(freePids)
      val prevUser = profiles.get(prev).user
      all {
        profiles' = profiles.put(pid, { user: prevUser, role: role, email: email }),
        // insert_user_settings: ON CONFLICT (user_id) DO NOTHING
        active' = if (active.keys().contains(prevUser)) active else active.put(prevUser, pid),
        consent' = consentAfter(c, not(queueFails) or role == Admin),
        consentMade' = consentMadeAfter(c, pid),
        misattached' =
          if (authEmail.keys().contains(prevUser) and authEmail.get(prevUser) == email) misattached
          else misattached.union(Set(pid)),
        authEmail' = authEmail, pendingEmail' = pendingEmail, wrongfullyDeleted' = wrongfullyDeleted,
      },
    }
  }

  // 2. No profile has this email but a login does: invite fails, cleanup
  //    deletes that login (cascade), then throws.
  action provisionInviteFails(email: str, c: str): bool = {
    val owners = loginsWithEmail(email)
    all {
      profilesWithEmail(email).size() == 0,
      owners.size() > 0,
      nondet victim = oneOf(owners)
      val gone = profilesOf(victim)
      all {
        authEmail' = withoutKeys(authEmail, Set(victim)),
        pendingEmail' = withoutKeys(pendingEmail, Set(victim)),
        profiles' = withoutKeys(profiles, gone),
        active' = withoutKeys(active, Set(victim)),
        wrongfullyDeleted' = if (gone.size() > 0) wrongfullyDeleted.union(Set(victim)) else wrongfullyDeleted,
        consent' = consentAfter(c, false),
        consentMade' = consentMade, misattached' = misattached,
      },
    }
  }

  // 3. Fresh login: invite, insert profile, settings trigger makes it active.
  action provisionNewLogin(email: str, role: Role, queueFails: bool, c: str): bool = all {
    profilesWithEmail(email).size() == 0,
    loginsWithEmail(email).size() == 0,
    freeUsers.size() > 0,
    freePids.size() > 0,
    nondet u = oneOf(freeUsers)
    nondet pid = oneOf(freePids)
    all {
      authEmail' = authEmail.put(u, email),
      profiles' = profiles.put(pid, { user: u, role: role, email: email }),
      active' = active.put(u, pid),
      consent' = consentAfter(c, not(queueFails) or role == Admin),
      consentMade' = consentMadeAfter(c, pid),
      pendingEmail' = pendingEmail, wrongfullyDeleted' = wrongfullyDeleted, misattached' = misattached,
    },
  }

  // `c` is the consent request driving this call, or "" for admin createUser.
  // limit(1) has no ORDER BY, so with several matching profiles either the
  // refusal or the attach can happen.
  action provision(email: str, role: Role, queueFails: bool, c: str): bool = any {
    provisionRefused(email, c),
    provisionAttach(email, role, queueFails, c),
    provisionInviteFails(email, c),
    provisionNewLogin(email, role, queueFails, c),
  }

  // Admin "Create user".
  action adminCreateUser(email: str, role: Role, queueFails: bool): bool = all {
    provision(email, role, queueFails, ""),
    lastAction' = "adminCreateUser",
  }

  // provisionLegacyPendingConsentRequests, step 1: conditional claim
  // (pending -> processing), so two concurrent runs can't both take it.
  action consentClaim(c: str): bool = all {
    consent.get(c) == CPending,
    consent' = consent.set(c, CProcessing),
    authEmail' = authEmail, pendingEmail' = pendingEmail, profiles' = profiles, active' = active,
    consentMade' = consentMade, wrongfullyDeleted' = wrongfullyDeleted, misattached' = misattached,
    lastAction' = "consentClaim",
  }

  // Step 2: provision; on success -> approved, on any throw -> back to pending.
  action consentProvision(c: str, queueFails: bool): bool = all {
    consent.get(c) == CProcessing,
    provision(CONSENT_EMAIL, Student, queueFails, c),
    lastAction' = "consentProvision",
  }

  // ===========================================================================
  // Profile switching and deletion
  // ===========================================================================
  action switchProfile(u: str, p: str): bool = all {
    profiles.keys().contains(p),
    profiles.get(p).user == u,
    active' = active.put(u, p),
    authEmail' = authEmail, pendingEmail' = pendingEmail, profiles' = profiles, consent' = consent,
    consentMade' = consentMade, wrongfullyDeleted' = wrongfullyDeleted, misattached' = misattached,
    lastAction' = "switchProfile",
  }

  // deleteUser(profileId), admin. If it is the login's only profile the auth
  // user is deleted (cascade). Otherwise, if it is the active profile,
  // replaceLastActiveProfile runs WITHOUT await: if the DELETE wins the race
  // the FK on user_settings rejects it (the action throws, the profile stays),
  // and the replacement still lands afterwards.
  action deleteProfile(p: str, replaceFirst: bool): bool = {
    val u = profiles.get(p).user
    val others = profilesOf(u).exclude(Set(p))
    all {
      profiles.keys().contains(p),
      if (others.size() == 0) all {
        authEmail' = withoutKeys(authEmail, Set(u)),
        pendingEmail' = withoutKeys(pendingEmail, Set(u)),
        profiles' = withoutKeys(profiles, Set(p)),
        active' = withoutKeys(active, Set(u)),
      } else if (active.keys().contains(u) and active.get(u) == p) {
        nondet nextActive = oneOf(others)
        all {
          active' = active.set(u, nextActive),
          profiles' = if (replaceFirst) withoutKeys(profiles, Set(p)) else profiles,
          authEmail' = authEmail, pendingEmail' = pendingEmail,
        }
      } else all {
        profiles' = withoutKeys(profiles, Set(p)),
        active' = active, authEmail' = authEmail, pendingEmail' = pendingEmail,
      },
      consent' = consent, consentMade' = consentMade,
      wrongfullyDeleted' = wrongfullyDeleted, misattached' = misattached,
      lastAction' = "deleteProfile",
    }
  }

  // ===========================================================================
  // Email changes
  // ===========================================================================
  def emailFree(e: str): bool = loginsWithEmail(e).size() == 0 and
    not(pendingEmail.keys().exists(u => pendingEmail.get(u) == e))

  // Admin editProfile -> updateAccountEmail: auth first, then copy to every
  // profile of the login. The copy can fail ("Login email changed, but the
  // profile could not be updated").
  action adminChangeEmail(p: str, e: str, syncOk: bool): bool = {
    val u = profiles.get(p).user
    all {
      profiles.keys().contains(p),
      authEmail.keys().contains(u),
      emailFree(e),
      authEmail' = authEmail.set(u, e),
      profiles' = if (syncOk)
          profiles.keys().mapBy(q => if (profiles.get(q).user == u) { ...profiles.get(q), email: e } else profiles.get(q))
        else profiles,
      pendingEmail' = pendingEmail, active' = active, consent' = consent,
      consentMade' = consentMade, wrongfullyDeleted' = wrongfullyDeleted, misattached' = misattached,
      lastAction' = "adminChangeEmail",
    }
  }

  // requestEmailChange: Supabase holds it in new_email until both links are confirmed.
  action requestEmailChange(u: str, e: str): bool = all {
    authEmail.keys().contains(u),
    emailFree(e),
    pendingEmail' = pendingEmail.put(u, e),
    authEmail' = authEmail, profiles' = profiles, active' = active, consent' = consent,
    consentMade' = consentMade, wrongfullyDeleted' = wrongfullyDeleted, misattached' = misattached,
    lastAction' = "requestEmailChange",
  }

  // Second confirmation link -> /auth/confirm -> syncConfirmedEmail (which can
  // fail, and is skipped entirely if the link lands somewhere else).
  action confirmEmailChange(u: str, syncOk: bool): bool = all {
    pendingEmail.keys().contains(u),
    val e = pendingEmail.get(u)
    all {
      // Supabase re-checks at confirmation: the address must still be free.
      loginsWithEmail(e).size() == 0,
      authEmail' = authEmail.set(u, e),
      profiles' = if (syncOk)
          profiles.keys().mapBy(q => if (profiles.get(q).user == u) { ...profiles.get(q), email: e } else profiles.get(q))
        else profiles,
    },
    pendingEmail' = withoutKeys(pendingEmail, Set(u)),
    active' = active, consent' = consent,
    consentMade' = consentMade, wrongfullyDeleted' = wrongfullyDeleted, misattached' = misattached,
    lastAction' = "confirmEmailChange",
  }

  // A signed-in user PATCHes their own Profiles.email straight through the API
  // (profiles_update_own; email is not in guard_profile_columns' list).
  action selfSetProfileEmail(p: str, e: str): bool = all {
    profiles.keys().contains(p),
    profiles.get(p).role != Admin,
    profiles' = profiles.set(p, { ...profiles.get(p), email: e }),
    authEmail' = authEmail, pendingEmail' = pendingEmail, active' = active, consent' = consent,
    consentMade' = consentMade, wrongfullyDeleted' = wrongfullyDeleted, misattached' = misattached,
    lastAction' = "selfSetProfileEmail",
  }

  // ===========================================================================
  // Step
  // ===========================================================================
  action step = any {
    nondet e = oneOf(EMAILS)
    nondet r = oneOf(Set(Admin, Tutor, Student))
    nondet qf = oneOf(Set(true, false))
    adminCreateUser(e, r, qf),
    nondet c = oneOf(CONSENTS)
    nondet qf = oneOf(Set(true, false))
    any { consentClaim(c), consentProvision(c, qf) },
    all {
      profiles.keys().size() > 0,
      nondet p = oneOf(profiles.keys())
      nondet e = oneOf(EMAILS)
      nondet b = oneOf(Set(true, false))
      any { deleteProfile(p, b), adminChangeEmail(p, e, b), selfSetProfileEmail(p, e) },
    },
    all {
      authEmail.keys().size() > 0,
      nondet u = oneOf(authEmail.keys())
      nondet e = oneOf(EMAILS)
      nondet b = oneOf(Set(true, false))
      nondet p = oneOf(PIDS)
      any { requestEmailChange(u, e), confirmEmailChange(u, b), switchProfile(u, p) },
    },
  }

  // ===========================================================================
  // INVARIANTS
  // ===========================================================================

  // --- Intended to hold ---

  // The app always has a profile to act as, and it belongs to the login
  // (the FK on user_settings stops the unawaited-replace race from breaking it).
  val activeProfileValid =
    active.keys().forall(u =>
      profiles.keys().contains(active.get(u)) and profiles.get(active.get(u)).user == u)

  // Every login with profiles has an active profile.
  val everyLoginHasActiveProfile =
    authEmail.keys().forall(u => profilesOf(u).size() > 0 implies active.keys().contains(u))

  // No dangling profiles (cascade from auth.users).
  val profilesHaveLogin = profiles.keys().forall(p => authEmail.keys().contains(profiles.get(p).user))

  // Two logins never share an email (Supabase enforces).
  val loginEmailsUnique =
    authEmail.keys().forall(u => authEmail.keys().forall(v => u != v implies authEmail.get(u) != authEmail.get(v)))

  val safety = activeProfileValid and everyLoginHasActiveProfile and profilesHaveLogin and loginEmailsUnique

  // --- Expected to FAIL: findings, see README.md ---

  // A1. Creating a user never deletes someone else's account. Broken when the
  //     email is a login whose Profiles.email differs (85 such logins in prod).
  val noAccountDeletedByProvisioning = wrongfullyDeleted == Set()

  // A2. A provisioned profile lands on the login that owns that email.
  //     Broken by Profiles.email drift, including a user writing their own
  //     Profiles.email to an address an admin later provisions.
  val provisionedProfileGoesToEmailOwner = misattached == Set()

  // A3. A consent request creates at most one student profile. Broken when
  //     the queue insert throws after the profile was created: the request
  //     goes back to pending and the next run provisions a second profile.
  val consentProvisionsOnce = CONSENTS.forall(c => consentMade.get(c).size() <= 1)

  // A4 (question). An admin login has no other profiles (provisionUser
  //     intends this, but only checks one arbitrary prevProfile and only in
  //     one direction). 3 admin logins in prod own other profiles.
  val adminLoginHasOnlyAdminProfile =
    authEmail.keys().forall(u =>
      profilesOf(u).exists(p => profiles.get(p).role == Admin) implies profilesOf(u).size() == 1)

  // A5 (data quality; precondition of A1/A2). Profiles.email mirrors the login email.
  val profileEmailMatchesLogin =
    profiles.keys().forall(p => authEmail.get(profiles.get(p).user) == profiles.get(p).email)
}
