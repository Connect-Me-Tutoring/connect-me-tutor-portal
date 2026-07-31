"use client";
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
  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Delete Enrollment</DialogTitle>
        <DialogDescription className="sr-only">confirm enrollment deletion</DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <p>Are you sure you want to delete this enrollment? This action cannot be undone.</p>
      </div>
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={!enrollment}>
          Delete
        </Button>
      </div>
    </DialogContent>
  );
};

export default DeleteEnrollmentDialog;
