import Link from "next/link";
import { notFound } from "next/navigation";
import { getEnrollmentSessionsActivityData } from "@/lib/actions/session.server.actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Video } from "lucide-react";

export default async function EnrollmentActivityPage({
  params,
}: {
  params: { enrollmentId: string };
}) {
  const data = await getEnrollmentSessionsActivityData(params.enrollmentId);
  if (!data) {
    notFound();
  }

  const { enrollment, sessions } = data;

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/enrollments">
            <ArrowLeft className="h-4 w-4 mr-2" />
            All enrollments
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Enrollment activity</h1>
        <p className="text-muted-foreground mt-1">
          Sessions for this enrollment and Zoom webhook activity counts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enrollment</CardTitle>
          <CardDescription>
            {enrollment.studentName} ↔ {enrollment.tutorName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-muted-foreground">Frequency</span>
            <Badge variant="secondary">{enrollment.frequency}</Badge>
            {enrollment.paused && (
              <Badge variant="destructive">Paused</Badge>
            )}
          </div>
          {enrollment.summary ? (
            <p>
              <span className="text-muted-foreground">Summary: </span>
              {enrollment.summary}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            Open a session to see normalized Zoom join/leave activity. Links
            include <code className="text-xs">enrollmentId</code> so the session
            view can show this enrollment breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No sessions linked to this enrollment yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Meeting</TableHead>
                  <TableHead className="text-right">Zoom logs</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">
                      {s.date
                        ? new Date(s.date).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {s.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{s.meetingTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.meetingId}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.zoomEventCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/dashboard/session/${s.id}/participation?enrollmentId=${enrollment.id}`}
                        >
                          <Video className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
