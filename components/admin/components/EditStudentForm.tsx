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
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import TimeZoneSelector from "./TimezoneSelector";

interface EditStudentFormProps {
  students: Profile[];
  selectedStudentId: string | null;
  setSelectedStudentId: (value: string) => void;
  handleGetSelectedStudent: (value: string | null) => void;
  selectedStudent: Profile | null;
  handleInputChangeForEdit: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  handleGradeChangeForEdit: (value: string) => void;
  handleGenderForEdit: (value: string) => void;
  handleTimeZoneForEdit: (value: string) => void;
  handleSubjectsChangeForEdit: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleEditProfile: (name: string, value: any) => void;
  getOrdinalSuffix: (value: number) => void;
  handleEditStudent: () => void;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const EditStudentForm = ({
  students,
  selectedStudentId,
  setSelectedStudentId,
  handleGetSelectedStudent,
  selectedStudent,
  handleInputChangeForEdit,
  handleGradeChangeForEdit,
  handleGenderForEdit,
  handleTimeZoneForEdit,
  handleSubjectsChangeForEdit,
  handleEditProfile,
  getOrdinalSuffix,
  handleEditStudent,
}: EditStudentFormProps) => {
  const [isReactivateModalOpen, setIsReactivateModalOpen] =
    useState<boolean>(false);

  const [activeTab, setActiveTab] = useState("basic");
  const [subjectInput, setSubjectInput] = useState("");
  const [languageInput, setLanguageInput] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const addAvailabilitySlot = () => {
    if (!selectedStudent) return;

    const newAvailability = [
      ...(selectedStudent.availability ?? []),
      { day: "Monday", startTime: "09:00", endTime: "17:00" },
    ];

    handleEditProfile("availability", newAvailability);
  };

  const updateAvailabilitySlot = (
    index: number,
    field: "day" | "startTime" | "endTime",
    value: string,
  ) => {
    if (!selectedStudent) return;

    const updated = [...(selectedStudent.availability ?? [])];
    updated[index] = { ...updated[index], [field]: value };

    handleEditProfile("availability", updated);
  };

  const removeAvailabilitySlot = (index: number) => {
    if (!selectedStudent || !selectedStudent.availability) return;

    const updated = selectedStudent.availability.filter((_, i) => i !== index);

    handleEditProfile("availability", updated);
  };

  const addSubject = () => {
    if (!selectedStudent || !subjectInput.trim()) return;

    const updated = [
      ...(selectedStudent.subjects_of_interest ?? []),
      subjectInput.trim(),
    ];

    handleEditProfile("subjects_of_interest", updated);

    setSubjectInput("");
  };

  const removeSubject = (subject: string) => {
    if (!selectedStudent || !selectedStudent.subjects_of_interest) return;

    const updated = selectedStudent.subjects_of_interest.filter(
      (s) => s !== subject,
    );

    handleEditProfile("subjects_of_interest", updated);
  };

  const addLanguage = () => {
    if (!selectedStudent || !languageInput.trim()) return;

    const updated = [
      ...(selectedStudent.languages_spoken ?? []),
      languageInput.trim(),
    ];

    handleEditProfile("languages_spoken", updated);

    setLanguageInput("");
  };

  const removeLanguage = (language: string) => {
    if (!selectedStudent || !selectedStudent.languages_spoken) return;

    const updated = selectedStudent.languages_spoken.filter(
      (l) => l !== language,
    );

    handleEditProfile("languages_spoken", updated);
  };

  return (
    <Dialog
      open={isReactivateModalOpen}
      onOpenChange={setIsReactivateModalOpen}
    >
      <DialogTrigger asChild>
        <Button className="bg-connect-me-blue-4">Edit Student</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md overflow-auto">
        <DialogHeader>
          <DialogTitle>Select a Student to Edit</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Label htmlFor="studentSelect" className="text-right">
            Student
          </Label>
          <div className="relative">
            <Combobox
              list={students
                // .filter((student) => student.status === "Inactive")
                .map((student) => ({
                  value: student.id,
                  label: `${student.firstName} ${student.lastName} - ${student.email}`,
                }))}
              category="student"
              onValueChange={setSelectedStudentId}
            />
          </div>
        </div>
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={!selectedStudentId}
              onClick={() => handleGetSelectedStudent(selectedStudentId)}
            >
              Select Student to edit
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
            </DialogHeader>

            <div className="flex border-b mb-4">
              <button
                type="button"
                onClick={() => setActiveTab("basic")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeTab === "basic"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Basic Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("extended")}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeTab === "extended"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Extended Profile
              </button>
            </div>

            <div className="grid gap-4 py-4">
              {/* Basic Info Tab */}
              {activeTab === "basic" && (
                <ScrollArea className="max-h-[calc(80vh-120px)] pr-4">
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="studentNumber" className="text-right">
                        Student #
                      </Label>
                      <Input
                        id="studentNumber"
                        name="studentNumber"
                        value={selectedStudent?.studentNumber ?? ""}
                        onChange={handleInputChangeForEdit}
                        className="col-span-3"
                      ></Input>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="firstName" className="text-right">
                        First Name
                      </Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={selectedStudent?.firstName}
                        onChange={handleInputChangeForEdit}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="lastName" className="text-right">
                        Last Name
                      </Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={selectedStudent?.lastName}
                        onChange={handleInputChangeForEdit}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-8 items-center gap-4">
                      <Label htmlFor="age" className="text-right col-span-2">
                        Age
                      </Label>
                      <div className="col-span-2">
                        <Input
                          id="age"
                          name="age"
                          value={selectedStudent?.age}
                          onChange={handleInputChangeForEdit}
                          className="col-span-3"
                        ></Input>
                      </div>
                      <Label htmlFor="grade" className="text-right">
                        Grade
                      </Label>
                      <div className="col-span-3">
                        <Select
                          name="grade"
                          value={selectedStudent?.grade}
                          onValueChange={handleGradeChangeForEdit}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Kindergarten">
                              Kindergarten
                            </SelectItem>
                            {Array.from({ length: 12 }, (_, i) => (
                              <SelectItem
                                key={i}
                                value={`${i + 1}${getOrdinalSuffix(i + 1)}-grade`}
                              >
                                {`${i + 1}${getOrdinalSuffix(i + 1)}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="gender" className="text-right">
                        Gender
                      </Label>
                      <div className="col-span-3">
                        {" "}
                        <Select
                          name="gender"
                          value={selectedStudent?.gender}
                          onValueChange={handleGenderForEdit}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="email" className="text-right">
                        Email
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={selectedStudent?.email}
                        onChange={handleInputChangeForEdit}
                        className="col-span-3"
                      />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="startDate" className="text-right">
                        Start Date
                      </Label>
                      <Input
                        id="startDate"
                        name="startDate"
                        type="date"
                        value={selectedStudent?.startDate}
                        onChange={handleInputChangeForEdit}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="parentName" className="text-right">
                        Parent Name
                      </Label>
                      <Input
                        id="parentName"
                        name="parentName"
                        value={selectedStudent?.parentName}
                        onChange={handleInputChangeForEdit}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="parentPhone" className="text-right">
                        Parent Phone
                      </Label>
                      <Input
                        id="parentPhone"
                        name="parentPhone"
                        placeholder="(555) 124-4567"
                        value={selectedStudent?.parentPhone}
                        onChange={handleInputChangeForEdit}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="parentEmail" className="text-right">
                        Parent Email
                      </Label>
                      <Input
                        id="parentEmail"
                        name="parentEmail"
                        type="email"
                        value={selectedStudent?.parentEmail}
                        onChange={handleInputChangeForEdit}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="timeZone" className="text-right">
                        Time Zone
                      </Label>
                      <div className="col-span-3">
                        <TimeZoneSelector
                          profile={selectedStudent}
                          handleTimeZone={handleTimeZoneForEdit}
                        />
                      </div>
                    </div>
                    {/* <div className="grid grid-cols-4 items-center gap-4">
                      <Label
                        htmlFor="subjectsOfInterest"
                        className="text-right"
                      >
                        Subjects of Interest
                      </Label>
                      <Input
                        id="subjectsOfInterest"
                        name="subjectsOfInterest"
                        value={selectedStudent?.subjects_of_interest?.join(
                          ", "
                        )}
                        onChange={handleSubjectsChangeForEdit}
                        className="col-span-3"
                      />
                    </div> */}
                    {/* Add more fields for availability if needed */}
                  </div>
                </ScrollArea>
              )}
              {activeTab === "extended" && (
                <ScrollArea className="max-h-[calc(80vh-120px)]">
                  {" "}
                  <div className="space-y-6">
                    {/* Availability Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Availability</h3>
                      {selectedStudent &&
                        selectedStudent.availability &&
                        selectedStudent.availability.map((slot, index) => (
                          <div
                            key={index}
                            className="flex gap-2 p-3 border rounded-lg bg-gray-50"
                          >
                            <div className="flex-1">
                              <Select
                                value={slot.day}
                                onValueChange={(value) =>
                                  updateAvailabilitySlot(index, "day", value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DAYS_OF_WEEK.map((day) => (
                                    <SelectItem key={day} value={day}>
                                      {day}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex-1">
                              <Input
                                type="time"
                                value={slot.startTime}
                                onChange={(e) =>
                                  updateAvailabilitySlot(
                                    index,
                                    "startTime",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div className="flex-1">
                              <Input
                                type="time"
                                value={slot.endTime}
                                onChange={(e) =>
                                  updateAvailabilitySlot(
                                    index,
                                    "endTime",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeAvailabilitySlot(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addAvailabilitySlot}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Time Slot
                      </Button>
                    </div>

                    {/* Subjects Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">
                        Subjects of Interest
                      </h3>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="e.g., Mathematics, Physics"
                          value={subjectInput}
                          onChange={(e) => setSubjectInput(e.target.value)}
                          onKeyPress={(e) =>
                            e.key === "Enter" &&
                            (e.preventDefault(), addSubject())
                          }
                        />
                        <Button type="button" onClick={addSubject} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {selectedStudent &&
                        selectedStudent.subjects_of_interest &&
                        selectedStudent.subjects_of_interest.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedStudent.subjects_of_interest.map(
                              (subject) => (
                                <Badge
                                  key={subject}
                                  variant="secondary"
                                  className="flex items-center gap-1"
                                >
                                  {subject}
                                  <button
                                    type="button"
                                    onClick={() => removeSubject(subject)}
                                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ),
                            )}
                          </div>
                        )}
                    </div>

                    {/* Languages Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">
                        Languages Spoken
                      </h3>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="e.g., English, Spanish"
                          value={languageInput}
                          onChange={(e) => setLanguageInput(e.target.value)}
                          onKeyPress={(e) =>
                            e.key === "Enter" &&
                            (e.preventDefault(), addLanguage())
                          }
                        />
                        <Button type="button" onClick={addLanguage} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {selectedStudent &&
                        selectedStudent.languages_spoken &&
                        selectedStudent.languages_spoken.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {selectedStudent.languages_spoken.map(
                              (language) => (
                                <Badge
                                  key={language}
                                  variant="secondary"
                                  className="flex items-center gap-1"
                                >
                                  {language}
                                  <button
                                    type="button"
                                    onClick={() => removeLanguage(language)}
                                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ),
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </ScrollArea>
              )}

              <Button onClick={handleEditStudent}>
                Finish editing student
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export default EditStudentForm;
