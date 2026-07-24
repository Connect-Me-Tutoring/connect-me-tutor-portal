import React from "react";
import { useState } from "react";
import { RefreshCw, ExternalLink, Calendar, BookOpen, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  AlertDialog,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Profile } from "@/types";
import AvailabiltyFormat from "@/components/student/AvailabilityFormat";

interface UserAvailabilitiesProps {
  user: Profile;
}

export const UserAvailabilities = ({ user }: UserAvailabilitiesProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Add your refresh logic here
    // await refreshStudentData(student.id);
    setRefreshing(false);
  };

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">View Availabilities</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Profile & Availability</DialogTitle>
          </DialogHeader>

          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">
                  {user.firstName + " " + user.lastName || "User Profile"}
                </h3>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Availability</p>
                    {user.availability && user.availability.length > 0 ? (
                      <div className="grid gap-1 mt-1">
                        {/* {user.availability.map((slot, i) => (
                          <p key={i} className="text-sm text-muted-foreground">
                            {slot.day}: {slot.startTime} - {slot.endTime}
                          </p>
                        ))} */}
                        <AvailabiltyFormat availability={user.availability} card />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No availability set</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <BookOpen className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Subjects</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.subjects_of_interest && user.subjects_of_interest.length > 0 ? (
                        user.subjects_of_interest.map((subject, i) => (
                          <Badge key={i} variant="secondary">
                            {subject}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No subjects added</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Languages className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Languages</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.languages_spoken && user.languages_spoken.length > 0 ? (
                        user.languages_spoken.map((language, i) => (
                          <Badge key={i} variant="outline">
                            {language}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No languages added</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />
            </div>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  );
};
