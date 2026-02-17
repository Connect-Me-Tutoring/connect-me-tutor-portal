"use client";
import React, { useState, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachWeekOfInterval,
  parseISO,
} from "date-fns";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Bell,
  ChevronDown,
  Plus,
  Link as LinkIcon,
  Eye,
  RefreshCw,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AvailabilityFormat from "@/components/student/AvailabilityFormat";
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
  getEventsWithTutorMonth,
  getUserFromId,
  resendEmailConfirmation,
} from "@/lib/actions/admin.actions";
import { editProfile } from "@/lib/actions/profile.server.actions";
import { getEvents } from "@/lib/actions/event.server.actions";
import { deleteUser } from "@/lib/actions/auth.server.actions";
import { addUser } from "@/lib/actions/auth.actions";
import { getTutorSessions } from "@/lib/actions/tutor.actions";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Profile, Session, Event } from "@/types";
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
import { Combobox } from "@/components/ui/combobox";

import AddTutorForm from "./components/AddTutorForm";
import DeleteTutorForm from "./components/DeleteTutorForm";
import EditTutorForm from "./components/EditTutorForm";
import { Turret_Road } from "next/font/google";
import { capitalizeFirstLetter } from "@/lib/utils";
import { UserAvailabilities } from "../ui/UserAvailabilities";

