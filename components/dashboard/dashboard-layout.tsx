"use client"; // This needs to be at the top to declare a client component

import React, { use, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  logoutUser,
} from "@/lib/actions/user.actions";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/contexts/profileContext";
import {
  Search,
  Link as LinkIcon,
  LogOut,
  Calendar,
  Bell,
  Home,
  CirclePlus,
  Settings,
  Compass,
  HelpCircleIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon, // Added this icon for reopening sidebar,
  Users,
  TrendingUp,
  Bookmark,
  LayoutDashboardIcon,
  Layers,
  User,
  Clock,
  ChevronLeft,
  UserIcon,
  BookOpenText,
  CircleUserRound,
  Mail,
  MessageCircleIcon,
  ListOrdered,
  BellIcon,
  BellPlus,
  Book,
  ChartColumn,
  FileSpreadsheet,
  FileText,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Logo from "@/components/ui/logo";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { cn } from "@/lib/utils";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider, // Import TooltipProvider
} from "@/components/ui/tooltip";
import { toast, Toaster } from "react-hot-toast";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { Profile } from "@/types";
import {
  getUserProfiles,
  switchProfile,
} from "@/lib/actions/profile.server.actions";

export default function DashboardLayout({
  children,
  profile,
  userProfilesPromise,
}: {
  children: React.ReactNode;
  profile: Profile;
  userProfilesPromise: Promise<Partial<Profile>[]>;
}) {
  // const [role, setRole] = useState<string | null>(null);
  const userProfiles: Partial<Profile>[] = use(userProfilesPromise) || []

  const [loading, setLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // const [profile, setProfile] = useState<{
  //   firstName: string;
  //   lastName: string;
  // } | null>(null); // For displaying profile data

  // const [userProfiles, setUserProfiles] = useState<Partial<Profile>[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const isSettingsPage = pathname === "/dashboard/settings";

  const settingsSidebarItems = [
    {
      title: "Profile",
      href: "/dashboard/profile",
      icon: <CircleUserRound className="h-5 w-5" />,
    },
  ];

  const studentSidebarItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboardIcon className="h-5 w-5" />,
    },
    {
      title: "Announcements",
      href: "/dashboard/announcements",
      icon: <BellPlus className="h-5 w-5" />,
    },
    {
      title: "Chats",
      href: "/dashboard/chats",
      icon: <MessageCircleIcon className="h-5 w-5" />,
    },
    {
      title: "Pairings",
      href: "/dashboard/pairings",
      icon: <LinkIcon className="h-5 w-5" />,
    },
    {
      title: "Profile",
      href: "/dashboard/profile",
      icon: <User className="h-5 w-5" />,
    },
  ];

  const tutorSidebarItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboardIcon className="h-5 w-5" />,
    },
    {
      title: "Announcements",
      href: "/dashboard/announcements",
      icon: <BellPlus className="h-5 w-5" />,
    },
    {
      title: "My Students",
      href: "/dashboard/my-students",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "My Enrollments",
      href: "/dashboard/my-enrollments",
      icon: <BookOpenText className="h-5 w-5" />,
    },
    {
      title: "Chats",
      href: "/dashboard/chats",
      icon: <MessageCircleIcon className="h-5 w-5" />,
    },
    {
      title: "My Hours",
      href: "/dashboard/my-stats",
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      title: "Resources",
      href: "/dashboard/resources",
      icon: <Layers className="h-5 w-5" />,
    },
    {
      title: "Worksheets",
      href: "/dashboard/worksheets",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: "Pairings",
      href: "/dashboard/pairings",
      icon: <LinkIcon className="h-5 w-5" />,
    },
    // {
    //   title: "AI Chatbot",
    //   href: "/dashboard/ai-chatbot",
    //   icon: <Sparkles className="h-5 w-5" />,
    // },
    {
      title: "Profile",
      href: "/dashboard/profile",
      icon: <User className="h-5 w-5" />,
    },
  ];

  const adminSidebarItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboardIcon className="h-5 w-5" />,
    },

    {
      title: "Notifications",
      href: "/dashboard/notifications",
      icon: <Bell className="h-5 w-5" />,
    },
    {
      title: "Schedule",
      href: "/dashboard/schedule",
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      title: "Enrollments",
      href: "/dashboard/enrollments",
      icon: <BookOpenText className="h-5 w-5" />,
    },
    {
      title: "Hours Manager",
      href: "/dashboard/hours-manager",
      icon: <Clock className="h-5 w-5" />,
    },
    {
      title: "All Tutors",
      href: "/dashboard/all-tutors",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "All Students",
      href: "/dashboard/all-students",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Email Manager",
      href: "/dashboard/email-manager",
      icon: <Mail className="h-5 w-5" />,
    },
    {
      title: "Pairing Queue",
      href: "/dashboard/pairing-que",
      icon: <ListOrdered className="h-5 w-5" />,
    },
    {
      title: "Announcements",
      href: "/dashboard/announcements",
      icon: <BellPlus className="h-5 w-5" />,
    },
    {
      title: "Conversations",
      href: "/dashboard/admin-conversations",
      icon: <Book className="h-5 w-5" />,
    },
    {
      title: "Analytics",
      href: "/dashboard/data-analytics",
      icon: <ChartColumn className="h-5 w-5" />,
    },
    // {
    //   title: "Migrate Profiles",
    //   href: "/dashboard/migrate",
    //   icon: <CirclePlus className="h-5 w-5" />,
    // },
  ];

  // useEffect(() => {
  //   const getUserProfileRole = async () => {
  //     try {
  //       if (profile) {
  //         const userProfiles = await getUserProfiles(profile.userId)
  //         if (userProfiles) setUserProfiles(userProfiles);
  //       }
  //     } catch (error) {
  //       console.error("Error fetching user role:", error);
  //     } finally {
  //       setLoading(false);
  //     }
  //   };
  //   getUserProfileRole();
  // }, [profile]);

  const [isOpen, setIsOpen] = useState(true);
  const toggleSidebar = () => setIsOpen(!isOpen);

  const handleLogout = async () => {
    await logoutUser();
    toast.success("Successfully logging out");
    window.location.href = "/";
  };

  const handleSwitchProfile = async (newProfileId: string) => {
    try {
      if (profile) {
        await Promise.all([
          switchProfile(profile?.userId, newProfileId),
        ]);
        router.refresh()
        toast.success("Switched Profile")
      }
    } catch (error) {
      toast.error("Unable to switch profiles");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <section className="grid grid-cols-[1fr_4fr] gap-10 m-10">
        <Skeleton className="h-[800px] w-full rounded-lg" />
        <Skeleton className="h-[800px] w-full rounded-lg" />
      </section>
    );
  }


  if (!profile) {
    router.push("/")
    return null;
  }

  // Layout with Sidebar and Navbar
  return (
    <div className="flex h-screen ">
      <TooltipProvider>
        {" "}
        {/* Wrap with TooltipProvider */}
        {/* Sidebar container */}
        <aside
          className={cn(
            "hidden sm:flex flex-col h-full bg-card z-30 transition-all duration-300 ease-in-out",
            isOpen ? "w-56" : "w-16"
          )}
        >
          <div className="flex flex-col h-full relative">
            {/* Logo */}
            <div className="h-16 p-4 flex items-center">
              <Link
                href="/dashboard"
                className="flex items-center px-1 text-sm font-medium rounded-md transition-colors"
              >
                <div className="text-white p-1 rounded">
                  {/* <Compass size={18} /> */}
                  <Image alt="logo" height="30" width="30" src="/logo.png" />
                </div>
                {isOpen && (
                  <span className="font-bold text-lg ml-2">Connect Me</span>
                )}
              </Link>
            </div>
            {/* Close button (shown when sidebar is open) */}
            {isOpen && (
              <Button
                onClick={toggleSidebar}
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3"
              >
                <PanelLeftCloseIcon className="h-4 w-4" />
              </Button>
            )}

            {/* Navigation */}
            {isSettingsPage && (
              <>
                {isOpen && (
                  <div className="px-4 py-2">
                    <div className="relative">
                      <p className="text-sm text-gray-500">
                        Manage your account settings and preferences.
                      </p>
                    </div>
                  </div>
                )}

                {isOpen ? (
                  <Breadcrumb className="p-4">
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">
                          Dashboard
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>Settings</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                ) : (
                  <div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          asChild
                          variant="ghost"
                          className={cn(
                            "w-full justify-start",
                            !isOpen && "justify-center px-2"
                          )}
                        >
                          <Link href="/dashboard/">
                            <LayoutDashboardIcon className="h-5 w-5" />
                            {isOpen && <span className="ml-3">Dashboard</span>}
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      {!isOpen && (
                        <TooltipContent side="right">
                          <p>Dashboard</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                )}

                <nav className="flex-grow space-y-1 ">
                  <>
                    {settingsSidebarItems.map((item) => (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          <Button
                            asChild
                            variant="ghost"
                            className={cn(
                              "w-full justify-start",
                              pathname === item.href
                                ? "bg-blue-400/10 text-blue-500"
                                : "text-primary-dark hover:bg-muted hover:text-foreground",
                              !isOpen && "justify-center px-2"
                            )}
                          >
                            <Link href={item.href}>
                              {item.icon}
                              {isOpen && (
                                <span className="ml-3">{item.title}</span>
                              )}
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        {!isOpen && (
                          <TooltipContent side="right">
                            <p>{item.title}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </>
                </nav>
              </>
            )}

            {/* Navigation */}
            {!isSettingsPage && (
              <nav className="flex-grow space-y-1 px-3">
                {profile.role === "Student" && (
                  <>
                    {studentSidebarItems.map((item) => (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          <Button
                            asChild
                            variant="ghost"
                            className={cn(
                              "w-full justify-start",
                              pathname === item.href
                                ? "bg-blue-400/10 text-blue-500"
                                : "text-primary-dark hover:bg-muted hover:text-foreground",
                              !isOpen && "justify-center px-2"
                            )}
                          >
                            <Link href={item.href}>
                              {item.icon}
                              {isOpen && (
                                <span className="ml-3">{item.title}</span>
                              )}
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        {!isOpen && (
                          <TooltipContent side="right">
                            <p>{item.title}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </>
                )}

                {/* Tutor Role Navigation */}
                {profile.role === "Tutor" && (
                  <>
                    {tutorSidebarItems.map((item) => (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          <Button
                            asChild
                            variant="ghost"
                            className={cn(
                              "w-full justify-start",
                              pathname === item.href
                                ? "bg-blue-400/10 text-blue-500"
                                : "text-primary-dark hover:bg-muted hover:text-foreground",
                              !isOpen && "justify-center px-2"
                            )}
                          >
                            <Link href={item.href}>
                              {item.icon}
                              {isOpen && (
                                <span className="ml-3">{item.title}</span>
                              )}
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        {!isOpen && (
                          <TooltipContent side="right">
                            <p>{item.title}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </>
                )}

                {/* Admin Role Navigation */}
                {profile.role === "Admin" && (
                  <>
                    {adminSidebarItems.map((item) => (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          <Button
                            asChild
                            variant="ghost"
                            className={cn(
                              "w-full justify-start",
                              pathname === item.href
                                ? "bg-blue-400/10 text-blue-500"
                                : "text-primary-dark hover:bg-muted hover:text-foreground",
                              !isOpen && "justify-center px-2"
                            )}
                          >
                            <Link href={item.href}>
                              {item.icon}
                              {isOpen && (
                                <span className="ml-3">{item.title}</span>
                              )}
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        {!isOpen && (
                          <TooltipContent side="right">
                            <p>{item.title}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </>
                )}
              </nav>
            )}

            {/* Settings and Logout */}
            <div className="px-3 space-y-2 mb-2">
              {!isSettingsPage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="ghost"
                      className={cn(
                        "w-full justify-start",
                        !isOpen && "justify-center px-2"
                      )}
                    >
                      <Link href="/dashboard/settings">
                        <Settings className="h-5 w-5" />
                        {isOpen && <span className="ml-3">Settings</span>}
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  {!isOpen && (
                    <TooltipContent side="right">
                      <p>Settings</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    className={cn(
                      "w-full justify-start",
                      !isOpen && "justify-center px-2"
                    )}
                  >
                    <a
                      href="https://docs.google.com/document/d/1Tzc0JA90Ghy76UdBPCRFrUcT27jOxTvqh4yxq1_xVXY/edit?tab=t.0#heading=h.kk1966kbedef"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <HelpCircleIcon className="h-5 w-5" />
                      {isOpen && <span className="ml-3">Tutor Portal Manual</span>}
                    </a>
                  </Button>
                </TooltipTrigger>
                {!isOpen && (
                  <TooltipContent side="right">
                    <p>Tutor Portal Manual</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start",
                      !isOpen && "justify-center px-2"
                    )}
                    onClick={handleLogout}
                  >
                    <LogOut className="h-5 w-5" />
                    {isOpen && <span className="ml-3">Logout</span>}
                  </Button>
                </TooltipTrigger>
                {!isOpen && (
                  <TooltipContent side="right">
                    <p>Logout</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        </aside>
       {mobileOpen && (
  <div className="fixed inset-0 z-50 flex sm:hidden">
    <div
      className="fixed inset-0 bg-black/50"
      onClick={() => setMobileOpen(false)}
    />

    <div className="relative w-64 bg-card h-full p-6 z-50">
      <Button
        onClick={() => setMobileOpen(false)}
        variant="ghost"
        size="icon"
        className="mb-4"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <nav className="space-y-2">
        {(profile.role === "Student"
          ? studentSidebarItems
          : profile.role === "Tutor"
          ? tutorSidebarItems
          : adminSidebarItems
        ).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 p-2 rounded:bg-muted"
          >
            {item.icon}
            <span>{item.title}</span>
          </Link>
        ))}
      </nav>
    </div>
  </div>
)}
      </TooltipProvider>

      <div className="flex-1 overflow-auto">
        {/* Navbar */}
        <header className="bg-background w-full h-16">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center space-x-8">
              <Button
                onClick={() => setMobileOpen(true)}
                variant="ghost"
                size="icon"
                className="sm:hidden"
              >
                <PanelLeftOpenIcon className="h-5 w-5" />
              </Button>
              {!isOpen && (
                <Button onClick={toggleSidebar} variant="ghost" size="icon">
                  <PanelLeftOpenIcon className="h-4 w-4" />
                </Button>
              )}
              <div className="flex items-center space-x-2 absolute tpo-4 right-8">
                <Select onValueChange={handleSwitchProfile}>
                  <SelectTrigger className="space-x-2 z-50">
                    {/* <span className=""> */}
                    <User className="w-4 h-4" />
                    <span className="font-semibold">
                      {profile?.firstName} {profile?.lastName}
                    </span>
                    {/* </span> */}
                  </SelectTrigger>
                  <SelectContent>
                    {userProfiles.map((profile) => (
                      <SelectItem key = {profile.id} value={profile.id || ""}>
                        {profile.firstName} {profile.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </header>

        {/* Main content based on role */}
        <main className="border-2 border-gray-200 rounded-2xl">{children}</main>
      </div>

      <Toaster />
    </div>
  );
}
