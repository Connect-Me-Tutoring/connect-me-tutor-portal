"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserAvailabilityList } from "../ui/availability-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PairingRequestCard } from "./que/request-card";
import { useFetchProfile } from "@/hooks/auth";
import {
  getIncomingPairingMatches,
  IncomingPairingMatch,
} from "@/lib/actions/pairing.actions";
import { updatePairingMatchStatus } from "@/lib/actions/pairing.actions";

import toast from "react-hot-toast";

export function PairingInterface() {
  const [searchQuery, setSearchQuery] = useState("");

  const { profile } = useFetchProfile();

  const [matchedPairings, setMatchedPairings] = useState<
    IncomingPairingMatch[]
  >([]);

  useEffect(() => {
    if (!profile) return;
    getIncomingPairingMatches(profile.id).then((result) => {
      if (result) setMatchedPairings(result);

    });
  }, [profile]);

  const visibleMatches = useMemo(() => {
    if (!profile) return [];
    const q = searchQuery.trim().toLowerCase();
    return matchedPairings.filter((match) => {
      const roleFilter = profile.role === "Student" ? "tutor" : "student";
      const matchedProfile = match[roleFilter];
      const haystack =
        `${matchedProfile.first_name} ${matchedProfile.last_name} ${(matchedProfile.subjectsOfInterest ?? []).join(" ")}`.toLowerCase();
      return !q || haystack.includes(q);
    });
  }, [matchedPairings, profile, searchQuery]);

  //handle mutating match state
  const handleAcceptPairingMatch = (
    matchId: string,
    status: "accepted" | "rejected"
  ) => {
    if (!profile) return;

    const promise = updatePairingMatchStatus(profile.id, matchId, status);

    toast.promise(promise, {
      loading: `${status === "accepted" ? "Accepting" : "Rejecting"} pairing...`,
      success: `Successfully ${status} pairing`,
      error: (err) =>
        `Failed to ${status.slice(0, -2)} pairing: ${err.message}`,
    });

    promise.then(() => {setMatchedPairings((prev) => prev.filter((prev) => prev.pairing_match_id !== matchId))})
  };

  return (
    <div className="space-y-8">
      {profile && (
        <PairingRequestCard
          userId={profile.userId}
          profileId={profile.id}
          role={profile.role ?? ""}
        />
      )}

      {profile && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Incoming pairings</h3>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or subject..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {visibleMatches.length > 0 ? (
              visibleMatches.map((match) => {
                const roleFilter =
                  profile.role === "Student" ? "tutor" : "student";
                const matchedProfile = match[roleFilter];
                return (
                  <Card key={match.pairing_match_id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{`${matchedProfile.first_name} ${matchedProfile.last_name}`}</CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <UserRound className="h-3 w-3" />
                            {matchedProfile.role}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Subjects
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {matchedProfile.subjectsOfInterest?.map(
                              (subject, i) => (
                                <Badge key={i} variant="secondary">
                                  {subject}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Languages
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {matchedProfile.languagesSpoken?.map(
                              (language, i) => (
                                <Badge key={i} variant="outline">
                                  {language}
                                </Badge>
                              ),
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Student Availabilites
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <UserAvailabilityList
                              profile={matchedProfile}
                              isBadge={true}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      {profile.role === "Tutor" && (
                        <div className="space-x-4 flex">
                          <Button
                            className="w-full bg-green-500"
                            onClick={() =>
                              handleAcceptPairingMatch(
                                match.pairing_match_id,
                                "accepted",
                              )
                            }
                          >
                            Accept
                          </Button>
                          <Button
                            className="w-full bg-red-500"
                            onClick={() =>
                              handleAcceptPairingMatch(
                                match.pairing_match_id,
                                "rejected",
                              )
                            }
                          >
                            Decline
                          </Button>
                        </div>
                      )}
                      {profile.role === "Student" && (
                        <Button className="w-full gap-2 p-4">
                          <Clock />
                          Waiting
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-2 text-center py-8">
                <p className="text-muted-foreground">
                  {matchedPairings.length > 0
                    ? "No results for your search"
                    : "No matching profiles found"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
