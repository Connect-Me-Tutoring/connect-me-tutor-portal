#!/usr/bin/env bash
# Typecheck every module, require `safety` to hold, and require each known
# finding to still be violated. When a bug is fixed its invariant starts
# holding: this script then reports it so it can move from FINDINGS to the
# module's `safety` conjunction.
#
#   specs/quint/check.sh            # default 10000 samples per invariant
#   SAMPLES=50000 specs/quint/check.sh
set -uo pipefail

cd "$(dirname "$0")"
QUINT="${QUINT:-npx --yes @informalsystems/quint@0.33.0}"
SAMPLES="${SAMPLES:-10000}"
STEPS="${STEPS:-25}"

# module:invariant ... for invariants that are currently expected to FAIL.
FINDINGS=(
  connect_me:inactiveTutorCannotPair
  connect_me:inactiveEnrollmentsPaused
  connect_me:onlyAdminResumesInactive
  connect_me:acceptedMatchIsPaired
  connect_me:pairingHasEnrollment
  connect_me:pairedStudentGetsNoNewOffers
  connect_me:atMostOnePendingOfferPerStudent
  accounts:noAccountDeletedByProvisioning
  accounts:provisionedProfileGoesToEmailOwner
  accounts:consentProvisionsOnce
  accounts:adminLoginHasOnlyAdminProfile
  accounts:profileEmailMatchesLogin
  authz:tutorSeesOnlyLinkedStudents
  authz:creditedHoursMatchSchedule
  authz:eventsEnteredByAdmin
  authz:inactiveResumedOnlyByAdmin
  authz:priorityAdminOnly
  authz:orientationViaQuiz
  authz:pairedTutorsOriented
  sessions:noDoubleBooking
  sessions:enrollmentRoomsDisjoint
  sessions:zoomAttributionUnambiguous
  sessions:noRegularSessionSkipped
  sessions:biweeklyRespected
  sessions:cleanupResolvesPastSessions
  sessions:editKeepsUpcomingSessionsUpcoming
  notifications:startedSessionsWereReminded
  notifications:everyDueRecipientCheckedIn
  chat_support:oneAdminConversationPerUser
  chat_support:conversationsHaveParticipant
  chat_support:inactiveNotEmailed
  chat_support:inactiveCannotPost
  chat_support:historyReachable
)
MODULES=(connect_me accounts authz sessions notifications chat_support)

status=0
# Quint exits non-zero on a violation, so capture output instead of piping.
run() { $QUINT run "$1.qnt" --invariant="$2" --max-steps="$STEPS" --max-samples="$SAMPLES" 2>&1 || true; }

for m in "${MODULES[@]}"; do
  if ! $QUINT typecheck "$m.qnt" >/dev/null 2>&1; then
    echo "FAIL  $m: typecheck"; status=1; continue
  fi
  out="$(run "$m" safety)"
  if grep -q "No violation found" <<<"$out"; then
    echo "ok    $m: safety holds"
  else
    echo "FAIL  $m: safety violated"; status=1
  fi
done

for f in "${FINDINGS[@]}"; do
  m="${f%%:*}"; inv="${f#*:}"
  out="$(run "$m" "$inv")"
  if grep -q "Invariant violated" <<<"$out"; then
    echo "ok    $m: $inv still violated (known finding)"
  else
    echo "NOTE  $m: $inv no longer violated in $SAMPLES samples. Fixed? Move it into safety."
    status=1
  fi
done

exit $status
