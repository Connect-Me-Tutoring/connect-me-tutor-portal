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
import { ScrollArea } from "@/components/ui/scrollarea";

interface DeleteStudentFormProps {
  students: Profile[];
  selectedStudentId: string | null;
  setSelectedStudentId: (value: string) => void;
  handleDeleteStudent: () => void;
}

const DeleteStudentForm = ({
  students,
  selectedStudentId,
  setSelectedStudentId,
  handleDeleteStudent,
}: DeleteStudentFormProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-connect-me-blue-3">Delete Student</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select a Student to Delete</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="studentSelect" className="text-right">
            Student
          </Label>
          <div className="relative">
            <Combobox
              list={students
                // .filter((student) => student.status === "Active")
                .map((student) => ({
                  value: student.id,
                  label: `${student.firstName} ${student.lastName} - ${student.email}`,
                }))}
              category="student"
              onValueChange={setSelectedStudentId}
            />
          </div>
        </div>
        <Button onClick={handleDeleteStudent} disabled={!selectedStudentId} className="w-full">
          Confirm Deletion
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteStudentForm;
