import { useState, useEffect } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"; // Adjust import as necessary
import { Button } from "@/components/ui/button"; // Import Button and other UI elements
import { Label } from "@/components/ui/label";
import { Availability, Profile } from "@/types";
import { AnyAaaaRecord } from "node:dns";
import { Badge } from "@/components/ui/badge";

interface UserAvailabilityListProps {
  profile: any;
  isBadge: boolean;
}

export const UserAvailabilityList: React.FC<UserAvailabilityListProps> = ({
  profile,
  isBadge = true,
}) => {
  useEffect(() => {
    // console.log("Matched Profile", profile);
    // console.log("Availability", profile.availability);
  });

  return (
    <>
      {profile.availability && profile.availability.length > 0 ? (
        <div className="grid gap-1 mt-1">
          {profile.availability.map((slot: any, i: any) =>
            isBadge ? (
              <Badge key={i} variant="secondary">
                {slot.day}: {slot.startTime} - {slot.endTime} EST
              </Badge>
            ) : (
              <div key={i} className="text-sm text-muted-foreground">
                {slot.day}: {slot.startTime} - {slot.endTime} EST
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No availability set</p>
      )}
    </>
  );
};