const TutorList = ({ initialTutors }: any) => {
  const supabase = createClientComponentClient();
  const [tutors, setTutors] = useState<Profile[]>(initialTutors);
  const [filteredTutors, setFilteredTutors] =
    useState<Profile[]>(initialTutors);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterValue, setFilterValue] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTutor, setNewTutor] = useState<Partial<Profile>>({
    role: "Tutor",
    firstName: "",
    lastName: "",
    // dateOfBirth: "",
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
  });

  const [selectedTutor, setSelectedTutor] = useState<Profile | null>(null);

  //---Modals
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [sessionsData, setSessionsData] = useState<{
    [key: string]: Session[];
  }>({});
  const [eventsData, setEventsData] = useState<{ [key: string]: Event[] }>({});
  const [allTimeHours, setAllTimeHours] = useState<{ [key: string]: number }>(
    {},
  );
  const [addingTutor, setAddingTutor] = useState(false);

  const getTutorData = async () => {
    try {
      setLoading(true);
      setError(null);

      const tutorsData = await getAllProfiles("Tutor", "created_at", false);
      if (!tutorsData) throw new Error("No tutors found");

      setTutors(tutorsData);
      setFilteredTutors(tutorsData);
    } catch (error) {
      console.error("Error fetching tutor data:", error);
      setError(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const filtered = tutors.filter((tutor) => {
      const searchTerm = filterValue.toLowerCase().trim();

      if (!searchTerm) return true;

      const tutorFirstName = tutor.firstName?.toLowerCase() || "";
      const tutorLastName = tutor.lastName?.toLowerCase() || "";
      const tutorEmail = tutor.email?.toLowerCase() || "";

      const fullName = `${tutorFirstName} ${tutorLastName}`.trim();

      return (
        tutorFirstName.includes(searchTerm) ||
        tutorLastName.includes(searchTerm) ||
        tutorEmail.includes(searchTerm) ||
        fullName.includes(searchTerm)
      );
    });
    setFilteredTutors(filtered);
    setCurrentPage(1);
  }, [filterValue, tutors]);

  const totalPages = Math.ceil(filteredTutors.length / rowsPerPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  const handleTimeZone = (value: string) => {
    setNewTutor((prev) => ({ ...prev, timeZone: value }));
  };

  const handleTimeZoneForEdit = (value: string) => {
    setSelectedTutor((prev) =>
      prev ? ({ ...prev, timeZone: value } as Profile) : null,
    );
  };

  const paginatedTutors = filteredTutors.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setNewTutor((prev) => ({ ...prev, [name]: value }));
  };

  const handleInputChangeForEdit = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setSelectedTutor((prev) =>
      prev ? ({ ...prev, [name]: value } as Profile) : null,
    );
  };

  const handleComplexFieldsForEdit = (name: string, value: any) => {
    setSelectedTutor((prev) =>
      prev ? ({ ...prev, [name]: value } as Profile) : null,
    );
  };

  const handleAvailabilityChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const { name, value } = e.target;
    setNewTutor((prev) => {
      const newAvailability = [...(prev.availability || [])];
      newAvailability[index] = { ...newAvailability[index], [name]: value };
      return { ...prev, availability: newAvailability };
    });
  };

  const handleSubjectsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const subjects = e.target.value.split(",").map((subject) => subject.trim());
    setNewTutor((prev) => ({ ...prev, subjectsOfInterest: subjects }));
  };

  const handleAddTutorWithParam = async (tutor: Partial<Profile>) => {
    try {
      setAddingTutor(true);
      // Ensure addStudent returns a Profile
      const addedTutor: Profile = await addUser(tutor, "Tutor", true);

      if (addedTutor) {
        setIsModalOpen(false);
        setTutors((prevTutors) => [...prevTutors, addedTutor]);
        setFilteredTutors((prev) => [...prev, addedTutor]);
        toast.success("Successfully added tutor.");

        setNewTutor({
          role: "Tutor",
          firstName: "",
          lastName: "",
          // dateOfBirth: "",
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
        });
      }
    } catch (error) {
      const err = error as Error;
      toast.error(`Failed to add tutor: Please Try Again`);
    } finally {
      setAddingTutor(false);
    }
  };

  const handleResendEmailConfirmation = async () => {
    if (selectedTutor) {
      try {
        await resendEmailConfirmation(selectedTutor.email);
        toast.success("Resent Email Confirmation");
      } catch (error) {
        console.error("Failed to resend email confirmation", error);
        toast.error("Failed to resend email confirmation");
      }
    }
  };

  const handleDeleteTutor = async () => {
    if (selectedTutorId) {
      try {
        await deleteUser(selectedTutorId);
        toast.success("Tutor deleted successfully");
        setSelectedTutorId(null);
        getTutorData();
      } catch (error) {
        toast.error("Failed to delete Tutor");
      }
    }
  };

  const handleDeactivateTutor = async () => {
    if (selectedTutorId) {
      try {
        const data = await deactivateUser(selectedTutorId); // Call deactivateUser function with studentId
        if (data) {
          toast.success("Tutor deactivated successfully");
          setSelectedTutorId(null);
          getTutorData();
        }
      } catch (error) {
        toast.error("Failed to deactivate tutor");
      }
    }
  };

  const handleGetSelectedTutor = async (profileId: string | null) => {
    if (profileId) {
      try {
        const data = await getUserFromId(profileId);
        setSelectedTutor(data as unknown as Profile);
        // setIsReactivateModalOpen(false);
        return data;
      } catch (error) {
        console.error("Failed to identify tutor");
      }
    }
  };

  const handleEditTutor = async () => {
    if (selectedTutor) {
      try {
        await editProfile(selectedTutor);
        toast.success("Tutor Edited Successfully");
        setIsEditModalOpen(false);
        setSelectedTutor(null);
        getTutorData();
      } catch (error) {
        toast.error("Failed to edit tutor");
      }
    }
  };

  const handleReactivateTutor = async () => {
    if (selectedTutorId) {
      try {
        const data = await reactivateUser(selectedTutorId); // Call deactivateUser function with studentId
        if (data) {
          toast.success("Tutor reactivated successfully");
          setIsReactivateModalOpen(false);
          setSelectedTutorId(null);
          getTutorData();
        }
      } catch (error) {
        toast.error("Failed to deactivate student");
      }
    }
  };

  return (
    <>
      {" "}
      <div className="flex justify-between items-center mb-4">
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder="Filter tutors..."
            className="w-64"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
          {/*Add Tutor*/}
          <AddTutorForm
            newTutor={newTutor}
            setNewTutor={setNewTutor}
            addingTutor={addingTutor}
            handleInputChange={handleInputChange}
            handleAddTutor={handleAddTutorWithParam}
            handleTimeZone={handleTimeZone}
          />
          {/*Delete Student*/}
          <DeleteTutorForm
            tutors={tutors}
            selectedTutorId={selectedTutorId}
            setSelectedTutorId={setSelectedTutorId}
            handleDeleteTutor={handleDeleteTutor}
          />

          {/*Reactivate Student*/}
          <EditTutorForm
            isReactivateModalOpen={isReactivateModalOpen}
            setIsReactivateModalOpen={setIsReactivateModalOpen}
            isEditModalOpen={isEditModalOpen}
            setIsEditModalOpen={setIsEditModalOpen}
            tutors={tutors}
            selectedTutor={selectedTutor}
            selectedTutorId={selectedTutorId}
            setSelectedTutor={setSelectedTutor}
            setSelectedTutorId={setSelectedTutorId}
            handleEditTutor={handleEditTutor}
            handleGetSelectedTutor={handleGetSelectedTutor}
            handleInputChangeForEdit={handleInputChangeForEdit}
            handleComplexFieldsForEdit={handleComplexFieldsForEdit}
            handleTimeZoneForEdit={handleTimeZoneForEdit}
          />
          {/*Edit Page*/}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>Tutor Name</TableHead>
            <TableHead>Availability</TableHead>
            <TableHead>Subjects Teaching </TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone Number</TableHead>
            <TableHead>Gender</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTutors.map((tutor, index) => (
            <TableRow key={index}>
              <TableCell>{tutor.status}</TableCell>
              <TableCell>{tutor.startDate}</TableCell>
              <TableCell>
                {tutor.firstName} {tutor.lastName}
              </TableCell>
              <TableCell>
                <UserAvailabilities user={tutor} />
              </TableCell>
              <TableCell className="flex flex-col">
                {tutor.subjects_of_interest?.map((item, index) => (
                  <span key={index}>{item}</span>
                ))}
              </TableCell>
              <TableCell>{tutor.email}</TableCell>
              <TableCell>{tutor.phoneNumber}</TableCell>
              <TableCell>{capitalizeFirstLetter(tutor.gender)}</TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {" "}
                        Resend Confirmation Email for {tutor.firstName}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Note: Will not resend confirmation email if the user has
                        already signed in before
                      </AlertDialogDescription>
                    </AlertDialogHeader>{" "}
                    <AlertDialogFooter>
                      {" "}
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          resendEmailConfirmation(tutor.email)
                            .then(() => {
                              toast.success("Resent Email Confirmation");
                            })
                            .catch(() => {
                              toast.error(
                                "Failed to resend email confirmation",
                              );
                            });
                        }}
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
        <span>{filteredTutors.length} row(s) total.</span>
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

export default TutorList;
