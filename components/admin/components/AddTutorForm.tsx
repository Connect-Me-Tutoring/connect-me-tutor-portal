import { useState } from "react";
import toast from "react-hot-toast";

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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Profile } from "@/types";
import { Combobox } from "@/components/ui/combobox";
import { X, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scrollarea";
import { Switch } from "@/components/ui/switch";
import TimeZoneSelector from "./TimezoneSelector";

interface AddTutorFormProps {
  newTutor: Partial<Profile>;
  addingTutor: boolean;
  handleInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  handleAddTutor: (
    value: Partial<Profile>,
    addToPairingQueue?: boolean
  ) => void;
  handleTimeZone: (value: string) => void;
  setNewTutor: React.Dispatch<React.SetStateAction<Partial<Profile>>>; // 👈 add this
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

const AddTutorForm = ({
  newTutor,
  setNewTutor,
  addingTutor,
  handleInputChange,
  handleAddTutor,
  handleTimeZone,
}: AddTutorFormProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [addNewProfilesToQueue, setAddNewProfilesToQueue] =
    useState<boolean>(false);

  // Extended profile fields (moved from the original component state)
  const [subjectsOfInterest, setSubjectsOfInterest] = useState<string[]>([]);
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>([]);
  const [availability, setAvailability] = useState<
    { day: string; startTime: string; endTime: string }[]
  >([]);

  const [newSubject, setNewSubject] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [newGender, setNewGender] = useState("");

  const addAvailabilitySlot = () => {
    setAvailability([
      ...availability,
      { day: "Monday", startTime: "09:00", endTime: "17:00" },
    ]);
  };

  const updateAvailabilitySlot = (
    index: number,
    field: keyof (typeof availability)[0],
    value: string
  ) => {
    const updated = [...availability];
    updated[index] = { ...updated[index], [field]: value };
    setAvailability(updated);
  };

  const removeAvailabilitySlot = (index: number) => {
    setAvailability(availability.filter((_, i) => i !== index));
  };

  const addSubject = () => {
    if (newSubject.trim() && !subjectsOfInterest.includes(newSubject.trim())) {
      setSubjectsOfInterest([...subjectsOfInterest, newSubject.trim()]);
      setNewSubject("");
    }
  };

  const removeSubject = (subject: string) => {
    setSubjectsOfInterest(subjectsOfInterest.filter((s) => s !== subject));
  };

  const addLanguage = () => {
    if (newLanguage.trim() && !languagesSpoken.includes(newLanguage.trim())) {
      setLanguagesSpoken([...languagesSpoken, newLanguage.trim()]);
      setNewLanguage("");
    }
  };

  const removeLanguage = (language: string) => {
    setLanguagesSpoken(languagesSpoken.filter((l) => l !== language));
  };

  // check empty fields in basic form and return error message accordingly
  const validateBasicForm = (): string | null => {
    const missingFields: string[] = [];

    if (!newTutor.firstName || newTutor.firstName.trim() === "") {
      missingFields.push("First Name");
    }
    if (!newTutor.lastName || newTutor.lastName.trim() === "") {
      missingFields.push("Last Name");
    }
    if (!newTutor.email || newTutor.email.trim() === "") {
      missingFields.push("Email");
    }
    if (!newTutor.phoneNumber || newTutor.phoneNumber.trim() === "") {
      missingFields.push("Phone Number");
    }
    if (!newTutor.startDate || newTutor.startDate.trim() === "") {
      missingFields.push("Start Date");
    }
    if (!newTutor.timeZone || newTutor.timeZone.trim() === "") {
      missingFields.push("Time Zone");
    }

    if (missingFields.length > 0) {
      return `Cannot add tutor. All Basic Form fields are required. Missing fields: ${missingFields.join(", ")}`;
    }

    return null;
  };

  // Enhanced handleAddTutor to include extended fields
  const handleEnhancedAddTutor = (addToPairingQueue?: boolean) => {
    // validate basic forms 
    const validationError = validateBasicForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const tutorWithExtendedFields = {
      ...newTutor,
      availability,
      subjects_of_interest: subjectsOfInterest,
      languages_spoken: languagesSpoken,
    };

    // Call original handler - you may need to modify the parent component
    // to handle these additional fields
    handleAddTutor(tutorWithExtendedFields, addToPairingQueue);
  };

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <Button className = "bg-connect-me-blue-2">Add Tutor</Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Tutor</DialogTitle>
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
              <ScrollArea className="max-h-[calc(70vh-120px)] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="firstName" className="text-right">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={newTutor.firstName}
                      onChange={handleInputChange}
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
                      value={newTutor.lastName}
                      onChange={handleInputChange}
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
                      value={newTutor.email}
                      onChange={handleInputChange}
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
                      value={newTutor.phoneNumber}
                      onChange={handleInputChange}
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
                      value={newTutor.startDate}
                      onChange={handleInputChange}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="timeZone" className="text-right">
                      Time Zone
                    </Label>
                    <div className="col-span-3">
                        <TimeZoneSelector
                        profile={newTutor}
                        handleTimeZone={handleTimeZone}
                      />
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
            {/* Extended Profile Tab */}
            {activeTab === "extended" && (
              <ScrollArea className="max-h-[calc(70vh-120px)] pr-4">
                <div className="space-y-6">
                  {/* Availability Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Availability</h3>
                    {availability.map((slot, index) => (
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
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), addSubject())
                        }
                      />
                      <Button type="button" onClick={addSubject} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {subjectsOfInterest.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {subjectsOfInterest.map((subject) => (
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
                        value={newLanguage}
                        onChange={(e) => setNewLanguage(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), addLanguage())
                        }
                      />
                      <Button type="button" onClick={addLanguage} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {languagesSpoken.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {languagesSpoken.map((language) => (
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
                        value={newTutor.gender}
                        onValueChange={(value) =>
                          setNewTutor((prev) => ({ ...prev, gender: value }))
                        }
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
                    {languagesSpoken.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {languagesSpoken.map((language) => (
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
                </div>
              </ScrollArea>
            )}
          </div>

          <Button
            onClick={() => handleEnhancedAddTutor(true)}
            disabled={addingTutor}
          >
            {addingTutor ? "Adding Tutor..." : "Add Tutor"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddTutorForm;
