import TutorEventHistory from "@/components/admin/TutorEventHistory";
import { requireAdmin } from "@/lib/actions/auth/authz.server";
import { getTutorEventHistory } from "@/lib/actions/event/server.actions";
import { isUuidString } from "@/lib/utils";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ tutorId: string }>;
}

export default async function TutorEventHistoryPage(props: Props) {
  const { tutorId } = await props.params;
  if (!isUuidString(tutorId)) notFound();

  try {
    await requireAdmin();
  } catch {
    notFound();
  }

  const history = await getTutorEventHistory(tutorId);
  if (!history) notFound();

  return (
    <main className="p-8 bg-gray-50 min-h-screen">
      <TutorEventHistory tutor={history.tutor} events={history.events} />
    </main>
  );
}
