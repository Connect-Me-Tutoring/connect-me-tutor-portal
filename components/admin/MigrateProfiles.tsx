// ! DEPRECATED

// "use client";
// import AvaiabilityFormat from "@/components/student/AvailabilityFormat";
// import {
//   formatStandardToMilitaryTime,
//   addOneHourToMilitaryTime,
//   getToday,
//   addYearsToDate,
// } from "@/lib/utils";
// import React, { useState, useEffect } from "react";
// import toast, { Toaster } from "react-hot-toast";
// import { Button } from "@/components/ui/button";
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogHeader,
//   DialogTitle,
//   DialogFooter,
// } from "@/components/ui/dialog";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Switch } from "@/components/ui/switch";
// import { Label } from "@/components/ui/label";
// import { Input } from "@/components/ui/input";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import {
//   Pagination,
//   PaginationContent,
//   PaginationEllipsis,
//   PaginationItem,
//   PaginationLink,
//   PaginationNext,
//   PaginationPrevious,
// } from "@/components/ui/pagination";
// import { FileLoader } from "@/components/ui/fileloader";
// import {
//   getAllProfiles,
//   addTutor,
//   deactivateUser,
//   reactivateUser,
//   getEvents,
//   getEventsWithTutorMonth,
//   addStudent,
//   addEnrollment,
//   createEnrollment,
//   getAllEnrollments,
// } from "@/lib/actions/admin.actions";
// import { getProfileByEmail } from "@/lib/actions/user/actions";
// import {
//   MEETING_CONFIG,
//   getIdFromMeetingName,
//   type MeetingName,
// } from "@/lib/actions/meeting/client.actions";
// import { Loader2 } from "lucide-react";
// import { Alert, AlertDescription } from "@/components/ui/alert";
// import {
//   analyzeAndTransformStudents,
//   migrateSelectedStudents,
//   parseNames,
//   CSV_COLUMNS,
//   ErrorEntry,
//   ErrorEnrollment,
// } from "@/lib/actions/migrate.actions";
// import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
// import Papa from "papaparse";
// import { map, string } from "zod";
// import internal from "stream";
// import { checkIsOnDemandRevalidate } from "next/dist/server/api-utils";
// import { Enrollment, Profile } from "@/types";
// import { resourceLimits } from "worker_threads";
// import { previousDay } from "date-fns";

// export default function MigrateDataPage() {
//   const supabase = createClientComponentClient({
//     supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
//     supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
//   });
//   const [file, setFile] = useState<File | null>(null);
//   const [uploading, setUploading] = useState(false);
//   const [erroredTutorEntries, setErroredTutorEntries] = useState<ErrorEntry[]>(
//     []
//   );
//   const [erroredStudentEntries, setErroredStudentEntries] = useState<
//     ErrorEntry[]
//   >([]);
//   const [erroredPairingEntries, setErroredPairingEntries] = useState<
//     ErrorEnrollment[]
//   >([]);
//   const [isOpen, setIsOpen] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [students, setStudents] = useState<Profile[]>([]);
//   const [tutors, setTutors] = useState<Profile[]>([]);
//   const [pairings, setPairings] = useState<Enrollment[]>([]);

//   const [selectedStudents, setSelectedStudents] = useState<Set<number>>(
//     new Set()
//   );
//   const [selectedTutors, setSelectedTutors] = useState<Set<number>>(new Set());
//   const [selectedPairings, setSelectedPairings] = useState<Set<number>>(
//     new Set()
//   );

//   const [tutorEmails, setTutorEmails] = useState<Set<String>>(new Set());
//   const [studentEmails, setStudentEmails] = useState<Set<String>>(new Set());
//   const [uniqueEnrollments, setUniqueEnrollments] = useState<Set<String>>(
//     new Set()
//   );

//   const [currentPage, setCurrentPage] = useState(1);
//   const [migrationStatus, setMigrationStatus] = useState("");
//   const [userOption, setUserOption] = useState(false);
//   const [showTutors, setShowTutors] = useState(true);
//   const [showStudents, setShowStudents] = useState(false);
//   const [showPairings, setShowPairings] = useState(false);
//   const [showErrorEntries, setShowErrorEntries] = useState(false);

//   const ITEMS_PER_PAGE = 20;

