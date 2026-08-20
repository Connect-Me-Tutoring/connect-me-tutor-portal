import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getEnrollmentSessionsActivityData } from "@/lib/actions/session/server.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function EnrollmentActivityPage(props: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const params = await props.params;
  const t = await getTranslations("adminEnrollments.activity");
  const tFrequency = await getTranslations("adminEnrollments.frequency");
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
            {t("backToEnrollments")}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">{t("heading")}</h1>
        <p className="text-muted-foreground mt-1">{t("description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("enrollmentCard.title")}</CardTitle>
          <CardDescription>
            {enrollment.studentName} ↔ {enrollment.tutorName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-muted-foreground">{t("enrollmentCard.frequencyLabel")}</span>
            <Badge variant="secondary">
              {enrollment.frequency === "biweekly" ? tFrequency("biweekly") : tFrequency("weekly")}
            </Badge>
            {enrollment.paused && (
              <Badge variant="destructive">{t("enrollmentCard.paused")}</Badge>
            )}
          </div>
          {enrollment.summary ? (
            <p>
              <span className="text-muted-foreground">{t("enrollmentCard.summaryLabel")} </span>
              {enrollment.summary}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sessionsCard.title")}</CardTitle>
          <CardDescription>
            {t("sessionsCard.descriptionPrefix")}{" "}
            <code className="text-xs">enrollmentId</code>{" "}
            {t("sessionsCard.descriptionSuffix")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("sessionsCard.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sessionsCard.columns.when")}</TableHead>
                  <TableHead>{t("sessionsCard.columns.status")}</TableHead>
                  <TableHead>{t("sessionsCard.columns.meeting")}</TableHead>
                  <TableHead className="text-right">{t("sessionsCard.columns.zoomLogs")}</TableHead>
                  <TableHead className="text-right">{t("sessionsCard.columns.attendance")}</TableHead>
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
                      <div className="text-xs text-muted-foreground">{s.meetingId}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{s.zoomEventCount}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={`/dashboard/session/${s.id}/participation?enrollmentId=${enrollment.id}`}
                        >
                          <Video className="h-4 w-4 mr-1" />
                          {t("sessionsCard.view")}
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
