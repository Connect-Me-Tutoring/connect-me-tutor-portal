import { Inter } from "next/font/google";

import { redirect } from "next/navigation";

import { cachedGetUser } from "@/lib/actions/user.server.actions";
import { cachedGetProfile } from "@/lib/actions/cache";
import { getStudentSessions } from "@/lib/actions/session.server.actions";
import { endOfWeek, startOfWeek } from "date-fns";
import { getMeetings } from "@/lib/actions/meeting.server.actions";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Dashboard | ConnectMe",
  description: "Instructors can create courses here",
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