//   const totalPages = Math.ceil(students?.length / ITEMS_PER_PAGE);
//   const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
//   const endIndex = startIndex + ITEMS_PER_PAGE;
//   const currentStudents = students?.slice(startIndex, endIndex);
//   const currentTutors = tutors?.slice(startIndex, endIndex);
//   const currentPairings = pairings?.slice(startIndex, endIndex);

//   useEffect(() => {
//     getTutorEmails();
//     getStudentEmails();
//     getUniqueEnrollments();
//   });

//   const getTutorEmails = async () => {
//     try {
//       const tutorData = await getAllProfiles("Tutor");
//       if (!tutorData || !Array.isArray(tutorData))
//         throw new Error("No tutors found");
//       setTutorEmails((prev) => {
//         return new Set([
//           ...Array.from(prev),
//           ...tutorData.map((tutor) =>
//             tutor.email ? tutor.email.toLowerCase() : ""
//           ),
//         ]);
//       });
//     } catch (error) {
//       console.error("Failed to load students");
//     }
//   };

//   const getStudentEmails = async () => {
//     try {
//       const studentData = await getAllProfiles("Student");
//       if (!studentData || !Array.isArray(studentData))
//         throw new Error("No students found");
//       setStudentEmails((prev) => {
//         return new Set([
//           ...Array.from(prev),
//           ...studentData.map((student) =>
//             student.email ? student.email.toLowerCase() : ""
//           ),
//         ]);
//       });
//     } catch (error) {
//       console.error("Failed to load students");
//     }
//   };

//   const getUniqueEnrollments = async () => {
//     try {
//       const data = await getAllEnrollments();
//       if (!data || !Array.isArray(data)) throw new Error("No pairings");
//       setUniqueEnrollments((prev) => {
//         return new Set([
//           ...Array.from(prev),
//           ...data
//             .map((pairing) =>
//               pairing.student &&
//               pairing.tutor &&
//               pairing.tutor.email &&
//               pairing.student.email
//                 ? `${pairing.tutor.email}-${pairing.student.email}`
//                 : ""
//             )
//             .filter((key) => key !== ""),
//         ]);
//       });
//     } catch (error) {
//       console.error("failed to fetch enrollments");
//     }
//   };

//   const formatAvailability = (
//     availability: Profile["availability"]
//   ): string => {
//     return availability
//       .map((slot) => `${slot.day} ${slot.startTime}-${slot.endTime}`)
//       .join(", ");
//   };

//   const myPagination = (
//     <Pagination>
//       <PaginationContent>
//         <PaginationItem>
//           <PaginationPrevious
//             onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
//             aria-disabled={currentPage === 1}
//           />
//         </PaginationItem>

//         {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
//           <PaginationItem key={page}>
//             <PaginationLink
//               onClick={() => setCurrentPage(page)}
//               isActive={currentPage === page}
//             >
//               {page}
//             </PaginationLink>
//           </PaginationItem>
//         ))}

//         <PaginationItem>
//           <PaginationNext
//             onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
//             aria-disabled={currentPage === totalPages}
//           />
//         </PaginationItem>
//       </PaginationContent>
//     </Pagination>
//   );

//   const toggleSelectStudent = (index: number) => {
//     const newSelected = new Set(selectedStudents);
//     if (newSelected.has(index)) {
//       newSelected.delete(index);
//     } else {
//       newSelected.add(index);
//     }
//     setSelectedStudents(newSelected);
//   };

//   const toggleSelectTutor = (index: number) => {
//     const newSelected = new Set(selectedTutors);
//     if (newSelected.has(index)) {
//       newSelected.delete(index);
//     } else {
//       newSelected.add(index);
//     }
//     setSelectedTutors(newSelected);
//   };

//   const toggleSelectPairing = (index: number) => {
//     const newSelected = new Set(selectedPairings);
//     if (newSelected.has(index)) {
//       newSelected.delete(index);
//     } else {
//       newSelected.add(index);
//     }
//     setSelectedPairings(newSelected);
//   };

//   const toggleSelectAllStudents = () => {
//     if (selectedStudents.size === students.length) {
//       setSelectedStudents(new Set());
//     } else {
//       setSelectedStudents(
//         new Set(students.map((_, index) => startIndex + index))
//       );
//     }
//   };

//   const toggleSelectAllTutors = () => {
//     if (selectedTutors.size === tutors.length) {
//       setSelectedTutors(new Set());
//     } else {
//       setSelectedTutors(new Set(tutors.map((_, index) => startIndex + index)));
//     }
//   };

