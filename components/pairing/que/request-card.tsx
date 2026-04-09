"use client";

import type React from "react";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { createPairingRequest } from "@/lib/actions/pairing.actions";
import toast from "react-hot-toast";

export type PairingRequest = {
  id: string; //uuid
  to: string; //uuid
  type: "student" | "tutor";
  userId: string; //uuid
  profile: any; // Profile type not defined
  status: "pending" | "accepted" | "rejected";
  priority: number;
  createdAt: Date;
};

interface PairingRequestCardProps {
  userId: string;
}
export function PairingRequestCard({ userId }: PairingRequestCardProps) {
  const [notes, setNotes] = useState("");
  const [requestType, setRequestType] = useState<"student" | "tutor">(
    "student",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const promise = createPairingRequest(userId, notes);

    toast.promise(promise, {
      success: "Successfully Added to Pairing Que",
      loading: "Creating Pairing Request",
      error: `Failed to Add To Pairing Que `,
    });

    promise.then(() => setNotes(""));
    promise.finally(() => {
      setIsSubmitting(false);
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "accepted":
        return <CheckCircle className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "accepted":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <Card className="w-full  mx-auto">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl">Submit Pairing Request</CardTitle>
          <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full border border-yellow-200">
            In Development
          </span>
        </div>

        <CardDescription className="text-base leading-relaxed">
          Submit a request to be paired with a tutor or student. Your request
          will be reviewed and matched based on availability, subject expertise,
          and compatibility. The matching process typically takes 24-48 hours.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Process Description */}
        <div className="bg-muted/50 p-4 rounded-lg space-y-3">
          <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            How It Works
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-xs">
                1
              </Badge>
              <span>
                Submit your pairing request with your preferences and notes
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-xs">
                2
              </Badge>
              <span>
                Our system matches you based on availability and compatibility
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-xs">
                3
              </Badge>
              <span>
                {"You'll receive a notification when a match is found"}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 text-xs">
                4
              </Badge>
              <span>
                Connect with your paired partner to begin your learning journey
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Notes Field */}
          <div className="space-y-3">
            <Label htmlFor="notes" className="text-base font-medium">
              Additional Notes
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (Optional)
              </span>
            </Label>
            <Textarea
              id="notes"
              placeholder="Tell us about your learning goals, preferred subjects, availability, or any specific requirements..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px] resize-none"
              maxLength={500}
            />
            <div className="text-xs text-muted-foreground text-right">
              {notes.length}/500 characters
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            // disabled={isSubmitting}
            // disabled={true}
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Submitting Request...
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Submit Pairing Request
              </>
            )}
          </Button>
        </form>

        {/* Status Examples */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-3 text-muted-foreground">
            Request Status Examples:
          </h4>
          <div className="flex flex-wrap gap-2">
            <Badge
              className={`${getStatusColor("pending")} flex items-center gap-1`}
            >
              {getStatusIcon("pending")}
              Pending Review
            </Badge>
            <Badge
              className={`${getStatusColor("accepted")} flex items-center gap-1`}
            >
              {getStatusIcon("accepted")}
              Match Found
            </Badge>
            <Badge
              className={`${getStatusColor("rejected")} flex items-center gap-1`}
            >
              {getStatusIcon("rejected")}
              No Match Available
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
