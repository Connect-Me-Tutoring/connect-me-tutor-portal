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
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvailabilities } from "@/components/ui/UserAvailabilities";
import TimeZoneSelector from "./TimezoneSelector";

interface EditTutorFormProps {
  isReactivateModalOpen: boolean;
  setIsReactivateModalOpen: (value: boolean) => void;
  isEditModalOpen: boolean;
  setIsEditModalOpen: (value: boolean) => void;
  tutors: Profile[];
  selectedTutor: Profile | null;
  selectedTutorId: string | null;
  setSelectedTutor: (value: Profile | null) => void;
  setSelectedTutorId: (value: string) => void;
  handleEditTutor: () => void;
  handleGetSelectedTutor: (value: string | null) => void;
  handleInputChangeForEdit: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  handleComplexFieldsForEdit: (name: string, value: any) => void;
  handleTimeZoneForEdit: (value: string) => void;
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

const EditTutorForm = ({
  isReactivateModalOpen,
  setIsReactivateModalOpen,
  isEditModalOpen,
  setIsEditModalOpen,
  tutors,
  selectedTutor,
  selectedTutorId,
  setSelectedTutor,
  setSelectedTutorId,
  handleEditTutor,
  handleGetSelectedTutor,
  handleInputChangeForEdit,
  handleComplexFieldsForEdit,
  handleTimeZoneForEdit,
}: EditTutorFormProps) => {
  const [activeTab, setActiveTab] = useState("basic");
  const [newSubject, setNewSubject] = useState<string[]>([]);
  const [newLanguage, setNewLanguage] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState("");
  const [languageInput, setLanguageInput] = useState("");

  const addAvailabilitySlot = () => {
    if (!selectedTutor) return;

    const newAvailability = [
      ...(selectedTutor.availability ?? []),
      { day: "Monday", startTime: "09:00", endTime: "17:00" },
    ];

    handleComplexFieldsForEdit("availability", newAvailability);
  };

  const updateAvailabilitySlot = (
    index: number,
    field: "day" | "startTime" | "endTime",
    value: string
  ) => {
    if (!selectedTutor) return;

    const updated = [...(selectedTutor.availability ?? [])];
    updated[index] = { ...updated[index], [field]: value };

    handleComplexFieldsForEdit("availability", updated);
  };

  const removeAvailabilitySlot = (index: number) => {
    if (!selectedTutor || !selectedTutor.availability) return;

    const updated = selectedTutor.availability.filter((_, i) => i !== index);

    handleComplexFieldsForEdit("availability", updated);
  };

  const addSubject = () => {
    if (!selectedTutor || !subjectInput.trim()) return;

    const updated = [
      ...(selectedTutor.subjects_of_interest ?? []),
      subjectInput.trim(),
    ];

    handleComplexFieldsForEdit("subjects_of_interest", updated);

    setSubjectInput("");
  };

  const removeSubject = (subject: string) => {
    if (!selectedTutor || !selectedTutor.subjects_of_interest) return;

    const updated = selectedTutor.subjects_of_interest.filter(
      (s) => s !== subject
    );

    handleComplexFieldsForEdit("subjects_of_interest", updated);
  };

  const addLanguage = () => {
    if (!selectedTutor || !languageInput.trim()) return;

    const updated = [
      ...(selectedTutor.languages_spoken ?? []),
      languageInput.trim(),
    ];

    handleComplexFieldsForEdit("languages_spoken", updated);

    setLanguageInput("");
  };

  const removeLanguage = (language: string) => {
    if (!selectedTutor || !selectedTutor.languages_spoken) return;

    const updated = selectedTutor.languages_spoken.filter(
      (l) => l !== language
    );

    handleComplexFieldsForEdit("languages_spoken", updated);
  };

  return (
    <Dialog
      open={isReactivateModalOpen}
      onOpenChange={setIsReactivateModalOpen}
    >
      <DialogTrigger asChild>
        <Button className = "bg-connect-me-blue-4">Edit Tutor</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select a Tutor to Edit</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="tutorSelect" className="text-right">
            Tutor
          </Label>
          <div className="relative">
            <Combobox
              list={tutors.map((tutor) => ({
                value: tutor.id,
                label: `${tutor.firstName} ${tutor.lastName} - ${tutor.email}`,
              }))}
              category="tutor"
              onValueChange={setSelectedTutorId}
            />
          </div>
        </div>
        {/*Edit Page*/}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={!selectedTutorId}
              onClick={() => handleGetSelectedTutor(selectedTutorId)}
            >
              Select Tutor to edit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Tutor</DialogTitle>
            </DialogHeader>

            {/* Tab Navigation */}
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
                <div className="space-y-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="firstName" className="text-right">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={selectedTutor?.firstName || ""}
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
                      value={selectedTutor?.lastName || ""}
                      onChange={handleInputChangeForEdit}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      Email
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={selectedTutor?.email || ""}
                      onChange={handleInputChangeForEdit}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="phoneNumber" className="text-right">
                      Phone Number
                    </Label>
                    <Input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="phonenumber"
                      value={selectedTutor?.phoneNumber || ""}
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
                      value={selectedTutor?.startDate || ""}
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
                        profile={selectedTutor}
                        handleTimeZone={handleTimeZoneForEdit}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Extended Profile Tab */}
              {activeTab === "extended" && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Status</h3>
                    <Select
                      value={selectedTutor?.status ?? "Active"}
                      onValueChange={(value) =>
                        handleComplexFieldsForEdit(
                          "status",
                          value as Profile["status"]
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Availability Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Availability</h3>
                    {selectedTutor &&
                      selectedTutor.availability &&
                      selectedTutor.availability.map((slot, index) => (
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
                                  e.target.value
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
                                  e.target.value
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
                    {selectedTutor &&
                      selectedTutor.subjects_of_interest &&
                      selectedTutor.subjects_of_interest.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedTutor.subjects_of_interest.map((subject) => (
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
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Languages Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Languages Spoken</h3>
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
                    {selectedTutor &&
                      selectedTutor.languages_spoken &&
                      selectedTutor.languages_spoken.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedTutor.languages_spoken.map((language) => (
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
                          ))}
                        </div>
                      )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Gender</h3>
                    <div className="flex gap-2">
                      <Select
                        name="timeZone"
                        value={selectedTutor?.gender}
                        onValueChange={(value) => {
                          if (selectedTutor) {
                            setSelectedTutor({
                              ...selectedTutor,
                              gender: value,
                            });
                          }
                        }}
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
                </div>
                // </div>
              )}
            </div>

            <Button onClick={handleEditTutor}>Finish editing tutor</Button>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export default EditTutorForm;