//   const toggleSelectAllPairings = () => {
//     if (selectedPairings.size === pairings.length) {
//       setSelectedPairings(new Set());
//     } else {
//       setSelectedPairings(
//         new Set(pairings.map((_, index) => startIndex + index))
//       );
//     }
//   };

//   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
//     if (event.target.files && event.target.files.length > 0) {
//       setFile(event.target.files[0]);
//     }
//     setErroredStudentEntries([]);
//     setErroredTutorEntries([]);
//   };

//   const handleShowTutors = async () => {
//     setShowStudents(false);
//     setShowPairings(false);
//     setShowTutors(true);
//   };

//   const handleShowStudents = async () => {
//     setShowTutors(false);
//     setShowPairings(false);
//     setShowStudents(true);
//   };

//   const handleShowPairings = async () => {
//     setShowTutors(false);
//     setShowStudents(false);
//     setShowPairings(true);
//   };

//   const handleMigrateUsers = async (len: number, data: any) => {
//     //-----Sets Intended to remove duplciates based on emails-----

//     const tutors: Profile[] = [];
//     const students: Profile[] = [];
//     const pairings: Enrollment[] = [];
//     for (let i = 0; i < len - 1; ++i) {
//       const entry = data.at(i) as string[];

//       const migratedTutor: Profile = {
//         role: "Tutor",
//         studentNumber: null,
//         firstName: parseNames(entry[CSV_COLUMNS["Tutor Name"]])[0],
//         lastName: parseNames(entry[CSV_COLUMNS["Tutor Name"]])[1],
//         gender: "",
//         // dateOfBirth: getToday(),
//         startDate: getToday(),
//         availability: [],
//         email: entry[CSV_COLUMNS["Tutor Email"]].toLowerCase(),
//         parentName: "",
//         parentPhone: "",
//         parentEmail: "",
//         timeZone: "",
//         subjectsOfInterest: [],
//         status: "Active",
//         tutorIds: [],
//         id: "",
//         createdAt: "",
//         userId: "",
//         settingsId: "",
//       };

//       const migratedStudent: Profile = {
//         role: "Student",
//         studentNumber: null,
//         firstName: parseNames(entry[CSV_COLUMNS["Student Name"]])[0],
//         lastName: parseNames(entry[CSV_COLUMNS["Student Name"]])[1],
//         age: "",
//         grade: "",
//         gender: "",
//         // dateOfBirth: getToday(),
//         startDate: getToday(),
//         availability: [],
//         email: entry[CSV_COLUMNS["Student Email"]].toLowerCase(),
//         parentName: "",
//         parentPhone: "",
//         parentEmail: "",
//         timeZone: "",
//         subjectsOfInterest: [],
//         status: "Active",
//         tutorIds: [],
//         id: "",
//         createdAt: "",
//         userId: "",
//         settingsId: "",
//       };

//       const migratedPairing: Enrollment = {
//         student: migratedStudent, // Initialize as an empty Profile
//         tutor: migratedTutor, // Initialize as an empty Profile
//         summary: `${migratedTutor.firstName} - ${migratedStudent.firstName}`,
//         startDate: getToday(),
//         endDate: addYearsToDate(getToday(), 1),
//         availability: [
//           {
//             day: entry[CSV_COLUMNS["Day of the Week"]],
//             startTime: formatStandardToMilitaryTime(
//               entry[CSV_COLUMNS["Session Time"]]
//             ),
//             endTime: addOneHourToMilitaryTime(
//               formatStandardToMilitaryTime(entry[CSV_COLUMNS["Session Time"]])
//             ),
//           },
//         ], //based on one hour sessions
//         meetingId: getIdFromMeetingName(
//           entry[CSV_COLUMNS["Zoom Link"]] as MeetingName
//         ),
//         id: "",
//         createdAt: "",
//         summerPaused: false,
//         duration: 1,
//       };

//       if (!tutorEmails.has(migratedTutor.email)) {
//         tutorEmails.add(migratedTutor.email);
//         tutors.push(migratedTutor);
//       }
//       if (!studentEmails.has(migratedStudent.email)) {
//         studentEmails.add(migratedStudent.email);
//         students.push(migratedStudent);
//       }

//       if (migratedPairing.tutor && migratedPairing.student) {
//         const pairingKey = `${migratedPairing.tutor.email}-${migratedPairing.student.email}`;

