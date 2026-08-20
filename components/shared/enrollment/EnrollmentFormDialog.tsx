"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scrollarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AvailabilityForm from "@/components/ui/availability-form";
import type { Availability, Enrollment, Meeting, Profile } from "@/types";

export type EnrollmentDraft = Omit<Enrollment, "id" | "createdAt">;

interface EnrollmentFormDialogProps {
  mode: "add" | "edit";
  context: "admin" | "tutor";
  enrollment: EnrollmentDraft | Enrollment | null;
  onInputChange: (e: { target: { name: string; value: string } }) => void;
  onFrequencyChange: (value: string) => void;
  availabilityList: Availability[];
  onAvailabilityChange: (availability: Availability[]) => void;

  students: Profile[];
  selectedStudentId: string;
  onStudentSelect: (student: Profile) => void;

  // Tutor combobox is only rendered for context === "admin"; tutor context shows
  // a read-only label instead since a tutor's own `tutors` list is always just
  // themselves and could never functionally pick anyone else.
  tutors: Profile[];
  selectedTutorId: string;
  onTutorSelect: (tutor: Profile) => void;

  meetings: Meeting[];
  meetingAvailability: Record<string, boolean>;
  isCheckingMeetingAvailability: boolean;
  onMeetingDropdownOpen: () => void;

  onSubmit: () => void;
}

const EnrollmentFormDialog: React.FC<EnrollmentFormDialogProps> = ({
  mode,
  context,
  enrollment,
  onInputChange,
  onFrequencyChange,
  availabilityList,
  onAvailabilityChange,
  students,
  selectedStudentId,
  onStudentSelect,
  tutors,
  selectedTutorId,
  onTutorSelect,
  meetings,
  meetingAvailability,
  isCheckingMeetingAvailability,
  onMeetingDropdownOpen,
  onSubmit,
}) => {
  const [openStudentOptions, setOpenStudentOptions] = useState(false);
  const [openTutorOptions, setOpenTutorOptions] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [tutorSearch, setTutorSearch] = useState("");

  const t = useTranslations("adminEnrollments.dialogs");
  const tForm = useTranslations("adminEnrollments.dialogs.form");
  const tFrequency = useTranslations("adminEnrollments.frequency");

  const title = mode === "add" ? t("add.title") : t("edit.title");
  const submitLabel = mode === "add" ? t("add.submit") : t("edit.submit");
  const description = mode === "add" ? t("add.description") : t("edit.description");
  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const selectedTutor = tutors.find((tutor) => tutor.id === selectedTutorId);

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
      </DialogHeader>
      <ScrollArea className="max-h-[calc(80vh-120px)] pr-4">
        {enrollment && (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">{tForm("studentLabel")}</Label>
              <Popover open={openStudentOptions} onOpenChange={setOpenStudentOptions}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openStudentOptions}
                    className="col-span-3"
                  >
                    {selectedStudent
                      ? `${selectedStudent.firstName} ${selectedStudent.lastName}`
                      : tForm("selectStudentPlaceholder")}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <Command>
                    <CommandInput
                      placeholder={tForm("searchStudentPlaceholder")}
                      value={studentSearch}
                      onValueChange={setStudentSearch}
                    />
                    <CommandList>
                      <CommandEmpty>{tForm("noStudentFound")}</CommandEmpty>
                      <CommandGroup>
                        {students.map((student) => (
                          <CommandItem
                            key={student.id}
                            value={student.id}
                            keywords={[student.firstName, student.lastName, student.email].filter(
                              Boolean,
                            )}
                            onSelect={() => {
                              onStudentSelect(student);
                              setOpenStudentOptions(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedStudentId === student.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {student.firstName} {student.lastName} - {student.email}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              {context === "admin" ? (
                <>
                  {" "}
                  <Label className="text-right">{tForm("tutorLabel")}</Label>
                  <Popover open={openTutorOptions} onOpenChange={setOpenTutorOptions}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openTutorOptions}
                        className="col-span-3"
                      >
                        {selectedTutor
                          ? `${selectedTutor.firstName} ${selectedTutor.lastName}`
                          : tForm("selectTutorPlaceholder")}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <Command>
                        <CommandInput
                          placeholder={tForm("searchTutorPlaceholder")}
                          value={tutorSearch}
                          onValueChange={setTutorSearch}
                        />
                        <CommandList>
                          <CommandEmpty>{tForm("noTutorFound")}</CommandEmpty>
                          <CommandGroup>
                            {tutors.map((tutor) => (
                              <CommandItem
                                key={tutor.id}
                                value={tutor.id}
                                keywords={[tutor.firstName, tutor.lastName, tutor.email].filter(
                                  Boolean,
                                )}
                                onSelect={() => {
                                  onTutorSelect(tutor);
                                  setOpenTutorOptions(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedTutorId === tutor.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {tutor.firstName} {tutor.lastName} - {tutor.email}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </>
              ) : (
                ""
              )}
            </div>

            <AvailabilityForm
              availabilityList={availabilityList}
              setAvailabilityList={onAvailabilityChange}
            />

            <div className="grid grid-cols-[80px_1fr] items-center gap-4">
              <Label className="text-right">{tForm("frequencyLabel")}</Label>
              <div className="flex items-center gap-2">
                <Select value={enrollment.frequency} onValueChange={onFrequencyChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={tFrequency("weekly")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">{tFrequency("weekly")}</SelectItem>
                    <SelectItem value="biweekly" disabled={mode === "edit"}>
                      {tFrequency("biweekly")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Label className="text-right">{tForm("summaryLabel")}</Label>
              <Input name="summary" value={enrollment.summary} onChange={onInputChange} />

              <Label className="text-right">{tForm("startDateLabel")}</Label>
              <Input
                name="startDate"
                type="date"
                value={enrollment.startDate}
                onChange={onInputChange}
              />
            </div>

            <div>
              <Label>{tForm("meetingLinkLabel")}</Label>
              <Select
                value={enrollment.meetingId}
                disabled={isCheckingMeetingAvailability}
                onOpenChange={(open) => {
                  if (open) onMeetingDropdownOpen();
                }}
                onValueChange={(value) => onInputChange({ target: { name: "meetingId", value } })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tForm("selectMeetingLinkPlaceholder")}>
                    {isCheckingMeetingAvailability ? (
                      <>
                        {tForm("checkingAvailability")}
                        <Loader2 className="mx-2 h-4 w-4 animate-spin" />
                      </>
                    ) : enrollment.meetingId ? (
                      meetings.find((meeting) => meeting.id === enrollment.meetingId)?.name
                    ) : (
                      tForm("selectMeetingPlaceholder")
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {meetings.map((meeting) => (
                    <SelectItem
                      key={meeting.id}
                      value={meeting.id}
                      className="flex items-center justify-between"
                      disabled={
                        isCheckingMeetingAvailability ||
                        (!meetingAvailability[meeting.id] && meeting.name !== "Zoom Link HQ")
                      }
                    >
                      <span>
                        {meeting.name} - {meeting.id}
                      </span>
                      <Circle
                        className={`w-2 h-2 ml-2 ${
                          meetingAvailability[meeting.id] ? "text-green-500" : "text-red-500"
                        } fill-current`}
                      />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </ScrollArea>

      <Button onClick={onSubmit}>{submitLabel}</Button>
    </DialogContent>
  );
};

export default EnrollmentFormDialog;
