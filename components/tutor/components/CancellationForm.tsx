import { useState } from "react";

import {
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Session } from "@/types";
import { Textarea } from "@/components/ui/textarea";
import { Radio } from "lucide-react";

interface CancellationFormProps {
  session: Session;
  handleStatusChange: (session: Session) => void;
  onClose: any;
  actor?: "tutor" | "student";
}

type cancellationReasonType =
  | "studentUnavailableWithPriorNotice"
  | "studentUnavailableWithoutPriorNotice"
  | "studentAbsent"
  | "tutorCancelledWithPriorNotice"
  | "emergency"
  | "other"
  | null;

const CancellationForm: React.FC<CancellationFormProps> = ({
  session,
  handleStatusChange,
  onClose,
  actor = "tutor",
}) => {
  const [otherReason, setOtherReason] = useState<string>("");
  const [cancellationReason, setCancellationReason] =
    useState<cancellationReasonType>(null);

  const isCancellationOther = cancellationReason === "other";
  const isCancellationEmergency = cancellationReason === "emergency";
  const isCancellationTutorCancelledWithpriorNotice =
    cancellationReason === "tutorCancelledWithPriorNotice";
  const isCancellationStudentAbsentWithoutPriorNotice =
    cancellationReason === "studentUnavailableWithoutPriorNotice";
  const isCancellationStudentAbsentWithPriorNotice =
    cancellationReason === "studentUnavailableWithPriorNotice";

  return (
    <AlertDialogContent>
      {actor === "student" ? (
        <>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Session</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a short reason for cancelling this session
            </AlertDialogDescription>
            <Textarea
              placeholder="Write your cancellation reason here..."
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                const updatedSession: Session = {
                  ...session,
                  status: "Cancelled" as
                    | "Active"
                    | "Complete"
                    | "Cancelled"
                    | "Rescheduled",
                  session_exit_form: otherReason,
                };
                handleStatusChange(updatedSession);
                onClose();
              }}
            >
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </>
      ) : (
        <>
          {" "}
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Session</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide an explanation for why this session is being cancelled
            </AlertDialogDescription>

            <RadioGroup
              value={cancellationReason || ""}
              onValueChange={(value: string | null) =>
                setCancellationReason(value as cancellationReasonType)
              }
            >
              <span className="space-x-2">
                <RadioGroupItem
                  value="studentUnavailableWithPriorNotice"
                  id="studentUnavailableWithPriorNotice"
                />
                <Label htmlFor="studentUnavailableWithPriorNotice">
                  Student cancelled with prior notice
                </Label>
              </span>
              <span className="space-x-2">
                <RadioGroupItem
                  value="studentUnavailableWithoutPriorNotice"
                  id="studentUnavailableWithoutPriorNotice"
                />
                <Label htmlFor="studentUnavailableWithoutPriorNotice">
                  Student did not attend without prior notice
                </Label>
              </span>
              <span className="space-x-2">
                <RadioGroupItem
                  value="tutorCancelledWithPriorNotice"
                  id="tutorCancelledWithPriorNotice"
                />
                <Label htmlFor="tutorCancelledWithPriorNotice">
                  I am cancelling with prior notice
                </Label>
              </span>
              <span className="space-x-2">
                <RadioGroupItem value="emergency" id="emergency" />
                <Label htmlFor="emergency">Last Minute Emergency</Label>
              </span>
              <span className="space-x-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other">Other</Label>
              </span>
            </RadioGroup>
            <Textarea
              placeholder="Write here..."
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              className={isCancellationOther ? "" : "hidden"}
            ></Textarea>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                const updatedSession: Session = {
                  ...session,
                  status: (isCancellationStudentAbsentWithoutPriorNotice
                    ? "Complete"
                    : "Cancelled") as
                    | "Active"
                    | "Complete"
                    | "Cancelled"
                    | "Rescheduled",
                  session_exit_form: isCancellationOther ? otherReason : "",
                };
                handleStatusChange(updatedSession);
                onClose();
              }}
            >
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </>
      )}
    </AlertDialogContent>
  );
};
export default CancellationForm;