//         if (!uniqueEnrollments.has(pairingKey)) {
//           uniqueEnrollments.add(pairingKey);
//           pairings.push(migratedPairing);
//         }
//       }
//     }
//     setTutors(tutors);
//     setStudents(students);
//     setPairings(pairings);
//   };

//   const handleMigrate = async () => {
//     setLoading(true);
//     setIsOpen(true);

//     try {
//       if (file) {
//         Papa.parse(file, {
//           complete: async function (results) {
//             // results.data is a 2x2 array
//             const len: number = results.data.length;
//             const headings = results.data.at(0);
//             const data = results.data.slice(1, len);

//             await handleMigrateUsers(len, data);
//           },
//         });
//         console.log("FILE UPLOADED");
//       } else {
//         throw new Error("No file selected");
//       }
//     } catch (error) {
//       console.error("Error uploading file:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

//   const handleConfirmTutorMigration = async () => {
//     setLoading(true);
//     const erroredEntries: ErrorEntry[] = [];
//     const migrations: number[] = [];

//     // await Promise.all(
//     //   Array.from(selectedTutors).map(async (index) => {
//     //     try {
//     //       migrations.push(index);
//     //       const entry = tutors[index];
//     //       if ((await addTutor(entry)) !== null) {
//     //       }
//     //     } catch (error) {
//     //       const err = error as Error;
//     //       erroredEntries.push({
//     //         profile: tutors[index],
//     //         error: err.message || "Unknown error occurred",
//     //       });
//     //     }
//     //   })
//     // );

//     for (const index of Array.from(selectedTutors)) {
//       try {
//         const entry = tutors[index];
//         const result = await addTutor(entry);
//         if (result === null) {
//           throw new Error("Failed to add tutor");
//         }
//         migrations.push(index);
//       } catch (error) {
//         const err = error as Error;
//         const tutorWithDateOfBirth = {
//           ...tutors[index],
//           dateOfBirth: tutors[index].dateOfBirth || getToday(),
//         };
//         erroredEntries.push({
//           profile: tutorWithDateOfBirth,
//           error: err.message || "Unknown error occurred",
//         });
//       }
//       sleep(5000);
//     }

//     const remainingTutors = tutors.filter(
//       (_, index) => !migrations.includes(index)
//     );

//     if (erroredEntries.length == 0) {
//       toast.success("Registered all tutors successfully");
//     } else {
//       toast.success(`Registered ${migrations.length} tutors`);
//     }

//     setTutors(remainingTutors);
//     setSelectedTutors(new Set());
//     setErroredTutorEntries((prev) => [...prev, ...erroredEntries]);
//     setLoading(false);
//     setShowErrorEntries(true);
//   };

//   const handleConfirmStudentMigration = async () => {
//     setLoading(true);
//     const erroredEntries: ErrorEntry[] = [];
//     const migrations: number[] = [];

//     //Concurrent much quicker

//     // await Promise.all(
//     //   Array.from(selectedStudents).map(async (index) => {
//     //     try {
//     //       migrations.push(index);
//     //       const entry = students[index];
//     //       if ((await addStudent(entry)) !== null) {
//     //       }
//     //     } catch (error) {
//     //       const err = error as Error;
//     //       erroredEntries.push({
//     //         profile: students[index],
//     //         error: err.message || "Unknown error occurred",
//     //       });
//     //     }
//     //   })
//     // );

//     for (const index of Array.from(selectedStudents)) {
//       try {
//         const entry = students[index];
//         const result = await addStudent(entry);
//         if (result === null) {
//           throw new Error("Failed to add student");
//         }
//         migrations.push(index);
//       } catch (error) {
//         const err = error as Error;
//         erroredEntries.push({
//           profile: students[index],
//           error: err.message || "Unknown error occured",
//         });
//       }
//       sleep(5000);
//     }

//     const remainingStudents = students.filter(
//       (_, index) => !migrations.includes(index)
//     );

//     if (erroredEntries.length == 0) {
//       toast.success("Registered all students successfully");
//     } else {
//       toast.error(`Unable to register ${erroredEntries.length} students`);
//     }

//     setStudents(remainingStudents);
//     setSelectedStudents(new Set());
//     setErroredStudentEntries((prev) => [...prev, ...erroredEntries]);
//     setLoading(false);
//     setShowErrorEntries(true);
//   };

