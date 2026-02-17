"use client";
import React, { useState, useEffect } from "react";
import {
  Bell,
  ChevronDown,
  Plus,
  Link as LinkIcon,
  Eye,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import AvailabilityFormat from "@/components/student/AvailabilityFormat";
import { Combobox } from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scrollarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProfile } from "@/lib/actions/user.actions";
import {
  getAllProfiles,
  deactivateUser,
  reactivateUser,
  getUserFromId,
  resendEmailConfirmation,
} from "@/lib/actions/admin.actions";
import { editProfile } from "@/lib/actions/profile.server.actions"
import { deleteUser } from "@/lib/actions/auth.server.actions";
import { addUser } from "@/lib/actions/auth.actions";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Profile } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import toast, { Toaster } from "react-hot-toast";
import { set } from "date-fns";
import { AlertDialogCancel } from "@radix-ui/react-alert-dialog";
import AddStudentForm from "./components/AddStudentForm";
import DeleteStudentForm from "./components/DeleteStudentForm";
import EditStudentForm from "./components/EditStudentForm";
import { UserAvailabilities } from "../ui/UserAvailabilities";

const getOrdinalSuffix = (num: number): string => {
  if (num === 1) return "st";
  if (num === 2) return "nd";
  if (num === 3) return "rd";
  return "th";
};

