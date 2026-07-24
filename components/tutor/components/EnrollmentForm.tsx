// import AvailabilityForm from "@/components/ui/availability-form";
// import { Button } from "@/components/ui/button";
// import {
//   Command,
//   CommandEmpty,
//   CommandGroup,
//   CommandInput,
//   CommandItem,
//   CommandList,
// } from "@/components/ui/command";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
//   DialogTrigger,
// } from "@/components/ui/dialog";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover";
// import { ScrollArea } from "@/components/ui/scrollarea";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { cn } from "@/lib/utils";
// import { Availability, Enrollment, Meeting, Profile } from "@/types";
// import { Check, ChevronDown, Circle, Loader2, Plus } from "lucide-react";
// import { useState } from "react";

// interface StudentProps {
//     openStudentOptions: boolean;
//     selectedStudentId: string;
//     studentsMap: Record<string, Profile>
//     studentsSearch: string;
//     students: Profile[]
//     setOpenStudentOptions: (value: boolean) => void;
//     setSelectedStudentId: (value: string) => string;
//     setStudentsSearch: (value: string) => void;
// }

// interface TutorProps {
//     openTutorOptions: boolean;
//     selectedTutorId: string;
//     tutors: Profile[];
//     tutorSearch: string;
//     setOpenTutorOptions: (value: boolean) => void;
//     setSelectedTutorId: (value: string) => void;
//     setTutorSearch: (value: string) => void;
// }

// interface AvailabilityProps {
//     availabilityList: Availability[];
//     isCheckingMeetingAvailability: boolean;
//     meetings: Meeting[];
//     meetingAvailablity: {
//         [key: string] :boolean;
//     }
//     setAvailabilityList: (value: Availability[]) => void;
//   setAvailableMeetingsForEnrollments: (value: Enrollment) => void;
// }

// interface EnrollmentProps {
//   newEnrollment: Omit<Enrollment, "id" | "createdAt">;
//   setNewEnrollment: (value: Enrollment) => void;
//   handleAddEnrollment: () => void;
// }

// interface EnrollmentFormProps {
//   StudentOptions: StudentProps;
//   TutorOptions: TutorProps;
//   AvailabilityOptions: AvailabilityProps;
//   EnrollmentOptions: EnrollmentProps;
//   handleInputSelectionChange: (value: string, type: string) => void;
//   handleInputChange: (e: { target: { name: string; value: string } }) => void;
// }

// const EnrollmentForm = ({
//   StudentOptions,
//   TutorOptions,
//   AvailabilityOptions,
//   EnrollmentOptions,
//   handleInputSelectionChange,
//   handleInputChange,
// }: EnrollmentFormProps) => {

//     const[isModalOpen, setIsModalOpen] = useState(false)

//     return (
//         <>