//   const handleConfirmPairingMigration = async () => {
//     setLoading(true);
//     const migrations: number[] = [];
//     const erroredEntries: ErrorEnrollment[] = [];

//     const results = {
//       success: [] as number[],
//       failed: [] as { index: number; error: string }[],
//     };

//     try {
//       await Promise.all(
//         Array.from(selectedPairings).map(async (index) => {
//           const entry = pairings[index];
//           migrations.push(index);

//           try {
//             if (entry.student && entry.tutor) {
//               const [studentData, tutorData] = await Promise.all([
//                 getProfileByEmail(entry.student.email),
//                 getProfileByEmail(entry.tutor.email),
//               ]);

//               await createEnrollment(entry, studentData, tutorData);
//               results.success.push(index);
//             } else {
//               results.failed.push({
//                 index,
//                 error: "missing student or tutor email",
//               });
//             }
//           } catch (error) {
//             erroredEntries.push({
//               enrollment: entry,
//               error: error instanceof Error ? error.message : "Unknown error",
//             });
//             results.failed.push({
//               index,
//               error: error instanceof Error ? error.message : "Unknown error",
//             });
//           }
//         })
//       );
//     } catch (error) {
//       console.error("Migration failed: ", error);
//     } finally {
//       const remainingpairings = pairings.filter(
//         (_, index) => !migrations.includes(index)
//       );
//       setLoading(false);
//       setPairings(remainingpairings);
//       setSelectedPairings(new Set());
//       setErroredPairingEntries(erroredEntries);
//       setShowErrorEntries(true);

//       console.log(
//         `Succeeded: ${results.success.length} : Failed ${results.failed.length}`
//       );
//       if (results.failed.length > 0) {
//         console.error(results.failed);
//       }
//     }
//   };

//   const handleShowErrorEntries = async () => {
//     setShowErrorEntries((prev) => !prev);
//   };

//   return (
//     <>
//       <Toaster />

//       <div className="container mx-auto p-8">
//         <h1 className="text-3xl font-bold mb-8">Migrate Data</h1>
//         <div className="flex grid grid-cols-3 gap-6">
//           {" "}
//           <Input
//             id="file"
//             type="file"
//             onChange={handleFileChange}
//             accept=".csv"
//             className={`${file ? "bg-green-200" : ""}`}
//           />
//           {/* <FileLoader
//             handleFunction={handleFileChange}
//             acceptedFormats=".csv"
//             description="CSV FILE"
//           /> */}
//           <Button onClick={handleMigrate} disabled={loading}>
//             {loading ? (
//               <>
//                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                 Processing...
//               </>
//             ) : (
//               "Migrate Users"
//             )}
//           </Button>
//         </div>

//         <Dialog open={isOpen} onOpenChange={setIsOpen}>
//           <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
//             <DialogHeader>
//               <div className="flex flex-row gap-2">
//                 <DialogTitle
//                   onClick={handleShowTutors}
//                   className={`${showTutors ? "text-[#84ceeb]" : ""} `}
//                 >
//                   Tutor Migration
//                 </DialogTitle>
//                 <DialogTitle> | </DialogTitle>
//                 <DialogTitle
//                   onClick={handleShowStudents}
//                   className={`${showStudents ? "text-[#84ceeb]" : ""}`}
//                 >
//                   Student Migration
//                 </DialogTitle>
//                 <DialogTitle>|</DialogTitle>
//                 <DialogTitle
//                   onClick={handleShowPairings}
//                   className={`${showPairings ? "text-[#84ceeb]" : ""}`}
//                 >
//                   Make Pairings
//                 </DialogTitle>
//                 <div className="flex items-center ml-auto mr-12">
//                   {" "}
//                   <Switch
//                     onCheckedChange={handleShowErrorEntries}
//                     checked={showErrorEntries}
//                     id="Show Error"
//                     className="mx-2"
//                   />
//                   <DialogTitle className="text-[#FF0000]">
//                     Show Errors
//                   </DialogTitle>
//                 </div>
//               </div>
//               <DialogDescription>
//                 {showErrorEntries
//                   ? "Entries with errors"
//                   : showStudents
//                     ? "Select the Students you want to migrate to the portal."
//                     : showTutors
//                       ? "Select the Tutors you want to migrate to the portal."
//                       : showPairings
//                         ? "Select the pairings you want to migrate to the portal"
//                         : ""}
//               </DialogDescription>
//             </DialogHeader>

