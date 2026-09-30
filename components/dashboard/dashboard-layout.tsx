"use client"; // This needs to be at the top to declare a client component

import React, { use, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { logoutUser } from "@/lib/actions/user/client.actions";
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
  GraduationCap,
  Ticket,
  LifeBuoy,
  ChevronDown,
  MoreHorizontal,
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
import { isTutorNavigationRestricted } from "@/lib/orientation/navigation";
import ReportIssueDialog from "@/components/dashboard/ReportIssueDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DashboardLayout({
  children,
  orientationEnabled,
  profile,
  userProfilesPromise,
}: {
  children: React.ReactNode;
  orientationEnabled: boolean;
  profile: Profile | null;
  userProfilesPromise: Promise<Partial<Profile>[]>;
}) {
  // const [role, setRole] = useState<string | null>(null);
  const userProfiles: Partial<Profile>[] = use(userProfilesPromise) || [];

  const [loading, setLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  // const [profile, setProfile] = useState<{
  //   firstName: string;
  //   lastName: string;
  // } | null>(null); // For displaying profile data

  // const [userProfiles, setUserProfiles] = useState<Partial<Profile>[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const isSettingsPage = pathname === "/dashboard/settings";
  const orientationNavigationRestricted = isTutorNavigationRestricted(
    orientationEnabled,
    profile?.role,
    profile?.orientationCompletedAt,
  );

  useEffect(() => {
    if (!profile && !isSettingsPage) {
      router.replace("/dashboard/settings?completeProfile=1");
    }
  }, [isSettingsPage, profile, router]);

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

  const tutorOrientationSidebarItem = {
    title: "Orientation",
    href: "/orientation",
    icon: <GraduationCap className="h-5 w-5" />,
  };

  const tutorSidebarItems = orientationNavigationRestricted
    ? [tutorOrientationSidebarItem]
    : [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: <LayoutDashboardIcon className="h-5 w-5" />,
        },
        ...(orientationEnabled ? [tutorOrientationSidebarItem] : []),
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

  type SidebarItem = { title: string; href: string; icon: React.ReactNode };

  const adminTopItems: SidebarItem[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboardIcon className="h-5 w-5" />,
    },
  ];

  const adminSidebarGroups: { title: string; items: SidebarItem[] }[] = [
    {
      title: "Scheduling",
      items: [
        { title: "Schedule", href: "/dashboard/schedule", icon: <Calendar className="h-5 w-5" /> },
        {
          title: "Enrollments",
          href: "/dashboard/enrollments",
          icon: <BookOpenText className="h-5 w-5" />,
        },
        {
          title: "Meeting Schedule",
          href: "/dashboard/hq-schedule",
          icon: <CalendarRange className="h-5 w-5" />,
        },
        {
          title: "Hours Manager",
          href: "/dashboard/hours-manager",
          icon: <Clock className="h-5 w-5" />,
        },
      ],
    },
    {
      title: "People",
      items: [
        { title: "All Tutors", href: "/dashboard/all-tutors", icon: <Users className="h-5 w-5" /> },
        ...(orientationEnabled
          ? [
              {
                title: "Tutor Orientation",
                href: "/orientation",
                icon: <GraduationCap className="h-5 w-5" />,
              },
            ]
          : []),
        {
          title: "All Students",
          href: "/dashboard/all-students",
          icon: <Users className="h-5 w-5" />,
        },
        {
          title: "Pairing Queue",
          href: "/dashboard/pairing-que",
          icon: <ListOrdered className="h-5 w-5" />,
        },
      ],
    },
    {
      title: "Communication",
      items: [
        {
          title: "Email Manager",
          href: "/dashboard/email-manager",
          icon: <Mail className="h-5 w-5" />,
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
        { title: "Tickets", href: "/dashboard/tickets", icon: <Ticket className="h-5 w-5" /> },
      ],
    },
    {
      title: "Insights",
      items: [
        {
          title: "Analytics",
          href: "/dashboard/data-analytics",
          icon: <ChartColumn className="h-5 w-5" />,
        },
      ],
    },
  ];

  const [isOpen, setIsOpen] = useState(true);
  const toggleSidebar = () => setIsOpen(!isOpen);

  // A group starts expanded when it contains the current page; after that the
  // admin's own toggles win.
  const activeAdminGroup = adminSidebarGroups.find((group) =>
    group.items.some((item) => item.href === pathname),
  )?.title;
  const [openAdminGroups, setOpenAdminGroups] = useState<Record<string, boolean>>({});
  const isAdminGroupOpen = (title: string) => openAdminGroups[title] ?? title === activeAdminGroup;
  const toggleAdminGroup = (title: string) =>
    setOpenAdminGroups((current) => ({ ...current, [title]: !isAdminGroupOpen(title) }));

  const renderMobileNavItem = (item: SidebarItem) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setMobileOpen(false)}
      className={cn(
        "flex items-center gap-3 p-2 rounded-md hover:bg-muted",
        pathname === item.href && "bg-blue-400/10 text-blue-500",
      )}
    >
      {item.icon}
      <span>{item.title}</span>
    </Link>
  );

  const renderNavItem = (item: SidebarItem) => (
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
  );

  const handleLogout = async () => {
    await logoutUser();
    toast.success("Successfully logging out");
    window.location.href = "/";
  };

  const handleSwitchProfile = async (newProfileId: string) => {
    try {
      if (profile) {
        await Promise.all([switchProfile(profile?.userId, newProfileId)]);
        router.refresh();
        toast.success("Switched Profile");
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
                href={orientationNavigationRestricted ? "/orientation" : "/dashboard"}
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
                        Manage your account settings and preferences.
                      </p>
                    </div>
                  </div>
                )}

                {isOpen ? (
                  <Breadcrumb className="p-4">
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
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
                          className={cn("w-full justify-start", !isOpen && "justify-center px-2")}
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
              <nav className="flex-grow space-y-1 px-3 overflow-y-auto">
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
                    {adminTopItems.map(renderNavItem)}
                    {adminSidebarGroups.map((group) =>
                      isOpen ? (
                        <div key={group.title} className="pt-2">
                          <button
                            type="button"
                            onClick={() => toggleAdminGroup(group.title)}
                            aria-expanded={isAdminGroupOpen(group.title)}
                            className="flex w-full items-center justify-between rounded-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                          >
                            {group.title}
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                !isAdminGroupOpen(group.title) && "-rotate-90",
                              )}
                            />
                          </button>
                          {isAdminGroupOpen(group.title) && (
                            <div className="mt-1 space-y-1">{group.items.map(renderNavItem)}</div>
                          )}
                        </div>
                      ) : (
                        <div key={group.title} className="space-y-1 border-t pt-1">
                          {group.items.map(renderNavItem)}
                        </div>
                      ),
                    )}
                  </>
                )}
              </nav>
            )}

            {/* Account menu: Settings, then help (Manual, Get Help), then Logout */}
            <div className="px-3 mb-2 border-t pt-2">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full h-auto py-2 justify-start",
                      !isOpen && "justify-center px-2",
                    )}
                    aria-label="Account menu"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-400/10 text-sm font-semibold text-blue-500">
                      {profile?.firstName?.[0]?.toUpperCase() ?? <User className="h-4 w-4" />}
                    </span>
                    {isOpen && (
                      <>
                        <span className="ml-3 flex min-w-0 flex-col items-start text-left">
                          <span className="truncate text-sm font-medium">
                            {profile ? `${profile.firstName} ${profile.lastName}` : "Account"}
                          </span>
                          {profile && (
                            <span className="text-xs text-muted-foreground">{profile.role}</span>
                          )}
                        </span>
                        <MoreHorizontal className="ml-auto h-4 w-4 text-muted-foreground" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side={isOpen ? "top" : "right"} align="start" className="w-56">
                  {!isSettingsPage && !orientationNavigationRestricted && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/settings">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {/* The manual is written for tutors; students shouldn't see it. */}
                  {profile && profile.role !== "Student" && (
                    <DropdownMenuItem asChild>
                      <a
                        href="https://docs.google.com/document/d/1Tzc0JA90Ghy76UdBPCRFrUcT27jOxTvqh4yxq1_xVXY/edit?tab=t.0#heading=h.kk1966kbedef"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <HelpCircleIcon className="mr-2 h-4 w-4" />
                        Tutor Portal Manual
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => setReportIssueOpen(true)}>
                    <LifeBuoy className="mr-2 h-4 w-4" />
                    Get Help
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex sm:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />

            <div className="relative w-64 bg-card h-full p-6 z-50 overflow-y-auto">
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
                  (profile.role === "Admin"
                    ? [
                        ...adminTopItems.map(renderMobileNavItem),
                        ...adminSidebarGroups.map((group) => (
                          <div key={group.title} className="space-y-2 pt-2">
                            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {group.title}
                            </p>
                            {group.items.map(renderMobileNavItem)}
                          </div>
                        )),
                      ]
                    : (profile.role === "Student" ? studentSidebarItems : tutorSidebarItems).map(
                        renderMobileNavItem,
                      ))}
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    setReportIssueOpen(true);
                  }}
                  className="flex w-full items-center gap-3 p-2 rounded-md hover:bg-muted text-primary-dark"
                >
                  <LifeBuoy className="h-5 w-5" />
                  <span>Get Help</span>
                </button>
                {!orientationNavigationRestricted && (
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-md hover:bg-muted text-primary-dark",
                      pathname === "/dashboard/settings" && "bg-blue-400/10 text-blue-500",
                    )}
                  >
                    <Settings className="h-5 w-5" />
                    <span>Settings</span>
                  </Link>
                )}
              </nav>
            </div>
          </div>
        )}
        <ReportIssueDialog open={reportIssueOpen} onOpenChange={setReportIssueOpen} />
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
                    <span>Complete your account</span>
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
