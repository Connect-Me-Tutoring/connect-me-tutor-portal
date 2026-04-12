"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Users, GraduationCap } from "lucide-react";
import { PairingRequest } from "@/types/pairing";
import {
  getAllPairingRequests,
  removePairingRequest,
} from "@/lib/actions/pairing.actions";
import { to12Hour } from "@/lib/utils";
import toast from "react-hot-toast";
import { TestingPairingControls } from "../test-controls";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PriorityQueue() {
  const [pairingRequests, setPairingRequests] = useState<PairingRequest[]>([]);

  const removeFromQueue = async (id: string) => {
    // console.log("Current Data", currentData);
    // console.log("Pairing Request", pairingRequests);
    // console.log("Removing", id);

    await removePairingRequest(id);
    setPairingRequests((pairingRequests) =>
      pairingRequests.filter((request) => request.request_id !== id),
    );
  };

  useEffect(() => {
    (async () => {
      const [tutorRes, studentRes] = await Promise.all([
        getAllPairingRequests("tutor"),
        getAllPairingRequests("student"),
      ]);
      const error = tutorRes.error ?? studentRes.error;
      if (error) {
        toast.error("Failed to load pairing que");
        console.error("Failed to load pairing queue", error);
        return;
      }
      const tutorData = tutorRes.data ?? [];
      const studentData = studentRes.data ?? [];
      const merged = [...tutorData, ...studentData].sort(
        (a, b) => a.priority - b.priority,
      );
      setPairingRequests(merged);
    })();
  }, []);

  const updatePriority = (id: string, newPriority: number) => {
    setPairingRequests(
      pairingRequests.map((request) =>
        request.request_id === id
          ? {
              ...request,
              priority: newPriority,
              profile: { ...request.profile, priorityLevel: newPriority },
            }
          : request,
      ),
    );
  };

  const sortedRequests = [...pairingRequests].sort(
    (a, b) => a.priority - b.priority,
  );
  const tutorCount = sortedRequests.filter((r) => r.type === "tutor").length;
  const studentCount = sortedRequests.filter((r) => r.type === "student").length;
  const currentCount = sortedRequests.length;

  const getPriorityColor = (level: number) => {
    switch (level) {
      case 1:
        return "bg-red-100 text-red-800 border-red-200";
      case 2:
        return "bg-orange-100 text-orange-800 border-orange-200";
      case 3:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "accepted":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <main className="p-8 bg-gray-50">
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Pairing Queue Management
            </h1>
            <p className="text-gray-600">
              Active pairing requests (tutors and students), sorted by priority
            </p>
          </div>

          <div>
            <TestingPairingControls />
          </div>

          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-6 border-b">
              <div className="flex flex-wrap items-center gap-3">
                <Users className="h-6 w-6 text-gray-700" />
                <h2 className="text-2xl font-semibold text-gray-900">
                  Queue ({currentCount})
                </h2>
                <span className="text-sm text-gray-500">
                  {tutorCount} tutor{tutorCount === 1 ? "" : "s"} ·{" "}
                  {studentCount} student{studentCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            {currentCount > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Availability</TableHead>
                    <TableHead>Subjects</TableHead>
                    <TableHead>Languages</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRequests.map((request) => {
                    const fullName = `${request.profile.firstName} ${request.profile.lastName}`;
                    const initials = fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("");
                    return (
                      <TableRow
                        key={request.request_id}
                        className="hover:bg-gray-50"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              {/* <AvatarImage
                                src={request.profile.avatar || "/placeholder.svg"}
                              /> */}
                              <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-sm">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold">{fullName}</p>
                              <p className="text-sm text-gray-600">
                                {request.profile.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="capitalize gap-1 font-normal"
                          >
                            {request.type === "tutor" ? (
                              <GraduationCap className="h-3.5 w-3.5" />
                            ) : (
                              <Users className="h-3.5 w-3.5" />
                            )}
                            {request.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${getStatusColor(request.status || "pending")} font-semibold capitalize`}
                          >
                            {request.status || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${getPriorityColor(request.priority)} font-semibold`}
                          >
                            Priority {request.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-48">
                            {request.profile.availability
                              .slice(0, 2)
                              .map((time, index) => (
                                <Badge
                                  key={index}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {`${time.day}, ${to12Hour(time.startTime)} - ${to12Hour(time.endTime)}`}
                                </Badge>
                              ))}
                            {request.profile.availability.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{request.profile.availability.length - 2} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-48">
                            {request.profile.subjects_of_interest
                              .slice(0, 2)
                              .map((subject, index) => (
                                <Badge
                                  key={index}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {subject}
                                </Badge>
                              ))}
                            {request.profile.subjects_of_interest.length >
                              2 && (
                              <Badge variant="secondary" className="text-xs">
                                +
                                {request.profile.subjects_of_interest.length -
                                  2}{" "}
                                more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {request.profile.languages_spoken && (
                            <div className="flex flex-wrap gap-1 max-w-32">
                              {request.profile.languages_spoken
                                .slice(0, 2)
                                .map((language, index) => (
                                  <Badge
                                    key={index}
                                    variant="outline"
                                    className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                  >
                                    {language}
                                  </Badge>
                                ))}
                              {request.profile.languages_spoken.length > 2 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                >
                                  +{request.profile.languages_spoken.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Select
                              value={request.priority.toString()}
                              onValueChange={(value) =>
                                updatePriority(
                                  request.request_id,
                                  Number.parseInt(value),
                                )
                              }
                            >
                              <SelectTrigger className="w-16 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                              </SelectContent>
                            </Select>

                            <AlertDialog>
                              <AlertDialogTrigger>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>

                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Remove Pairing Request for{" "}
                                    {`${request.profile.firstName} ${request.profile.lastName}`}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription></AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Back</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      removeFromQueue(request.request_id)
                                    }
                                  >
                                    Remove Pairing Request
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Users className="h-12 w-12 text-gray-300" />
                  <p className="text-gray-500">No one in the pairing queue</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
