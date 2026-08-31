import { Inter } from "next/font/google";

import { redirect } from "next/navigation";

import { getSessionUserProfile } from "@/lib/actions/user/client.actions";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Dashboard | Connect Me",
  description: "Instructors can create courses here",
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
