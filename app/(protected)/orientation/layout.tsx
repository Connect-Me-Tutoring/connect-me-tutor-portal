import { Inter } from "next/font/google";
import { cachedGetUser } from "@/lib/actions/user/server.actions";
import { redirect } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Orientation | Connect Me",
  description: "Complete your orientation to access the tutor portal",
};

export const dynamic = "force-dynamic";

export default async function OrientationLayout({ children }: { children: React.ReactNode }) {
  // Ensure user is logged in
  const user = await cachedGetUser().catch(() => {
    redirect("/");
  });
  if (!user) redirect("/");

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 ${inter.className}`}
    >
      {children}
    </div>
  );
}
