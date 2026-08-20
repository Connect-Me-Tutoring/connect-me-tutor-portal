"use client"; // This needs to be at the top to declare a client component

import React, { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { logoutUser } from "@/lib/actions/user/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/lib/contexts/profileContext";
import {
  Search,
  Link as LinkIcon,
  LogOut,
  Calendar,
  CalendarRange,
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
  Flag,
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
import { getUserProfiles, switchProfile } from "@/lib/actions/profile/server.actions";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function DashboardLayout({
  children,
  profile,
  userProfilesPromise,
}: {
  children: React.ReactNode;
  profile: Profile | null;
  userProfilesPromise: Promise<Partial<Profile>[]>;
}) {
  const t = useTranslations("common");
  // const [role, setRole] = useState<string | null>(null);
  const userProfiles: Partial<Profile>[] = use(userProfilesPromise) || [];

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

  useEffect(() => {
    if (!profile && !isSettingsPage) {
      router.replace("/dashboard/settings?completeProfile=1");
    }
  }, [isSettingsPage, profile, router]);

  const settingsSidebarItems = [
    {
      title: t("sidebar.profile"),
      href: "/dashboard/profile",
      icon: <CircleUserRound className="h-5 w-5" />,
    },
  ];

  const studentSidebarItems = [
    {
      title: t("nav.dashboard"),
      href: "/dashboard",
      icon: <LayoutDashboardIcon className="h-5 w-5" />,
    },
    {
      title: t("sidebar.announcements"),
      href: "/dashboard/announcements",
      icon: <BellPlus className="h-5 w-5" />,
    },
    {
      title: t("sidebar.chats"),
      href: "/dashboard/chats",
      icon: <MessageCircleIcon className="h-5 w-5" />,
    },
    {
      title: t("sidebar.pairings"),
      href: "/dashboard/pairings",
      icon: <LinkIcon className="h-5 w-5" />,
    },
    {
      title: t("sidebar.profile"),
      href: "/dashboard/profile",
      icon: <User className="h-5 w-5" />,
    },
  ];

  const tutorSidebarItems = [
    {
      title: t("nav.dashboard"),
      href: "/dashboard",
      icon: <LayoutDashboardIcon className="h-5 w-5" />,
    },
    {
      title: t("sidebar.announcements"),
      href: "/dashboard/announcements",
      icon: <BellPlus className="h-5 w-5" />,
    },
    {
      title: t("sidebar.myStudents"),
      href: "/dashboard/my-students",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: t("sidebar.myEnrollments"),
      href: "/dashboard/my-enrollments",
      icon: <BookOpenText className="h-5 w-5" />,
    },
    {
      title: t("sidebar.chats"),
      href: "/dashboard/chats",
      icon: <MessageCircleIcon className="h-5 w-5" />,
    },
    {
      title: t("sidebar.myHours"),
      href: "/dashboard/my-stats",
      icon: <TrendingUp className="h-5 w-5" />,
    },
    {
      title: t("sidebar.resources"),
      href: "/dashboard/resources",
      icon: <Layers className="h-5 w-5" />,
    },
    {
      title: t("sidebar.worksheets"),
      href: "/dashboard/worksheets",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: t("sidebar.pairings"),
      href: "/dashboard/pairings",
      icon: <LinkIcon className="h-5 w-5" />,
    },
    // {
    //   title: "AI Chatbot",
    //   href: "/dashboard/ai-chatbot",
    //   icon: <Sparkles className="h-5 w-5" />,
    // },
    {
      title: t("sidebar.profile"),
      href: "/dashboard/profile",
      icon: <User className="h-5 w-5" />,
    },
  ];

  const adminSidebarItems = [
    {
      title: t("nav.dashboard"),
      href: "/dashboard",
      icon: <LayoutDashboardIcon className="h-5 w-5" />,
    },

    {
      title: t("sidebar.notifications"),
      href: "/dashboard/notifications",
      icon: <Bell className="h-5 w-5" />,
    },
    {
      title: t("sidebar.schedule"),
      href: "/dashboard/schedule",
      icon: <Calendar className="h-5 w-5" />,
    },
    {
      title: t("sidebar.enrollments"),
      href: "/dashboard/enrollments",
      icon: <BookOpenText className="h-5 w-5" />,
    },
    {
      title: t("sidebar.meetingSchedule"),
      href: "/dashboard/hq-schedule",
      icon: <CalendarRange className="h-5 w-5" />,
    },
    {
      title: t("sidebar.hoursManager"),
      href: "/dashboard/hours-manager",
      icon: <Clock className="h-5 w-5" />,
    },
    {
      title: t("sidebar.allTutors"),
      href: "/dashboard/all-tutors",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: t("sidebar.allStudents"),
      href: "/dashboard/all-students",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: t("sidebar.emailManager"),
      href: "/dashboard/email-manager",
      icon: <Mail className="h-5 w-5" />,
    },
    {
      title: t("sidebar.pairingQueue"),
      href: "/dashboard/pairing-que",
      icon: <ListOrdered className="h-5 w-5" />,
    },
    {
      title: t("sidebar.announcements"),
      href: "/dashboard/announcements",
      icon: <BellPlus className="h-5 w-5" />,
    },
    {
      title: t("sidebar.conversations"),
      href: "/dashboard/admin-conversations",
      icon: <Book className="h-5 w-5" />,
    },
    {
      title: t("sidebar.analytics"),
      href: "/dashboard/data-analytics",
      icon: <ChartColumn className="h-5 w-5" />,
    },
    // {
    //   title: "Migrate Profiles",
    //   href: "/dashboard/migrate",
    //   icon: <CirclePlus className="h-5 w-5" />,
    // },
  ];

  const [isOpen, setIsOpen] = useState(true);
  const toggleSidebar = () => setIsOpen(!isOpen);

  const handleLogout = async () => {
    await logoutUser();
    toast.success(t("toasts.logoutSuccess"));
    window.location.href = "/";
  };

  const handleSwitchProfile = async (newProfileId: string) => {
    try {
      if (profile) {
        await Promise.all([switchProfile(profile?.userId, newProfileId)]);
        router.refresh();
        toast.success(t("toasts.switchProfileSuccess"));
      }
    } catch (error) {
      toast.error(t("toasts.switchProfileError"));
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

  if (!profile && !isSettingsPage) {
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
            isOpen ? "w-56" : "w-16",
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
                {isOpen && <span className="font-bold text-lg ml-2">Connect Me</span>}
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
                        {t("sidebar.manageAccountSettings")}
                      </p>
                    </div>
                  </div>
                )}

                {isOpen ? (
                  <Breadcrumb className="p-4">
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">{t("nav.dashboard")}</BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{t("nav.settings")}</BreadcrumbPage>
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
                          className={cn("w-full justify-start", !isOpen && "justify-center px-2")}
                        >
                          <Link href="/dashboard/">
                            <LayoutDashboardIcon className="h-5 w-5" />
                            {isOpen && <span className="ml-3">{t("nav.dashboard")}</span>}
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      {!isOpen && (
                        <TooltipContent side="right">
                          <p>{t("nav.dashboard")}</p>
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
                              !isOpen && "justify-center px-2",
                            )}
                          >
                            <Link href={item.href}>
                              {item.icon}
                              {isOpen && <span className="ml-3">{item.title}</span>}
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
            {!isSettingsPage && profile && (
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
                              !isOpen && "justify-center px-2",
                            )}
                          >
                            <Link href={item.href}>
                              {item.icon}
                              {isOpen && <span className="ml-3">{item.title}</span>}
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
                              !isOpen && "justify-center px-2",
                            )}
                          >
                            <Link href={item.href}>
                              {item.icon}
                              {isOpen && <span className="ml-3">{item.title}</span>}
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
                              !isOpen && "justify-center px-2",
                            )}
                          >
                            <Link href={item.href}>
                              {item.icon}
                              {isOpen && <span className="ml-3">{item.title}</span>}
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    className={cn("w-full justify-start", !isOpen && "justify-center px-2")}
                  >
                    <a
                      href="https://docs.google.com/forms/d/e/1FAIpQLSdWtwkfILDsd6o6skBhUoeEa0SprHxk4-B1ZjRpa3zPPiwTzw/viewform?usp=sharing"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Flag className="h-5 w-5" />
                      {isOpen && <span className="ml-3">{t("nav.reportIssue")}</span>}
                    </a>
                  </Button>
                </TooltipTrigger>
                {!isOpen && (
                  <TooltipContent side="right">
                    <p>{t("nav.reportIssue")}</p>
                  </TooltipContent>
                )}
              </Tooltip>

              {!isSettingsPage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="ghost"
                      className={cn("w-full justify-start", !isOpen && "justify-center px-2")}
                    >
                      <Link href="/dashboard/settings">
                        <Settings className="h-5 w-5" />
                        {isOpen && <span className="ml-3">{t("nav.settings")}</span>}
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  {!isOpen && (
                    <TooltipContent side="right">
                      <p>{t("nav.settings")}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    asChild
                    variant="ghost"
                    className={cn("w-full justify-start", !isOpen && "justify-center px-2")}
                  >
                    <a
                      href="https://docs.google.com/document/d/1Tzc0JA90Ghy76UdBPCRFrUcT27jOxTvqh4yxq1_xVXY/edit?tab=t.0#heading=h.kk1966kbedef"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <HelpCircleIcon className="h-5 w-5" />
                      {isOpen && <span className="ml-3">{t("nav.tutorPortalManual")}</span>}
                    </a>
                  </Button>
                </TooltipTrigger>
                {!isOpen && (
                  <TooltipContent side="right">
                    <p>{t("nav.tutorPortalManual")}</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn("w-full justify-start", !isOpen && "justify-center px-2")}
                    onClick={handleLogout}
                  >
                    <LogOut className="h-5 w-5" />
                    {isOpen && <span className="ml-3">{t("nav.logout")}</span>}
                  </Button>
                </TooltipTrigger>
                {!isOpen && (
                  <TooltipContent side="right">
                    <p>{t("nav.logout")}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </div>
        </aside>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex sm:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />

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
                {profile &&
                  (profile.role === "Student"
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
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdWtwkfILDsd6o6skBhUoeEa0SprHxk4-B1ZjRpa3zPPiwTzw/viewform?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted text-primary-dark"
                >
                  <Flag className="h-5 w-5" />
                  <span>{t("nav.reportIssue")}</span>
                </a>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-md hover:bg-muted text-primary-dark",
                    pathname === "/dashboard/settings" && "bg-blue-400/10 text-blue-500",
                  )}
                >
                  <Settings className="h-5 w-5" />
                  <span>{t("nav.settings")}</span>
                </Link>
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
                <LanguageSwitcher />
                {profile ? (
                  <Select onValueChange={handleSwitchProfile}>
                    <SelectTrigger className="space-x-2 z-50">
                      <User className="w-4 h-4" />
                      <span className="font-semibold">
                        {profile.firstName} {profile.lastName}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {userProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id || ""}>
                          {p.firstName} {p.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
                    <User className="w-4 h-4" />
                    <span>{t("sidebar.completeYourAccount")}</span>
                  </div>
                )}
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