const StudentList = ({ initialStudents }: any) =>
  //   {
  //   isOpen,
  //   onOpenChange,
  //   onDeactivate,
  // }: {
  //   isOpen: boolean;
  //   onOpenChange: (open: boolean) => void;
  //   students: Array<{
  //     id: string;
  //     firstName: string;
  //     lastName: string;
  //     status: string;
  //   }>;
  //   onDeactivate: (studentId: string) => void;
  // }
  {
    const supabase = createClientComponentClient();
    const [students, setStudents] = useState<Profile[]>(initialStudents);
    const [filteredStudents, setFilteredStudents] = useState<Profile[]>(initialStudents);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [filterValue, setFilterValue] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newStudent, setNewStudent] = useState<Partial<Profile>>({
      role: "Student",
      firstName: "",
      lastName: "",
      age: "",
      grade: "",
      gender: "",
      startDate: "",
      availability: [],
      email: "",
      phoneNumber: "",
      parentName: "",
      parentPhone: "",
      parentEmail: "",
      timeZone: "",
      subjects_of_interest: [],
      status: "Active",
      tutorIds: [],
      studentNumber: "",
    });
    const [selectedStudent, setSelectedStudent] = useState<Profile | null>(
      null
    );

    //---Modals
    const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
      null
    );
    const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [addingStudent, setAddingStudent] = useState(false);

    const getStudentData = async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw new Error(userError.message);
        if (!user) throw new Error("No user found");

        const profileData = await getProfile(user.id);
        if (!profileData) throw new Error("No profile found");

        setProfile(profileData);

        const studentsData = await getAllProfiles(
          "Student",
          "created_at",
          false
        );
        if (!studentsData) throw new Error("No students found");

        setStudents(studentsData);
        setFilteredStudents(studentsData);
      } catch (error) {
        console.error("Error fetching tutor data:", error);
        setError(
          error instanceof Error ? error.message : "An unknown error occurred"
        );
      } finally {
        setLoading(false);
      }
    };


    useEffect(() => {
      const filtered = students.filter((student) => {
        const searchTerm = filterValue.toLowerCase().trim();

        if (!searchTerm) return true;

        const studentFirstName = student.firstName?.toLowerCase() || "";
        const studentLastName = student.lastName?.toLowerCase() || "";
        const studentEmail = student.email?.toLowerCase() || "";
        const studentNumber = student.studentNumber?.toLowerCase() || "";

        const fullName = `${studentFirstName} ${studentLastName}`.trim();

        return (
          studentFirstName.includes(searchTerm) ||
          studentLastName.includes(searchTerm) ||
          studentEmail.includes(searchTerm) ||
          studentNumber.includes(searchTerm) ||
          fullName.includes(searchTerm)
        );
      });

      setFilteredStudents(filtered);
      setCurrentPage(1);
    }, [filterValue, students]);

    const totalPages = Math.ceil(filteredStudents.length / rowsPerPage);

    const handlePageChange = (newPage: number) => {
      setCurrentPage(newPage);
    };

    const handleAgeChange = (value: string) => {
      setNewStudent((prev) => ({ ...prev, age: value }));
    };

    const handleAgeChangeForEdit = (value: string) => {
      setSelectedStudent((prev) => (prev ? { ...prev, age: value } : null));
    };

    const handleGradeChange = (value: string) => {
      setNewStudent((prev) => ({ ...prev, grade: value }));
    };

    const handleGradeChangeForEdit = (value: string) => {
      setSelectedStudent((prev) => ({ ...prev, grade: value }) as Profile);
    };

    const handleTimeZone = (value: string) => {
      setNewStudent((prev) => ({ ...prev, timeZone: value }));
    };

    const handleTimeZoneForEdit = (value: string) => {
      setSelectedStudent((prev) =>
        prev ? { ...prev, timeZone: value } : null
      );
    };

    const handleGender = (value: string) => {
      setNewStudent((prev) => ({ ...prev, gender: value }));
    };

    const handleGenderForEdit = (value: string) => {
      setSelectedStudent((prev) => (prev ? { ...prev, gender: value } : null));
    };

    const handleRowsPerPageChange = (value: string) => {
      setRowsPerPage(parseInt(value));
      setCurrentPage(1);
    };

    const paginatedStudents = filteredStudents.slice(
      (currentPage - 1) * rowsPerPage,
      currentPage * rowsPerPage
    );

    const handleInputChange = (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const { name, value } = e.target;
      setNewStudent((prev) => ({ ...prev, [name]: value }));
    };

    const handleInputChangeForEdit = (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const { name, value } = e.target;
      setSelectedStudent((prev) =>
        prev ? ({ ...prev, [name]: value } as Profile) : null
      );
    };

    const handleEditProfile = (name: string, value: any) => {
      setSelectedStudent((prev) =>
        prev ? ({ ...prev, [name]: value } as Profile) : null
      );
    };

    const handleAvailabilityChange = (
      e: React.ChangeEvent<HTMLInputElement>,
      index: number
    ) => {
      const { name, value } = e.target;
      setNewStudent((prev) => {
        const newAvailability = [...(prev.availability || [])];
        newAvailability[index] = { ...newAvailability[index], [name]: value };
        return { ...prev, availability: newAvailability };
      });
    };

    const handleSubjectsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const subjects = e.target.value
        .split(",")
        .map((subject) => subject.trim());
      setNewStudent((prev) => ({ ...prev, subjectsOfInterest: subjects }));
    };

    const handleSubjectsChangeForEdit = (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      const subjects = e.target.value
        .split(",")
        .map((subject) => subject.trim());
      setSelectedStudent(
        (prev) => ({ ...prev, subjectsOfInterest: subjects }) as Profile
      );
    };

    const handleAddStudentWithParam = async (student: Partial<Profile>) => {
      try {
        setAddingStudent(true);
        // Ensure addStudent returns a Profile
        const addedStudent: Profile = await addUser(student, "Student", true);

        if (addedStudent) {
          // Close modal and show success toast
          setIsModalOpen(false);
          setStudents((prevStudents) => [...prevStudents, addedStudent]);
          setFilteredStudents((prev) => [...prev, addedStudent]);
          toast.success("Successfully added student.");

          // Reset form
          setNewStudent({
            role: "Student",
            firstName: "",
            lastName: "",
            age: "",
            grade: "",
            gender: "",
            startDate: "",
            availability: [],
            email: "",
            parentName: "",
            parentPhone: "",
            parentEmail: "",
            timeZone: "",
            subjects_of_interest: [],
            status: "Active",
            tutorIds: [],
          });
        }
      } catch (error) {
        const err = error as Error;
        console.error("Error adding student:", error);
        toast.error("Failed to Add Student.");
        toast.error(`Failed to Add Student: Please Try Again`);
      } finally {
        setAddingStudent(false);
      }
    };

    const handleAddStudent = async () => {
      try {
        setAddingStudent(true);
        // Ensure addStudent returns a Profile
        const addedStudent: Profile = await addUser(
          newStudent,
          "Student",
          true
        );

        // Update local state
        setStudents((prevStudents) => {
          // Check if addedStudent is valid
          if (addedStudent) {
            return [...prevStudents, addedStudent]; // Ensure returning an array of Profile
          }
          return prevStudents; // Return previous state if addedStudent is not valid
        });

        setFilteredStudents((prevFiltered) => {
          // Check if addedStudent is valid
          if (addedStudent) {
            return [...prevFiltered, addedStudent]; // Ensure returning an array of Profile
          }
          return prevFiltered; // Return previous state if addedStudent is not valid
        });

        if (addedStudent) {
          // Close modal and show success toast
          setIsModalOpen(false);
          setStudents((prevStudents) => [...prevStudents, addedStudent]);

          toast.success("Successfully added student.");

          // Reset form
          setNewStudent({
            role: "Student",
            firstName: "",
            lastName: "",
            age: "",
            grade: "",
            gender: "",
            startDate: "",
            availability: [],
            email: "",
            parentName: "",
            parentPhone: "",
            parentEmail: "",
            timeZone: "",
            subjects_of_interest: [],
            status: "Active",
            tutorIds: [],
          });
        }
      } catch (error) {
        const err = error as Error;
        console.error("Error adding student:", error);
        toast.error("Failed to Add Student.");
        toast.error(`Failed to Add Student: Please Try Again`);
      } finally {
        setAddingStudent(false);
      }
    };

    const handleDeleteStudent = async () => {
      if (selectedStudentId) {
        try {
          console.log("Deleting User");
          await deleteUser(selectedStudentId);
          toast.success("Student deleted successfully");
          setIsDeactivateModalOpen(false);
          setSelectedStudentId(null);
          getStudentData();
        } catch (error) {
          toast.error("Failed to delete student");
        }
      }
    };

    //----Deprecated--->
    const handleDeactivateStudent = async () => {
      if (selectedStudentId) {
        try {
          const data = await deactivateUser(selectedStudentId); // Call deactivateUser function with studentId
          if (data) {
            toast.success("Student deactivated successfully");
            setIsDeactivateModalOpen(false);
            setSelectedStudentId(null);
            getStudentData();
          }
        } catch (error) {
          toast.error("Failed to deactivate student");
        }
      }
    };
    //<---

    const handleGetSelectedStudent = async (profileId: string | null) => {
      if (profileId) {
        try {
          const data = await getUserFromId(profileId);
          setSelectedStudent(data as unknown as Profile);
          // setIsReactivateModalOpen(false);
        } catch (error) {
          console.error("Failed to identify tutor");
        }
      }
    };

    const handleEditStudent = async () => {
      if (selectedStudent) {
        try {
          await editProfile(selectedStudent);
          toast.success("Tutor Edited Successfully");
          setIsEditModalOpen(false);
          setSelectedStudent(null);
          getStudentData();
        } catch (error) {
          toast.error("Failed to edit tutor");
        }
      }
    };

    const handleReactivateStudent = async () => {
      if (selectedStudentId) {
        try {
          const data = await reactivateUser(selectedStudentId); // Call deactivateUser function with studentId
          if (data) {
            toast.success("Student reactivated successfully");
            setIsReactivateModalOpen(false);
            setSelectedStudentId(null);
            getStudentData();
          }
        } catch (error) {
          toast.error("Failed to deactivate student");
        }
      }
    };

    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="Filter students..."
              className="w-64"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            />
            {/*Add Student*/}
            <AddStudentForm
              newStudent={newStudent}
              handleInputChange={handleInputChange}
              handleGradeChange={handleGradeChange}
              handleTimeZone={handleTimeZone}
              handleGender={handleGender}
              handleAddStudent={handleAddStudentWithParam}
              addingStudent={addingStudent}
            />

            <DeleteStudentForm
              students={students}
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
              handleDeleteStudent={handleDeleteStudent}
            />
            {/*Reactivate Student*/}

            <EditStudentForm
              students={students}
              selectedStudentId={selectedStudentId}
              setSelectedStudentId={setSelectedStudentId}
              handleGetSelectedStudent={handleGetSelectedStudent}
              selectedStudent={selectedStudent}
              handleInputChangeForEdit={handleInputChangeForEdit}
              handleGradeChangeForEdit={handleGradeChangeForEdit}
              handleGenderForEdit={handleGenderForEdit}
              handleTimeZoneForEdit={handleTimeZoneForEdit}
              handleSubjectsChangeForEdit={handleSubjectsChangeForEdit}
              handleEditProfile={handleEditProfile}
              getOrdinalSuffix={getOrdinalSuffix}
              handleEditStudent={handleEditStudent}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead>Student Name</TableHead>
              <TableHead>Grade Level</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead>Subjects Learning</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Parent Email</TableHead>
              <TableHead>Parent Phone</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedStudents.map((student, index) => (
              <TableRow key={index}>
                <TableCell>{student.studentNumber}</TableCell>
                <TableCell>{student.status}</TableCell>
                <TableCell>{student.startDate}</TableCell>
                <TableCell>
                  {student.firstName} {student.lastName}
                </TableCell>
                <TableCell>{student.grade}</TableCell>
                <TableCell>
                  <UserAvailabilities user={student} />
                </TableCell>
                <TableCell className="flex flex-col">
                  {student.subjects_of_interest?.map((item, index) => (
                    <span key={index}>{item}</span>
                  ))}
                </TableCell>
                <TableCell>{student.email}</TableCell>
                <TableCell>{student.parentEmail || ""}</TableCell>
                <TableCell>{student.parentPhone}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Resend Email Confirmation for {student.firstName}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {" "}
                          Note: Will not resend confirmation email if the user
                          has already signed in before
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            resendEmailConfirmation(student.email)
                              .then(() =>
                                toast.success("Resent Email Confirmation")
                              )
                              .catch(() =>
                                toast.error("Failed to resend email")
                              )
                          }
                        >
                          Resend
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 flex justify-between items-center">
          <span>{filteredStudents.length} row(s) total.</span>
          <div className="flex items-center space-x-2">
            <span>Rows per page</span>
            <Select
              value={rowsPerPage.toString()}
              onValueChange={handleRowsPerPageChange}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder={rowsPerPage.toString()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Toaster />
      </>
    );
  };

export default StudentList;