//       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
//                 <DialogTrigger asChild>
//                   <Button>
//                     <Plus className="mr-2 h-4 w-4" /> Edit Enrollment
//                   </Button>
//                 </DialogTrigger>
//                 <DialogContent className="sm:max-w-[425px]">
//                   <DialogHeader>
//                     <DialogTitle>Edit Enrollment</DialogTitle>
//                   </DialogHeader>
//                   <ScrollArea className="h-[calc(80vh-120px)] pr-4">
//                     {" "}
//                     <div className="grid gap-4 py-4">
//                       <ProfileSelector Options={StudentOptions}/>
//                       <div className="grid grid-cols-4 items-center gap-4">
//                         {" "}
//                         <Label htmlFor="tutor" className="text-right">
//                           Tutor
//                         </Label>
//                         <Popover
//                           open={openTutorOptions}
//                           onOpenChange={setOpenTutorOptions}
//                         >
//                           <PopoverTrigger asChild>
//                             <Button
//                               variant="outline"
//                               role="combobox"
//                               aria-expanded={openTutorOptions}
//                               className="col-span-3"
//                             >
//                               {selectedTutorId ? (
//                                 <>
//                                   {
//                                     tutors.find(
//                                       (tutor) => tutor.id === selectedTutorId
//                                     )?.firstName
//                                   }{" "}
//                                   {
//                                     tutors.find(
//                                       (tutor) => tutor.id === selectedTutorId
//                                     )?.lastName
//                                   }
//                                 </>
//                               ) : (
//                                 "Select a tutor"
//                               )}
//                               <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
//                             </Button>
//                           </PopoverTrigger>
//                           <PopoverContent className="">
//                             <Command>
//                               <CommandInput
//                                 placeholder="Search Tutor..."
//                                 value={tutorSearch}
//                                 onValueChange={setTutorSearch}
//                               />
//                               <CommandList>
//                                 <CommandEmpty>No Tutor found.</CommandEmpty>
//                                 <CommandGroup>
//                                   {tutors.map((tutor) => (
//                                     <CommandItem
//                                       key={tutor.id}
//                                       value={tutor.id}
//                                       keywords={[
//                                         tutor.firstName,
//                                         tutor.lastName,
//                                         tutor.email,
//                                       ]}
//                                       onSelect={() => {
//                                         setSelectedTutorId(tutor.id);
//                                         handleInputChange({
//                                           target: {
//                                             name: "tutor.id",
//                                             value: tutor.id,
//                                           },
//                                         });
//                                         setOpenTutorOptions(false);
//                                       }}
//                                     >
//                                       <Check
//                                         className={cn(
//                                           "mr-2 h-4 w-4",
//                                           selectedTutorId === tutor.id
//                                             ? "opacity-100"
//                                             : "opacity-0"
//                                         )}
//                                       />
//                                       {tutor.firstName} {tutor.lastName} -{" "}
//                                       {tutor.email}
//                                     </CommandItem>
//                                   ))}
//                                 </CommandGroup>
//                               </CommandList>
//                             </Command>
//                           </PopoverContent>
//                         </Popover>
//                       </div>
//                       {showOverlappingAvailabilites ? (
//                         <AvailabilityForm2
//                           availabilityList={availabilityList} // new enrollment by default will not have an availability
//                           setAvailabilityList={(availability) => {
//                             setAvailabilityList(availability);
//                             setNewEnrollment({
//                               ...newEnrollment,
//                               availability,
//                             });
//                           }}
//                           openAvailabilities={overlappingAvailabilties}
//                         />
//                       ) : (
//                         <AvailabilityForm
//                           // availabilityList={newEnrollment.availability}
//                           availabilityList={availabilityList} // new enrollment by default will not have an availability
//                           setAvailabilityList={(availability) => {
//                             setAvailabilityList(availability);
//                             setNewEnrollment({
//                               ...newEnrollment,
//                               availability,
//                             });
//                           }}
//                         />
//                       )}

//                       <div className="grid grid-cols-4 items-center gap-4">
//                         <Label htmlFor="summary" className="text-right">
//                           Summary
//                         </Label>
//                         <Input
//                           id="summary"
//                           name="summary"
//                           value={newEnrollment.summary}
//                           onChange={handleInputChange}
//                           className="col-span-3"
//                         />
//                       </div>
//                       <div className="grid grid-cols-4 items-center gap-4">
//                         <Label htmlFor="startDate" className="text-right">
//                           Start Date
//                         </Label>
//                         <Input
//                           id="startDate"
//                           name="startDate"
//                           type="date"
//                           value={newEnrollment.startDate}
//                           onChange={handleInputChange}
//                           className="col-span-3"
//                         />
//                       </div>

//                       <div>
//                         <Label>Meeting Link</Label>
//                         <Select
//                           name="meetingId"
//                           value={newEnrollment.meetingId}
//                           onOpenChange={(open) => {
//                             if (open && newEnrollment) {
//                               areMeetingsAvailable(newEnrollment);
//                             }
//                           }}
//                           onValueChange={(value) =>
//                             handleInputChange({
//                               target: { name: "meetingId", value },
//                             } as any)
//                           }
//                         >
//                           <SelectTrigger>
//                             <SelectValue placeholder="Select a meeting link">
//                               {isCheckingMeetingAvailability ? (
//                                 <>
//                                   Checking meeting availabilites
//                                   <Loader2 className="mx-2 h-4 w-4 animate-spin" />
//                                 </>
//                               ) : newEnrollment.meetingId ? (
//                                 meetings.find(
//                                   (meeting) =>
//                                     meeting.id === newEnrollment.meetingId
//                                 )?.name
//                               ) : (
//                                 "Select a meeting"
//                               )}
//                             </SelectValue>
//                           </SelectTrigger>
//                           <SelectContent>
//                             {meetings.map((meeting) => (
//                               <SelectItem
//                                 key={meeting.id}
//                                 value={meeting.id}
//                                 className="flex items-center justify-between"
//                               >
//                                 <span>
//                                   {meeting.name} - {meeting.id}
//                                 </span>
//                                 <Circle
//                                   className={`w-2 h-2 ml-2 ${
//                                     meetingAvailability[meeting.id]
//                                       ? "text-green-500"
//                                       : "text-red-500"
//                                   } fill-current`}
//                                 />
//                               </SelectItem>
//                             ))}
//                           </SelectContent>
//                         </Select>
//                       </div>
//                     </div>
//                   </ScrollArea>

//                   <Button onClick={handleAddEnrollment}>Add Enrollment</Button>
//                 </DialogContent>
//               </Dialog></>
//     )

// }

// export default EnrollmentForm
