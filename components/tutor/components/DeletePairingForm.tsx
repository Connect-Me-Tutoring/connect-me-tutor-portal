import React from "react";
import { useState } from "react";
import {
  formatSessionDate,
  formatSessionDuration,
} from "@/lib/utils";
import { Session, Meeting, Profile } from "@/types";
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
import {
  Circle,
  CircleCheckBig,
  CircleX,
  Clock,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Trash,
  CalendarDays,
  UserRoundPlus,
  CircleCheck,
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import { AlertDialogTrigger } from "@radix-ui/react-alert-dialog";
import SessionExitForm from "./SessionExitForm";
import RescheduleForm from "./RescheduleDialog";
import CancellationForm from "./CancellationForm";
import toast from "react-hot-toast";
import { deletePairingServer } from "@/lib/actions/pairing.server.actions";

interface DeletePairingFormProps {
  student: Profile;
  tutor: Profile | null;
  onRemove?: (studentId: string) => void;
}

const DeletePairingForm = ({ tutor, student, onRemove }: DeletePairingFormProps) => {
  const handleDeletePairing = async (
    tutorId: string | null,
    studentId: string
  ) => {
    try {
      if (!tutor) throw new Error("No tutor found");

      if (tutor && tutorId) {
        await deletePairingServer(tutorId, studentId);
      }
    } catch (error) {
      throw error;
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger>
        <Button variant="ghost" size="icon" aria-label="Remove student pairing">
          <Trash className="h-4 w-4" color="#ef4444" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Student</AlertDialogTitle>
          <AlertDialogDescription>
            Removing this student will delete the pairing and automatically remove any related enrollments and future sessions. You do not need to delete the enrollments separately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (tutor)
                handleDeletePairing(tutor.id, student.id)
                  .then(() => {
                    toast.success("Successfully removed student and deleted related enrollments");
                    onRemove?.(student.id);
                  })
                  .catch(() => toast.error("Failed to remove student"));
            }}
          >
            Remove Student
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeletePairingForm;