//             {showPairings ? (
//               showErrorEntries ? (
//                 erroredPairingEntries.length > 0 ? (
//                   <>
//                     <Table>
//                       <TableHeader>
//                         <TableRow>
//                           <TableHead>Tutor</TableHead>
//                           <TableHead>Student</TableHead>
//                           <TableHead>Start Date</TableHead>
//                           <TableHead>End Date</TableHead>
//                           <TableHead>Time</TableHead>
//                           <TableHead>Error</TableHead>
//                         </TableRow>
//                       </TableHeader>
//                       <TableBody>
//                         {erroredPairingEntries.map((pairing, index) => (
//                           <TableRow key={pairing.enrollment.id}>
//                             <TableCell>
//                               {`${pairing.enrollment.tutor?.firstName}`}{" "}
//                               {`${pairing.enrollment.tutor?.lastName}`}
//                             </TableCell>
//                             <TableCell>
//                               {`${pairing.enrollment.student?.firstName}`}{" "}
//                               {`${pairing.enrollment.student?.lastName}`}
//                             </TableCell>
//                             <TableCell>
//                               {`${pairing.enrollment.startDate}`}
//                             </TableCell>
//                             <TableCell>
//                               {`${pairing.enrollment.endDate}`}
//                             </TableCell>
//                             <TableCell>
//                               {`${formatAvailability(
//                                 pairing.enrollment.availability
//                               )}`}
//                             </TableCell>
//                             <TableCell>{`${pairing.error}`}</TableCell>
//                           </TableRow>
//                         ))}
//                       </TableBody>
//                     </Table>
//                     {myPagination}
//                   </>
//                 ) : (
//                   <p className="text-center p-8">No Errors found in pairings</p>
//                 )
//               ) : currentPairings.length > 0 ? (
//                 <>
//                   <Table>
//                     <TableHeader>
//                       <TableRow>
//                         <TableHead className="w-12">
//                           <Checkbox
//                             checked={selectedPairings.size === pairings.length}
//                             onCheckedChange={toggleSelectAllPairings}
//                             aria-label="Select all Pairings"
//                           />
//                         </TableHead>
//                         <TableHead>Tutor</TableHead>
//                         <TableHead>Student</TableHead>
//                         {/* <TableHead>Tutor Email</TableHead> */}
//                         {/* <TableHead>Student Email</TableHead> */}
//                         <TableHead>Start Date</TableHead>
//                         <TableHead>End Date</TableHead>
//                         <TableHead>Time</TableHead>
//                       </TableRow>
//                     </TableHeader>
//                     <TableBody>
//                       {pairings.map((pairing, index) => (
//                         <TableRow key={pairing.id}>
//                           <TableCell>
//                             <Checkbox
//                               checked={selectedPairings.has(startIndex + index)}
//                               onCheckedChange={() =>
//                                 toggleSelectPairing(startIndex + index)
//                               }
//                               aria-label={`Select ${pairing.tutor?.firstName} ${pairing.tutor?.lastName} - ${pairing.student?.firstName} ${pairing.student?.lastName}`}
//                             />
//                           </TableCell>
//                           <TableCell>{`${pairing.tutor?.firstName} ${pairing.tutor?.lastName}`}</TableCell>
//                           <TableCell>{`${pairing.student?.firstName} ${pairing.student?.lastName}`}</TableCell>
//                           {/* <TableCell>{`${pairing.tutor?.email}`}</TableCell> */}
//                           {/* <TableCell>{`${pairing.student?.email}`}</TableCell> */}
//                           <TableCell>{`${pairing.startDate}`}</TableCell>
//                           <TableCell>{`${pairing.endDate}`}</TableCell>
//                           <TableCell>{`${formatAvailability(
//                             pairing.availability
//                           )}`}</TableCell>
//                         </TableRow>
//                       ))}
//                     </TableBody>
//                   </Table>

//                   {myPagination}
//                 </>
//               ) : (
//                 <p className="text-center p-8">No pairings found</p>
//               )
//             ) : (
//               ""
//             )}

