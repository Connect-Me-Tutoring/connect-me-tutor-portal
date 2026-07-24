import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Profile } from "@/types";
import { Combobox } from "@/components/ui/combobox";

interface DeleteTutorFormProps {
  tutors: Profile[];
  selectedTutorId: string | null;
  setSelectedTutorId: (value: string | null) => void;
  handleDeleteTutor: () => void;
}

const DeleteTutorForm = ({
  tutors,
  selectedTutorId,
  setSelectedTutorId,
  handleDeleteTutor,
}: DeleteTutorFormProps) => {
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);

  return (
    <Dialog open={isDeactivateModalOpen} onOpenChange={setIsDeactivateModalOpen}>
      <DialogTrigger asChild>
        <Button className="bg-connect-me-blue-3">Delete Tutor</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select a Tutor to Delete</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="tutorSelect" className="text-right">
            Tutor
          </Label>
          <div className="relative">
            <Combobox
              list={tutors
                .filter((tutor) => tutor.status === "Active")
                .map((tutor) => ({
                  value: tutor.id,
                  label: `${tutor.firstName} ${tutor.lastName} - ${tutor.email}`,
                }))}
              category="tutor"
              onValueChange={setSelectedTutorId}
            />
          </div>
        </div>
        <Button onClick={handleDeleteTutor} disabled={!selectedTutorId}>
          Confirm Deletion
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteTutorForm;
