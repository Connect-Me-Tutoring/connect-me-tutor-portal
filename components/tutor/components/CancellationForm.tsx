import { useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("tutorSessions.forms.cancellation");
  const [otherReason, setOtherReason] = useState<string>("");
  const [cancellationReason, setCancellationReason] = useState<cancellationReasonType>(null);

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
            <AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("studentDescription")}</AlertDialogDescription>
            <Textarea
              placeholder={t("studentPlaceholder")}
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                const updatedSession: Session = {
                  ...session,
                  status: "Cancelled" as "Active" | "Complete" | "Cancelled" | "Rescheduled",
                  session_exit_form: otherReason,
                };
                handleStatusChange(updatedSession);
                onClose();
              }}
            >
              {t("submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </>
      ) : (
        <>
          {" "}
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("tutorDescription")}</AlertDialogDescription>

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
                  {t("reasons.studentWithPriorNotice")}
                </Label>
              </span>
              <span className="space-x-2">
                <RadioGroupItem
                  value="studentUnavailableWithoutPriorNotice"
                  id="studentUnavailableWithoutPriorNotice"
                />
                <Label htmlFor="studentUnavailableWithoutPriorNotice">
                  {t("reasons.studentWithoutPriorNotice")}
                </Label>
              </span>
              <span className="space-x-2">
                <RadioGroupItem
                  value="tutorCancelledWithPriorNotice"
                  id="tutorCancelledWithPriorNotice"
                />
                <Label htmlFor="tutorCancelledWithPriorNotice">
                  {t("reasons.tutorWithPriorNotice")}
                </Label>
              </span>
              <span className="space-x-2">
                <RadioGroupItem value="emergency" id="emergency" />
                <Label htmlFor="emergency">{t("reasons.emergency")}</Label>
              </span>
              <span className="space-x-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other">{t("reasons.other")}</Label>
              </span>
            </RadioGroup>
            <Textarea
              placeholder={t("otherPlaceholder")}
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              className={isCancellationOther ? "" : "hidden"}
            ></Textarea>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("back")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                const updatedSession: Session = {
                  ...session,
                  status: (isCancellationStudentAbsentWithoutPriorNotice
                    ? "Complete"
                    : "Cancelled") as "Active" | "Complete" | "Cancelled" | "Rescheduled",
                  session_exit_form: isCancellationOther ? otherReason : cancellationReason || "",
                };
                handleStatusChange(updatedSession);
                onClose();
              }}
            >
              {t("submit")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </>
      )}
    </AlertDialogContent>
  );
};
export default CancellationForm;