//             {showStudents ? (
//               showErrorEntries ? (
//                 erroredStudentEntries?.length > 0 ? (
//                   <>
//                     <Table>
//                       <TableHeader>
//                         <TableRow>
//                           <TableHead>Role</TableHead>
//                           <TableHead>Name</TableHead>
//                           <TableHead>Email</TableHead>
//                           <TableHead>Error Message</TableHead>
//                         </TableRow>
//                       </TableHeader>
//                       <TableBody>
//                         {erroredStudentEntries.map((student, index) => (
//                           <TableRow key={student.profile.id}>
//                             <TableCell>{`${student.profile.role}`}</TableCell>
//                             <TableCell>{`${student.profile.firstName} ${student.profile.lastName}`}</TableCell>
//                             <TableCell>{`${student.profile.email}`}</TableCell>
//                             <TableCell>{`${student.error}`}</TableCell>
//                           </TableRow>
//                         ))}
//                       </TableBody>
//                     </Table>
//                     {myPagination}{" "}
//                   </>
//                 ) : loading ? (
//                   <div className="flex justify-center items-center p-8">
//                     <Loader2 className="h-8 w-8 animate-spin" />
//                   </div>
//                 ) : (
//                   <p className="text-center p-8">No Errors found</p>
//                 )
//               ) : students?.length > 0 ? (
//                 <>
//                   <Table>
//                     <TableHeader>
//                       <TableRow>
//                         <TableHead className="w-12">
//                           <Checkbox
//                             checked={selectedStudents.size === students.length}
//                             onCheckedChange={toggleSelectAllStudents}
//                             aria-label="Select all students"
//                           />
//                         </TableHead>
//                         <TableHead>Name</TableHead>
//                         <TableHead>Email</TableHead>
//                         <TableHead>Subjects</TableHead>
//                         <TableHead>Availability</TableHead>
//                         <TableHead>Parent Info</TableHead>
//                       </TableRow>
//                     </TableHeader>
//                     <TableBody>
//                       {currentStudents.map((student, index) => (
//                         <TableRow key={student.id}>
//                           <TableCell>
//                             <Checkbox
//                               checked={selectedStudents.has(startIndex + index)}
//                               onCheckedChange={() =>
//                                 toggleSelectStudent(startIndex + index)
//                               }
//                               aria-label={`Select ${student.firstName} ${student.lastName}`}
//                             />
//                           </TableCell>
//                           <TableCell>{`${student.firstName} ${student.lastName}`}</TableCell>
//                           <TableCell>{student.email}</TableCell>
//                           <TableCell>
//                             {student.subjectsOfInterest.join(", ")}
//                           </TableCell>
//                           <TableCell>
//                             {formatAvailability(student.availability)}
//                           </TableCell>
//                           <TableCell>
//                             {student.parentName && (
//                               <div className="text-sm">
//                                 <div>{student.parentName}</div>
//                                 {student.parentEmail && (
//                                   <div>{student.parentEmail}</div>
//                                 )}
//                                 {student.parentPhone && (
//                                   <div>{student.parentPhone}</div>
//                                 )}
//                               </div>
//                             )}
//                           </TableCell>
//                         </TableRow>
//                       ))}
//                     </TableBody>
//                   </Table>

//                   {myPagination}
//                 </>
//               ) : loading ? (
//                 <div className="flex justify-center items-center p-8">
//                   <Loader2 className="h-8 w-8 animate-spin" />
//                 </div>
//               ) : (
//                 <p className="text-center p-8">No students found</p>
//               ) //-----Migrating Tutors-----
//             ) : (
//               ""
//             )}

