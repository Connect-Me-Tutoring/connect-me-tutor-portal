 import AvailabilityForm from "@/components/ui/availability-form";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scrollarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getEnrollmentScheduleFields } from "@/lib/enrollment-schedule";
import { Availability, Enrollment, Meeting, Profile } from "@/types";
import { Check, ChevronDown, Circle, Loader2, Plus } from "lucide-react";
import { useState } from "react";

interface EnrollmentFormProps {
  openStudentOptions: boolean;
  setOpenStudentOptions: (value: boolean) => void;
  selectedStudentId: string;
  setSelectedStudentId: (value: string) => void;
  studentsMap: Record<string, Profile>;
  studentSearch: string;
  setStudentSearch: (value: string) => void;
  students: Profile[];
  openTutorOptions: boolean;
  setOpenTutorOptions: (value: boolean) => void;
  selectedTutorId: string;
  setSelectedTutorId: (value: string) => void;
  tutors: Profile[];
  tutorSearch: string;
  setTutorSearch: (value: string) => void;
  availabilityList: Availability[];
  setAvailabilityList: (value: Availability[]) => void;
  newEnrollment: Enrollment;
  setNewEnrollment: (value: Enrollment) => void;
  handleInputSelectionChange: (value: string, type: string) => void;
  setAvailableMeetingsForEnrollments: (value: Enrollment) => void;
  isCheckingMeetingAvailability: boolean;
  meetings: Meeting[];
  meetingAvailability: {
    [key: string]: boolean;
  };
  handleInputChange: (e: { target: { name: string; value: string } }) => void;
  handleAddEnrollment: () => void;
}

