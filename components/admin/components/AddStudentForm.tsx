"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
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
import { ScrollArea } from "@/components/ui/scrollarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { Profile } from "@/types";
import TimeZoneSelector from "./TimezoneSelector";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface AddStudentFormProps {
  newStudent: Partial<Profile>;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void;
  handleGradeChange: (value: string) => void;

  handleTimeZone: (value: string) => void;
  handleGender: (value: string) => void;
  handleAddStudent: (value: Partial<Profile>) => void;
  addingStudent: boolean;
}

const AddStudentForm = ({
  newStudent,
  handleInputChange,
  handleGradeChange,
  handleTimeZone,
  handleGender,
  handleAddStudent,
  addingStudent,
}: AddStudentFormProps) => {
  const t = useTranslations("adminPeople");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basic2");

  // Mock student state - replace with your actual state management

  const [subjectsOfInterest, setSubjectsOfInterest] = useState<string[]>([]);

  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>([]);

  const [availability, setAvailability] = useState<
    { day: string; startTime: string; endTime: string }[]
  >([]);
  const [newSubject, setNewSubject] = useState("");
  const [newLanguage, setNewLanguage] = useState("");

  // Mock handlers - replace with your actual handlers

  const addAvailabilitySlot = () => {
    setAvailability([...availability, { day: "Monday", startTime: "09:00", endTime: "17:00" }]);
  };

  const updateAvailabilitySlot = (
    index: number,
    field: keyof (typeof availability)[0],
    value: string,
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

  const getOrdinalSuffix = (num: number) => {
    if (num === 1) return "st";
    if (num === 2) return "nd";
    if (num === 3) return "rd";
    return "th";
  };

  // validate required basic form fields
  const validateBasicForm = (): string | null => {
    const missingFields: string[] = [];

    if (!newStudent.firstName || newStudent.firstName.trim() === "") {
      missingFields.push(t("forms.addStudent.validation.firstName"));
    }
    if (!newStudent.lastName || newStudent.lastName.trim() === "") {
      missingFields.push(t("forms.addStudent.validation.lastName"));
    }
    if (!newStudent.age || newStudent.age.toString().trim() === "") {
      missingFields.push(t("forms.addStudent.validation.age"));
    }
    if (!newStudent.grade || newStudent.grade.trim() === "") {
      missingFields.push(t("forms.addStudent.validation.grade"));
    }
    if (!newStudent.gender || newStudent.gender.trim() === "") {
      missingFields.push(t("forms.addStudent.validation.gender"));
    }
    if (!newStudent.email || newStudent.email.trim() === "") {
      missingFields.push(t("forms.addStudent.validation.studentEmail"));
    }
    if (!newStudent.startDate || newStudent.startDate.trim() === "") {
      missingFields.push(t("forms.addStudent.validation.startDate"));
    }
    if (!newStudent.parentName || newStudent.parentName.trim() === "") {
      missingFields.push(t("forms.addStudent.validation.parentName"));
    }
    if (!newStudent.parentPhone || newStudent.parentPhone.trim() === "") {
      missingFields.push(t("forms.addStudent.validation.parentPhone"));
    }
    if (!newStudent.parentEmail || newStudent.parentEmail.trim() === "") {
      missingFields.push(t("forms.addStudent.validation.parentEmail"));
    }
    if (!newStudent.timeZone || newStudent.timeZone.trim() === "") {
      missingFields.push(t("forms.addStudent.validation.timeZone"));
    }
    if (!newStudent.studentNumber || newStudent.studentNumber.trim() === "") {
      missingFields.push(t("forms.addStudent.validation.studentNumber"));
    }

    if (missingFields.length > 0) {
      return t("forms.addStudent.validation.prefix", { fields: missingFields.join(", ") });
    }

    return null;
  };

  const handleEnhancedAddStudent = () => {
    // validate basic form fields
    const validationError = validateBasicForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const studentWithExtendedFields = {
      ...newStudent,
      availability,
      subjects_of_interest: subjectsOfInterest,
      languages_spoken: languagesSpoken,
    };

    handleAddStudent(studentWithExtendedFields);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button className="bg-connect-me-blue-2">{t("forms.addStudent.trigger")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b bg-gray-50/50 shrink-0">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {t("forms.addStudent.dialogTitle")}
          </DialogTitle>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b bg-white px-6 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("basic")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "basic"
                ? "border-blue-500 text-blue-600 bg-blue-50/30"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            {t("forms.addStudent.tabs.basicVertical")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("basic2")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "basic2"
                ? "border-blue-500 text-blue-600 bg-blue-50/30"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            {t("forms.addStudent.tabs.basic")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("extended")}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "extended"
                ? "border-blue-500 text-blue-600 bg-blue-50/30"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
            }`}
          >
            {t("forms.addStudent.tabs.extended")}
          </button>
        </div>

        {/* Vertical Form */}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "basic" && (
            <ScrollArea className="h-[calc(90vh-200px)] px-6 py-10">
              <div className="space-y-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="studentNumber" className=" text-right">
                    {t("forms.addStudent.studentNumber.label")}
                  </Label>
                  <Input
                    id="studentNumber"
                    name="studentNumber"
                    value={newStudent.studentNumber || ""}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder={t("forms.addStudent.studentNumber.placeholder")}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="firstName" className="text-right">
                    {t("forms.common.firstName.label")}
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={newStudent.firstName}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder={t("forms.common.firstName.placeholder")}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="lastName" className="text-right">
                    {t("forms.common.lastName.label")}
                  </Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={newStudent.lastName}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder={t("forms.common.lastName.placeholder")}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="age" className="text-right">
                    {t("forms.common.age.label")}
                  </Label>
                  <Input
                    id="age"
                    name="age"
                    type="number"
                    value={newStudent.age}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder={t("forms.common.age.placeholder")}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="grade" className="text-right">
                    {t("forms.common.grade.label")}
                  </Label>
                  <Select name="grade" value={newStudent.grade} onValueChange={handleGradeChange}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder={t("forms.common.grade.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Kindergarten">
                        {t("forms.common.grades.kindergarten")}
                      </SelectItem>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i} value={`${i + 1}${getOrdinalSuffix(i + 1)}-grade`}>
                          {t(`forms.common.grades.grade${i + 1}` as any)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="gender" className="text-right">
                    {t("forms.common.gender.label")}
                  </Label>
                  <Select name="gender" value={newStudent.gender} onValueChange={handleGender}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder={t("forms.common.gender.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("forms.common.gender.male")}</SelectItem>
                      <SelectItem value="female">{t("forms.common.gender.female")}</SelectItem>
                      <SelectItem value="other">{t("forms.common.gender.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">
                    {t("forms.addStudent.studentEmail.label")}
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={newStudent.email}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder={t("forms.addStudent.studentEmail.placeholderVertical")}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="phoneNumber" className="text-right">
                    {t("forms.common.phoneNumber.label")}
                  </Label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    type="phonenumber"
                    value={newStudent.phoneNumber}
                    onChange={handleInputChange}
                    className="col-span-3"
                    placeholder={t("forms.common.phoneNumber.placeholder")}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="startDate" className="text-right">
                    {t("forms.common.startDate.label")}
                  </Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={newStudent.startDate}
                    onChange={handleInputChange}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="parentName" className="text-right">
                    {t("forms.addStudent.parentName.label")}
                  </Label>
                  <Input
                    id="parentName"
                    name="parentName"
                    value={newStudent.parentName}
                    onChange={handleInputChange}
                    placeholder={t("forms.addStudent.parentName.placeholder")}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="parentPhone" className="text-right">
                    {t("forms.addStudent.parentPhone.label")}
                  </Label>
                  <Input
                    id="parentPhone"
                    name="parentPhone"
                    type="tel"
                    value={newStudent.parentPhone}
                    onChange={handleInputChange}
                    placeholder={t("forms.addStudent.parentPhone.placeholder")}
                    className="col-span-3"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="parentEmail" className="text-right">
                    {t("forms.addStudent.parentEmail.label")}
                  </Label>
                  <Input
                    id="parentEmail"
                    name="parentEmail"
                    type="email"
                    value={newStudent.parentEmail}
                    onChange={handleInputChange}
                    placeholder={t("forms.addStudent.parentEmail.placeholder")}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="timeZone" className="text-right">
                    {t("forms.common.timeZone.label")}
                  </Label>
                  <div className="col-span-3">
                    <TimeZoneSelector profile={newStudent} handleTimeZone={handleTimeZone} />
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          {activeTab === "basic2" && (
            <ScrollArea className="h-[calc(90vh-200px)] px-6 py-10">
              <div className="space-y-6">
                {/* Student ID Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Label
                      htmlFor="studentNumber"
                      className="text-sm font-medium text-gray-700 w-28 text-right"
                    >
                      {t("forms.addStudent.studentNumber.label")}
                    </Label>
                    <Input
                      id="studentNumber"
                      name="studentNumber"
                      value={newStudent.studentNumber || ""}
                      onChange={handleInputChange}
                      className="flex-1"
                      placeholder={t("forms.addStudent.studentNumber.placeholder")}
                    />
                  </div>
                </div>

                {/* Personal Information Section */}
                <div className="space-y-4 pt-2 border-t">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    {t("forms.addStudent.personalInformation")}
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                        {t("forms.common.firstName.label")}
                      </Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        value={newStudent.firstName}
                        onChange={handleInputChange}
                        placeholder={t("forms.common.firstName.placeholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                        {t("forms.common.lastName.label")}
                      </Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        value={newStudent.lastName}
                        onChange={handleInputChange}
                        placeholder={t("forms.common.lastName.placeholder")}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="age" className="text-sm font-medium text-gray-700">
                        {t("forms.common.age.label")}
                      </Label>
                      <Input
                        id="age"
                        name="age"
                        type="number"
                        value={newStudent.age}
                        onChange={handleInputChange}
                        placeholder={t("forms.common.age.placeholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="grade" className="text-sm font-medium text-gray-700">
                        {t("forms.common.grade.label")}
                      </Label>
                      <Select
                        name="grade"
                        value={newStudent.grade}
                        onValueChange={handleGradeChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("forms.common.grade.placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Kindergarten">
                            {t("forms.common.grades.kindergarten")}
                          </SelectItem>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i} value={`${i + 1}${getOrdinalSuffix(i + 1)}-grade`}>
                              {t(`forms.common.grades.grade${i + 1}` as any)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gender" className="text-sm font-medium text-gray-700">
                        {t("forms.common.gender.label")}
                      </Label>
                      <Select name="gender" value={newStudent.gender} onValueChange={handleGender}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("forms.common.gender.placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">{t("forms.common.gender.male")}</SelectItem>
                          <SelectItem value="female">{t("forms.common.gender.female")}</SelectItem>
                          <SelectItem value="other">{t("forms.common.gender.other")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                        {t("forms.addStudent.studentEmail.label")}
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={newStudent.email}
                        onChange={handleInputChange}
                        placeholder={t("forms.addStudent.studentEmail.placeholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="startDate" className="text-sm font-medium text-gray-700">
                        {t("forms.common.startDate.label")}
                      </Label>
                      <Input
                        id="startDate"
                        name="startDate"
                        type="date"
                        value={newStudent.startDate}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Parent Information Section */}
                <div className="space-y-4 pt-2 border-t">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    {t("forms.addStudent.parentInformation")}
                  </h3>

                  <div className="space-y-2">
                    <Label htmlFor="parentName" className="text-sm font-medium text-gray-700">
                      {t("forms.addStudent.parentName.label")}
                    </Label>
                    <Input
                      id="parentName"
                      name="parentName"
                      value={newStudent.parentName}
                      onChange={handleInputChange}
                      placeholder={t("forms.addStudent.parentName.placeholder")}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="parentPhone" className="text-sm font-medium text-gray-700">
                        {t("forms.addStudent.parentPhone.label")}
                      </Label>
                      <Input
                        id="parentPhone"
                        name="parentPhone"
                        type="tel"
                        value={newStudent.parentPhone}
                        onChange={handleInputChange}
                        placeholder={t("forms.addStudent.parentPhone.placeholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="parentEmail" className="text-sm font-medium text-gray-700">
                        {t("forms.addStudent.parentEmail.label")}
                      </Label>
                      <Input
                        id="parentEmail"
                        name="parentEmail"
                        type="email"
                        value={newStudent.parentEmail}
                        onChange={handleInputChange}
                        placeholder={t("forms.addStudent.parentEmail.placeholder")}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeZone" className="text-sm font-medium text-gray-700">
                      {t("forms.common.timeZone.label")}
                    </Label>
                    <TimeZoneSelector profile={newStudent} handleTimeZone={handleTimeZone} />
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          {activeTab === "extended" && (
            <ScrollArea className="h-[calc(90vh-200px)] px-6 py-10">
              <div className="space-y-8">
                {/* Availability Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {t("forms.common.availabilitySchedule")}
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addAvailabilitySlot}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      {t("forms.common.addTimeSlot")}
                    </Button>
                  </div>

                  {availability.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
                      <p className="mb-2">{t("forms.common.noAvailabilitySlots")}</p>
                      <p className="text-sm">{`  ${t("forms.common.clickAddTimeSlot")}`}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {availability.map((slot, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex-1">
                            <Select
                              value={slot.day}
                              onValueChange={(value) => updateAvailabilitySlot(index, "day", value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DAYS_OF_WEEK.map((day) => (
                                  <SelectItem key={day} value={day}>
                                    {t(`forms.common.days.${day.toLowerCase()}` as any)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={slot.startTime}
                              onChange={(e) =>
                                updateAvailabilitySlot(index, "startTime", e.target.value)
                              }
                              className="w-32"
                            />
                            <span className="text-gray-500 text-sm">{t("forms.common.to")}</span>
                            <Input
                              type="time"
                              value={slot.endTime}
                              onChange={(e) =>
                                updateAvailabilitySlot(index, "endTime", e.target.value)
                              }
                              className="w-32"
                            />
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeAvailabilitySlot(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subjects Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {t("forms.common.subjectsOfInterest")}
                  </h3>

                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder={t("forms.common.subjectsPlaceholderLong")}
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addSubject())}
                      className="flex-1"
                    />
                    <Button type="button" onClick={addSubject} size="sm" className="px-4">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {subjectsOfInterest.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg min-h-[60px] border">
                      {subjectsOfInterest.map((subject) => (
                        <Badge
                          key={subject}
                          variant="secondary"
                          className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200"
                        >
                          {subject}
                          <button
                            type="button"
                            onClick={() => removeSubject(subject)}
                            className="hover:bg-blue-300 rounded-full p-0.5 transition-colors"
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
                  <h3 className="text-lg font-semibold text-gray-800">
                    {t("forms.common.languagesSpoken")}
                  </h3>

                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder={t("forms.common.languagesPlaceholderLong")}
                      value={newLanguage}
                      onChange={(e) => setNewLanguage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addLanguage())}
                      className="flex-1"
                    />
                    <Button type="button" onClick={addLanguage} size="sm" className="px-4">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {languagesSpoken.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg min-h-[60px] border">
                      {languagesSpoken.map((language) => (
                        <Badge
                          key={language}
                          variant="secondary"
                          className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 hover:bg-green-200"
                        >
                          {language}
                          <button
                            type="button"
                            onClick={() => removeLanguage(language)}
                            className="hover:bg-green-300 rounded-full p-0.5 transition-colors"
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

        {/* Footer with Action Button */}
        <div className="px-6 py-4 border-t bg-gray-50/50 flex justify-end gap-3 shrink-0">
          <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={addingStudent}>
            {t("forms.addStudent.cancel")}
          </Button>
          <Button onClick={handleEnhancedAddStudent} disabled={addingStudent}>
            {addingStudent ? t("forms.addStudent.submitting") : t("forms.addStudent.submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddStudentForm;