//             {showTutors ? (
//               showErrorEntries ? (
//                 erroredTutorEntries?.length > 0 ? (
//                   <>
//                     <Table>
//                       <TableHeader>
//                         <TableRow>
//                           <TableHead>Role</TableHead>
//                           <TableHead>Name</TableHead>
//                           <TableHead>Email</TableHead>
//                           <TableHead>Error</TableHead>
//                         </TableRow>
//                       </TableHeader>
//                       <TableBody>
//                         {erroredTutorEntries.map((tutor, index) => (
//                           <TableRow key={tutor.profile.id}>
//                             <TableCell>{`${tutor.profile.role}`}</TableCell>
//                             <TableCell>{`${tutor.profile.firstName} ${tutor.profile.lastName}`}</TableCell>
//                             <TableCell>{`${tutor.profile.email}`}</TableCell>
//                             <TableCell>{`${tutor.error}`}</TableCell>
//                           </TableRow>
//                         ))}
//                       </TableBody>
//                     </Table>
//                     {myPagination}
//                   </>
//                 ) : loading ? (
//                   <div className="flex justify-center items-center p-8">
//                     <Loader2 className="h-8 w-8 animate-spin" />
//                   </div>
//                 ) : (
//                   <p className="text-center p-8">No Errors found</p>
//                 )
//               ) : tutors?.length > 0 ? (
//                 <>
//                   <Table>
//                     <TableHeader>
//                       <TableRow>
//                         <TableHead className="w-12">
//                           <Checkbox
//                             checked={selectedTutors.size === tutors.length}
//                             onCheckedChange={toggleSelectAllTutors}
//                             aria-label="Select all students"
//                           />
//                         </TableHead>
//                         <TableHead>Name</TableHead>
//                         <TableHead>Email</TableHead>
//                         <TableHead>Subjects</TableHead>
//                         <TableHead>Availability</TableHead>
//                         <TableHead>Parent Info</TableHead>
//                       </TableRow>
//                     </TableHeader>
//                     <TableBody>
//                       {currentTutors.map((tutor, index) => (
//                         <TableRow key={tutor.id}>
//                           <TableCell>
//                             <Checkbox
//                               checked={selectedTutors.has(startIndex + index)}
//                               onCheckedChange={() =>
//                                 toggleSelectTutor(startIndex + index)
//                               }
//                               aria-label={`Select ${tutor.firstName} ${tutor.lastName}`}
//                             />
//                           </TableCell>
//                           <TableCell>{`${tutor.firstName} ${tutor.lastName}`}</TableCell>
//                           <TableCell>{tutor.email}</TableCell>
//                           <TableCell>
//                             {tutor.subjectsOfInterest.join(", ")}
//                           </TableCell>
//                           <TableCell>
//                             {formatAvailability(tutor.availability)}
//                           </TableCell>
//                           <TableCell>
//                             {tutor.parentName && (
//                               <div className="text-sm">
//                                 <div>{tutor.parentName}</div>
//                                 {tutor.parentEmail && (
//                                   <div>{tutor.parentEmail}</div>
//                                 )}
//                                 {tutor.parentPhone && (
//                                   <div>{tutor.parentPhone}</div>
//                                 )}
//                               </div>
//                             )}
//                           </TableCell>
//                         </TableRow>
//                       ))}
//                     </TableBody>
//                   </Table>
//                   {myPagination}
//                 </>
//               ) : loading ? (
//                 <div className="flex justify-center items-center p-8">
//                   <Loader2 className="h-8 w-8 animate-spin" />
//                 </div>
//               ) : (
//                 <p className="text-center p-8">No tutors found</p>
//               ) //-----Migrating Tutors-----
//             ) : (
//               ""
//             )}

//             {migrationStatus && (
//               <p className="text-center text-sm text-muted-foreground">
//                 {migrationStatus}
//               </p>
//             )}

//             <DialogFooter className={`${showErrorEntries ? "invisible" : ""}`}>
//               {showStudents ? (
//                 <Button
//                   onClick={handleConfirmStudentMigration}
//                   disabled={loading || selectedStudents.size === 0}
//                 >
//                   {showErrorEntries ? (
//                     ""
//                   ) : loading ? (
//                     <>
//                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                       Processing...
//                     </>
//                   ) : (
//                     `Migrate Selected (${selectedStudents.size})`
//                   )}
//                 </Button>
//               ) : (
//                 " "
//               )}
//               {showTutors ? (
//                 <Button
//                   onClick={handleConfirmTutorMigration}
//                   disabled={loading || selectedTutors.size === 0}
//                 >
//                   {showErrorEntries ? (
//                     ""
//                   ) : loading ? (
//                     <>
//                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                       Processing...
//                     </>
//                   ) : (
//                     `Migrate Selected (${selectedTutors.size})`
//                   )}
//                 </Button>
//               ) : (
//                 ""
//               )}
//               {showPairings ? (
//                 <Button
//                   onClick={handleConfirmPairingMigration}
//                   disabled={loading || selectedPairings.size === 0}
//                 >
//                   {showErrorEntries ? (
//                     ""
//                   ) : loading ? (
//                     <>
//                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                       Processing...
//                     </>
//                   ) : (
//                     `Migrate Selected (${selectedPairings.size})`
//                   )}
//                 </Button>
//               ) : (
//                 ""
//               )}
//             </DialogFooter>
//           </DialogContent>
//         </Dialog>
//       </div>
//     </>
//   );
// }
