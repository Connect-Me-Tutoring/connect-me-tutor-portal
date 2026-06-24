import { Inter } from "next/font/google";

import { redirect } from "next/navigation";

import { getSessionUserProfile } from "@/lib/actions/user.actions";
const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Dashboard | Connect Me",
  description: "Instructors can create courses here",
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // const data = await getSessionUserProfile();

  // const role = data?.role;

  /*if (role === "Tutor") {
    return redirect("/dashboard");
  }*/

  return <>{children}</>;
}
