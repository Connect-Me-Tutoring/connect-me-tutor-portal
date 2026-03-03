"use client";
import { use, useEffect, useState } from "react";
import { getTutorSessions } from "@/lib/actions/tutor.actions";
import { getEvents } from "@/lib/actions/event.server.actions";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { getProfile } from "@/lib/actions/user.actions";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Session, Event, Enrollment } from "@/types";
import { addDays, subDays } from "date-fns";
import {
  getAllEventDetailsForTutor,
  getSessionHoursByStudent,
} from "@/lib/actions/hours.actions";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface EnrollmentDetails {
  studentId: string;
  firstName: string;
  lastName: string;
  hours: number;
}

interface EventDetails {
  eventId: string;
  date: any;
  hours: number;
  summary: string;
}

const Stats = ({
  enrollmentDetailsPromise,
  eventDetailsPromise,
}: {
  enrollmentDetailsPromise: Promise<EnrollmentDetails[]>;
  eventDetailsPromise: Promise<{ [key: string]: EventDetails[] }>;
}) => {
  const combinedPromise = Promise.all([
    enrollmentDetailsPromise,
    eventDetailsPromise,
  ]);
  const [enrollmentDetails, eventDetails] = use(combinedPromise);

  const [activeTab, setActiveTab] = useState("cards");
  const [expandedSections, setExpandedSections] = useState(
    new Set(["TUTORING"]),
  );

  const toggleSection = (section: any) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const tabs = [
    { id: "cards", label: "Card Layout" },
    { id: "unified", label: "Unified Table" },
  ];

  const totalSessionHours = Object.values(enrollmentDetails)
    .flat()
    .reduce((sum, e) => sum + e.hours, 0);
  const totalEventHours = Object.values(eventDetails)
    .flat()
    .reduce((sum, e) => sum + e.hours, 0);

  const totalAllHours = totalSessionHours + totalEventHours;

  return (
    <>
      <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 shadow-sm">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-blue-100 text-blue-700 hover:bg-gray-200"
                : " bg-white text-gray-600 hover:bg-gray-200"
            }
              `}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "unified" && (
        <Card>
          {" "}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.values(enrollmentDetails).map((student) => (
                <TableRow key={student.studentId}>
                  <TableCell>Sessions</TableCell>
                  <TableCell>Tutoring</TableCell>
                  <TableCell>
                    {student.firstName + " " + student.lastName}
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>{student.hours}</TableCell>
                </TableRow>
              ))}
              {Object.entries(eventDetails).map(([eventType, events]) =>
                events.map((event) => (
                  <TableRow key={`event-${event.eventId}`}>
                    <TableCell>Events</TableCell>
                    <TableCell>{eventType}</TableCell>
                    <TableCell>{event.summary}</TableCell>
                    <TableCell>{event.date}</TableCell>
                    <TableCell>{event.hours}</TableCell>
                  </TableRow>
                )),
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4}>Total</TableCell>
                <TableCell>{totalAllHours}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Card>
      )}

      {activeTab === "cards" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Hours Summary</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-[#1e40af]">
                  {totalSessionHours}
                </div>
                <div className="text-sm text-gray-600">Session Hours</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#1e40af]">
                  {totalEventHours}
                </div>
                <div className="text-sm text-gray-600">Event Hours</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#1e40af]">
                  {totalAllHours}
                </div>
                <div className="text-sm text-gray-600">Total Hours</div>
              </div>
            </div>
            <CardFooter></CardFooter>
          </Card>

          <div className="gap-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Students</CardTitle>
              </CardHeader>
              <Card className="m-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Student</TableHead>
                      <TableHead>Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(enrollmentDetails).map((student) => (
                      <TableRow key={student.studentId}>
                        <TableCell>
                          {student.firstName} {student.lastName}
                        </TableCell>
                        <TableCell>{student.hours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </Card>

            <Card className="my-6">
              <CardHeader>
                <CardTitle className="text-lg">Events</CardTitle>
              </CardHeader>
              {Object.entries(eventDetails).map(([eventType, events]) => (
                <Card key={eventType} className="m-4">
                  <CardHeader>
                    <CardTitle className="text-lg">{eventType}</CardTitle>
                  </CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Summary</TableHead>
                        <TableHead>Hours</TableHead>` `
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.eventId}>
                          <TableCell>{event.summary}</TableCell>
                          <TableCell>{event.hours}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              ))}
            </Card>
          </div>
        </div>
      )}

      {/* {loading ? (
        <div className="flex justify-center items-center h-40">
          <p>Loading Hours...</p>
        </div>
      ) : (
        <div className="flex space-x-6">
          <div className="flex-grow bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              {" "}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionHours.size === 0 && allEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4">
                        No tutoring hours or events recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {Array.from(sessionHours.entries()).map(
                        ([student, hours]) => (
                          <TableRow key={student}>
                            <TableCell>Session</TableCell>
                            <TableCell>{student}</TableCell>
                            <TableCell>{hours}</TableCell>
                          </TableRow>
                        )
                      )}
                      {allEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>Event</TableCell>
                          <TableCell>{event.summary}</TableCell>
                          <TableCell>{event.hours}</TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell>{totalHours}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              <Table>
                <TableCaption>Sessions</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollmentDetails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-4">
                        No student sessions recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    enrollmentDetails.map((enrollment) => (
                      <TableRow key={enrollment.studentId}>
                        <TableCell>
                          {enrollment.firstName} {enrollment.lastName}
                        </TableCell>
                        <TableCell>{enrollment.hours}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div>
              {Object.entries(eventDetails).map(([eventType, events]) => (
                <Table key={eventType}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.eventId}>
                        <TableCell>{eventType}</TableCell>
                        <TableCell>{event.summary}</TableCell>
                        <TableCell>{event.hours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ))}
            </div>
          </div>
        </div>
      )} */}
    </>
  );
};

export default Stats;
