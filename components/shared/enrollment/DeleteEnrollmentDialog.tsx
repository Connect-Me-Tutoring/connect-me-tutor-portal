"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Enrollment } from "@/types";

interface DeleteEnrollmentDialogProps {
  enrollment: Enrollment | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const DeleteEnrollmentDialog: React.FC<DeleteEnrollmentDialogProps> = ({
  enrollment,
  onCancel,
  onConfirm,
}) => {
  const t = useTranslations("adminEnrollments.dialogs.delete");

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("description")}</DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <p>{t("confirmMessage")}</p>
      </div>
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={!enrollment}>
          {t("confirm")}
        </Button>
      </div>
    </DialogContent>
  );
};

export default DeleteEnrollmentDialog;