const EnrollmentForm = ({
  openStudentOptions,
  setOpenStudentOptions,
  selectedStudentId,
  setSelectedStudentId,
  studentsMap,
  studentSearch,
  setStudentSearch,
  students,
  openTutorOptions,
  setOpenTutorOptions,
  selectedTutorId,
  setSelectedTutorId,
  tutors,
  tutorSearch,
  setTutorSearch,
  availabilityList,
  setAvailabilityList,
  newEnrollment,
  setNewEnrollment,
  handleInputSelectionChange,
  setAvailableMeetingsForEnrollments,
  isCheckingMeetingAvailability,
  meetings,
  meetingAvailability,
  handleInputChange,
  handleAddEnrollment,
}: EnrollmentFormProps) => {
  const [isModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsAddModalOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Enrollment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Enrollment</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(80vh-120px)] pr-4">
          {" "}
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              {" "}
              <Label htmlFor="tutor" className="text-right">
                Student
              </Label>
              <Popover
                open={openStudentOptions}
                onOpenChange={setOpenStudentOptions}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openStudentOptions}
                    className="col-span-3"
                  >
                    {selectedStudentId && studentsMap[selectedStudentId]
                      ? `${studentsMap[selectedStudentId].firstName} ${studentsMap[selectedStudentId].lastName}`
                      : "Select a student"}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="">
                  <Command>
                    <CommandInput
                      placeholder="Search student..."
                      value={studentSearch}
                      onValueChange={setStudentSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No student found.</CommandEmpty>
                      <CommandGroup>
                        {students.map((student) => (
                          <CommandItem
                            key={student.id}
                            value={student.id}
                            keywords={[
                              student.firstName,
                              student.lastName,
                              student.email,
                            ]}
                            onSelect={() => {
                              setSelectedStudentId(student.id);
                              handleInputChange({
                                target: {
                                  name: "student.id",
                                  value: student.id,
                                },
                              });
                              setOpenStudentOptions(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedStudentId === student.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            {student.firstName} {student.lastName} -{" "}
                            {student.email}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              {" "}
              <Label htmlFor="tutor" className="text-right">
                Tutor
              </Label>
              <Popover
                open={openTutorOptions}
                onOpenChange={setOpenTutorOptions}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openTutorOptions}
                    className="col-span-3"
                  >
                    {selectedTutorId ? (
                      <>
                        {
                          tutors.find((tutor) => tutor.id === selectedTutorId)
                            ?.firstName
                        }{" "}
                        {
                          tutors.find((tutor) => tutor.id === selectedTutorId)
                            ?.lastName
                        }
                      </>
                    ) : (
                      "Select a tutor"
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="">
                  <Command>
                    <CommandInput
                      placeholder="Search Tutor..."
                      value={tutorSearch}
                      onValueChange={setTutorSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No Tutor found.</CommandEmpty>
                      <CommandGroup>
                        {tutors.map((tutor) => (
                          <CommandItem
                            key={tutor.id}
                            value={tutor.id}
                            keywords={[
                              tutor.firstName,
                              tutor.lastName,
                              tutor.email,
                            ]}
                            onSelect={() => {
                              setSelectedTutorId(tutor.id);
                              handleInputChange({
                                target: {
                                  name: "tutor.id",
                                  value: tutor.id,
                                },
                              });
                              setOpenTutorOptions(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTutorId === tutor.id
                                  ? "opacity-100"
                                  : "opacity-0"
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
            </div>
            <AvailabilityForm
              availabilityList={availabilityList} // new enrollment by default will not have an availability
              setAvailabilityList={(availability) => {
                setAvailabilityList(availability);
                setNewEnrollment({
                  ...newEnrollment,
                  ...getEnrollmentScheduleFields(availability[0]),
                });
              }}
            />
            <div className="grid grid-cols-[80px_1fr] items-center gap-4">
              {/* <Label htmlFor="duration" className="text-right">
                          Duration
                        </Label> */}
              {/* <div className="flex items-center gap-2">
                          <Input
                            id="hours"
                            name="hours"
                            type="text"
                            inputMode="numeric"
                            value={hours.toString()}
                            onChange={handleInputChange}
                            placeholder="1"
                            className={`w-16 ${hoursError ? "border-red-500" : ""}`}
                          />
                          <span className="text-sm">hrs</span>
                          <Input
                            id="minutes"
                            name="minutes"
                            type="text"
                            inputMode="numeric"
                            value={minutes.toString()}
                            onChange={handleInputChange}
                            placeholder="0"
                            className={`w-16 ${minutesError ? "border-red-500" : ""}`}
                          />
                          <span className="text-sm">min</span>
                          {/* <Label>{newEnrollment.duration}</Label> */}
              {/* </div> */}

              <Label htmlFor="frequency" className="text-right">
                Frequency
              </Label>
              <div className="flex items-center gap-2">
                <Select
                  name="timeZone"
                  value={newEnrollment.frequency}
                  onValueChange={(value) =>
                    handleInputSelectionChange(value, "add")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="weekly" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Add time zone options here */}
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    {/* <SelectItem value="MT">Monthy</SelectItem> */}
                  </SelectContent>
                </Select>
              </div>

              <Label htmlFor="summary" className="text-right">
                Summary
              </Label>
              <Input
                id="summary"
                name="summary"
                value={newEnrollment.summary}
                onChange={handleInputChange}
              />
              <Label htmlFor="startDate" className="text-right">
                Start Date
              </Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={newEnrollment.startDate}
                onChange={handleInputChange}
                // className="col-span-3"
              />
              {/* <Label htmlFor="endDate" className="text-right">
                          End Date
                        </Label>
                        <Input
                          id="endDate"
                          name="endDate"
                          type="date"
                          value={newEnrollment.endDate}
                          onChange={handleInputChange}
                          // className="col-span-3"
                        /> */}
            </div>
            <div>
              <Label>Meeting Link</Label>
              <Select
                name="meetingId"
                value={newEnrollment.meetingId}
                onOpenChange={(open) => {
                  if (open && newEnrollment) {
                    setAvailableMeetingsForEnrollments(newEnrollment);
                  }
                }}
                onValueChange={(value) =>
                  handleInputChange({
                    target: { name: "meetingId", value },
                  } as any)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a meeting link">
                    {isCheckingMeetingAvailability ? (
                      <>
                        Checking meeting availabilites
                        <Loader2 className="mx-2 h-4 w-4 animate-spin" />
                      </>
                    ) : newEnrollment.meetingId ? (
                      meetings.find(
                        (meeting) => meeting.id === newEnrollment.meetingId
                      )?.name
                    ) : (
                      "Select a meeting"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {meetings.map((meeting) => (
                    <SelectItem
                      key={meeting.id}
                      value={meeting.id}
                      className="flex items-center justify-between"
                    >
                      <span>
                        {meeting.name} - {meeting.id}
                      </span>
                      <Circle
                        className={`w-2 h-2 ml-2 ${
                          meetingAvailability[meeting.id]
                            ? "text-green-500"
                            : "text-red-500"
                        } fill-current`}
                      />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </ScrollArea>

        <Button onClick={handleAddEnrollment}>Add Enrollment</Button>
      </DialogContent>
    </Dialog>
  );
};

export default EnrollmentForm;
