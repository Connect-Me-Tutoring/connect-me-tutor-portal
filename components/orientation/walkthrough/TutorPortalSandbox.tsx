"use client";

import {
  BellPlus,
  BookOpen,
  BookOpenText,
  Calendar,
  CalendarX,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Ellipsis,
  FileText,
  Flag,
  GraduationCap,
  HelpCircle,
  Languages,
  Layers,
  LayoutDashboardIcon,
  Link as LinkIcon,
  LogOut,
  MessageCircleIcon,
  PanelLeftCloseIcon,
  Plus,
  Settings,
  TrendingUp,
  User,
  UserRoundPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { STATUS, type Step, useJoyride } from "react-joyride";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SandboxView = "dashboard" | "students" | "profile" | "resources" | "hours";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { key: "orientation", label: "Orientation", icon: GraduationCap },
  { key: "announcements", label: "Announcements", icon: BellPlus },
  { key: "students", label: "My Students", icon: Users },
  { key: "enrollments", label: "My Enrollments", icon: BookOpenText },
  { key: "chats", label: "Chats", icon: MessageCircleIcon },
  { key: "hours", label: "My Hours", icon: TrendingUp },
  { key: "resources", label: "Resources", icon: Layers },
  { key: "worksheets", label: "Worksheets", icon: FileText },
  { key: "pairings", label: "Pairings", icon: LinkIcon },
  { key: "profile", label: "Profile", icon: User },
] as const;

const CLICK_STEP_BUTTONS: Step["buttons"] = ["back"];
const INTERACTIVE_TARGETS: Record<string, string> = {
  "open-actions": "[data-tour='session-actions']",
  "open-exit-form": "[data-tour='session-exit-trigger']",
  "submit-exit-form": "[data-tour='exit-form-submit']",
  "open-students": "[data-tour='nav-students']",
  "open-profile": "[data-tour='nav-profile']",
  "open-resources": "[data-tour='nav-resources']",
  "open-hours": "[data-tour='nav-hours']",
};

export function TutorPortalSandbox() {
  const [view, setView] = useState<SandboxView>("dashboard");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [exitFormOpen, setExitFormOpen] = useState(false);
  const [exitFormCompleted, setExitFormCompleted] = useState(false);

  const steps = useMemo<Step[]>(
    () => [
      {
        id: "welcome",
        target: "[data-tour='sandbox-shell']",
        placement: "center",
        buttons: ["primary"],
        title: "Tutor Portal Walkthrough",
        content:
          "This is a simulation of the tutor portal using sample data. Nothing in this walkthrough is saved.",
      },
      {
        id: "dashboard",
        target: "[data-tour='dashboard-sessions']",
        placement: "bottom",
        before: async () => setView("dashboard"),
        title: "Dashboard",
        content:
          "Your active sessions appear here. This row includes the meeting link, Session Exit Form, and session actions.",
      },
      {
        id: "open-actions",
        target: "[data-tour='session-actions']",
        placement: "left",
        buttons: CLICK_STEP_BUTTONS,
        disableFocusTrap: true,
        before: async () => setActionsOpen(false),
        title: "Open the session actions",
        content: "Select the three-dot button.",
      },
      {
        id: "actions-menu",
        target: "[data-tour='session-actions-menu']",
        placement: "left",
        before: async () => setActionsOpen(true),
        after: () => setActionsOpen(false),
        title: "Session actions",
        content:
          "Use these options to edit a session, request a substitute, or cancel a session. Substitute requests should be made at least 24 hours in advance.",
      },
      {
        id: "open-exit-form",
        target: "[data-tour='session-exit-trigger']",
        placement: "left",
        buttons: CLICK_STEP_BUTTONS,
        disableFocusTrap: true,
        before: async () => {
          setView("dashboard");
          setActionsOpen(false);
          setExitFormOpen(false);
        },
        title: "Open the Session Exit Form",
        content: "Select the SEF button for the session.",
      },
      {
        id: "submit-exit-form",
        target: "[data-tour='exit-form-submit']",
        placement: "left",
        buttons: CLICK_STEP_BUTTONS,
        disableFocusTrap: true,
        before: async () => setExitFormOpen(true),
        title: "Submit the Session Exit Form",
        content:
          "The practice form is already filled in. Submit it to continue. Session hours are recorded from completed sessions and their SEFs.",
      },
      {
        id: "open-students",
        target: "[data-tour='nav-students']",
        placement: "right",
        buttons: CLICK_STEP_BUTTONS,
        disableFocusTrap: true,
        before: async () => setExitFormOpen(false),
        title: "Open My Students",
        content: "Select My Students.",
      },
      {
        id: "student-contacts",
        target: "[data-tour='student-contacts']",
        placement: "bottom",
        before: async () => setView("students"),
        title: "Student and parent contact information",
        content:
          "For a no-show, wait five minutes, call the parent using the number listed here, text if there is no answer, and wait up to 15 minutes total.",
      },
      {
        id: "open-profile",
        target: "[data-tour='nav-profile']",
        placement: "right",
        buttons: CLICK_STEP_BUTTONS,
        disableFocusTrap: true,
        title: "Open Profile",
        content: "Select Profile.",
      },
      {
        id: "profile-form",
        target: "[data-tour='profile-form']",
        placement: "bottom",
        before: async () => setView("profile"),
        title: "Keep your profile current",
        content:
          "Update your availability, subjects, and languages when they change. Connect Me uses this information for tutor matching.",
      },
      {
        id: "open-resources",
        target: "[data-tour='nav-resources']",
        placement: "right",
        buttons: CLICK_STEP_BUTTONS,
        disableFocusTrap: true,
        title: "Open Resources",
        content: "Select Resources.",
      },
      {
        id: "resource-list",
        target: "[data-tour='resource-list']",
        placement: "bottom",
        before: async () => setView("resources"),
        title: "Tutor Resources",
        content:
          "Use the resource table when a student does not have homework. The handbook, portal manual, and tutor FAQs are available on this page.",
      },
      {
        id: "open-hours",
        target: "[data-tour='nav-hours']",
        placement: "right",
        buttons: CLICK_STEP_BUTTONS,
        disableFocusTrap: true,
        title: "Open My Hours",
        content: "Select My Hours.",
      },
      {
        id: "hours-summary",
        target: "[data-tour='hours-summary']",
        placement: "bottom",
        before: async () => setView("hours"),
        title: "Review your volunteer hours",
        content:
          "Use this page to review tutoring and event hours. The totals shown in this walkthrough are sample data.",
      },
      {
        id: "finish",
        target: "[data-tour='sandbox-shell']",
        placement: "center",
        buttons: ["back"],
        title: "Walkthrough complete",
        content: (
          <div>
            <p>You have reviewed the tutor workflows covered in orientation.</p>
            <Button asChild className="mt-4 w-full">
              <Link data-walkthrough-control href="/orientation">
                Return to Orientation
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const { controls, state, step, Tour } = useJoyride({
    continuous: true,
    run: true,
    scrollToFirstStep: true,
    steps,
    options: {
      blockTargetInteraction: false,
      buttons: ["back", "primary"],
      dismissKeyAction: false,
      overlayClickAction: false,
      overlayColor: "rgba(0, 0, 0, 0.58)",
      primaryColor: "#171717",
      showProgress: true,
      skipBeacon: true,
      spotlightPadding: 6,
      spotlightRadius: 6,
      targetWaitTimeout: 2500,
      textColor: "#171717",
      width: 360,
      zIndex: 140,
    },
    locale: {
      back: "Back",
      next: "Next",
      nextWithProgress: "Next ({current} of {total})",
    },
    styles: {
      floater: { filter: "drop-shadow(0 10px 24px rgba(0, 0, 0, 0.18))" },
      spotlight: { stroke: "#3b82f6", strokeWidth: 4 },
      tooltip: { border: "1px solid #e5e7eb", borderRadius: 8, padding: 20 },
      tooltipContainer: { textAlign: "left" },
      tooltipTitle: { fontSize: 17, fontWeight: 600, lineHeight: 1.4 },
      tooltipContent: {
        color: "#525252",
        fontSize: 14,
        lineHeight: 1.5,
        paddingBottom: 16,
        paddingTop: 8,
      },
      buttonBack: { color: "#525252", fontSize: 14, padding: "8px 12px" },
      buttonPrimary: { borderRadius: 6, fontSize: 14, padding: "8px 14px" },
    },
  });

  const activeStepIdRef = useRef(step?.id);
  const tourStatusRef = useRef(state.status);
  const advancePendingRef = useRef(false);

  useEffect(() => {
    activeStepIdRef.current = step?.id;
    tourStatusRef.current = state.status;
    advancePendingRef.current = false;
  }, [state.status, step?.id]);

  const advanceIfActive = (stepId: string) => {
    if (
      tourStatusRef.current !== STATUS.RUNNING ||
      activeStepIdRef.current !== stepId ||
      advancePendingRef.current
    )
      return;

    advancePendingRef.current = true;
    window.setTimeout(() => {
      if (tourStatusRef.current === STATUS.RUNNING && activeStepIdRef.current === stepId) {
        controls.next();
      } else {
        advancePendingRef.current = false;
      }
    }, 0);
  };

  const selectView = (nextView: SandboxView) => {
    const expectedStep: Partial<Record<SandboxView, string>> = {
      students: "open-students",
      profile: "open-profile",
      resources: "open-resources",
      hours: "open-hours",
    };
    if (expectedStep[nextView] !== step?.id) return;
    setView(nextView);
    advanceIfActive(expectedStep[nextView] ?? "");
  };

  const handleSandboxClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-walkthrough-control]") || target.closest(".react-joyride__tooltip"))
      return;
    const allowedSelector = step?.id ? INTERACTIVE_TARGETS[step.id] : undefined;
    if (!allowedSelector || !target.closest(allowedSelector)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const openActions = () => {
    if (step?.id !== "open-actions") return;
    setActionsOpen(true);
    advanceIfActive("open-actions");
  };

  const openExitForm = () => {
    if (step?.id !== "open-exit-form") return;
    setExitFormOpen(true);
    advanceIfActive("open-exit-form");
  };

  const submitExitForm = () => {
    if (step?.id !== "submit-exit-form") return;
    setExitFormOpen(false);
    setExitFormCompleted(true);
    advanceIfActive("submit-exit-form");
  };

  return (
    <div
      className="fixed inset-0 z-[70] overflow-auto bg-background text-foreground"
      data-tour="sandbox-shell"
      onClickCapture={handleSandboxClick}
    >
      {Tour}
      <div
        className="pointer-events-none fixed left-4 top-4 z-[150] max-w-xs rounded-md border bg-background/95 px-3 py-2 text-xs font-medium shadow-sm lg:hidden"
        role="note"
      >
        This desktop-style walkthrough is best viewed on a larger screen.
      </div>
      <div className="flex h-full min-w-[1180px]">
        <PortalSidebar activeView={view} onSelect={selectView} />
        <div className="flex-1 overflow-auto">
          <header className="relative h-16 w-full bg-background">
            <div className="absolute right-8 top-3 flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm font-semibold">
              <User aria-hidden="true" className="h-4 w-4" />
              <span>Taylor Morgan</span>
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </div>
          </header>
          <main className="min-h-[calc(100%-4rem)] rounded-2xl border-2 border-gray-200">
            <PortalView
              actionsOpen={actionsOpen}
              exitFormCompleted={exitFormCompleted}
              onOpenActions={openActions}
              onOpenExitForm={openExitForm}
              view={view}
            />
          </main>
        </div>
      </div>
      <Link
        className="fixed bottom-4 right-4 z-[150] inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted"
        data-walkthrough-control
        href="/orientation"
      >
        <X aria-hidden="true" className="h-4 w-4" />
        Exit walkthrough
      </Link>
      {exitFormOpen && <SessionExitPracticeDialog onSubmit={submitExitForm} />}
    </div>
  );
}

function PortalSidebar({
  activeView,
  onSelect,
}: {
  activeView: SandboxView;
  onSelect: (view: SandboxView) => void;
}) {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col bg-card" data-tour="practice-sidebar">
      <div className="relative flex h-16 items-center p-4">
        <div className="flex items-center px-1 text-sm font-medium">
          <Image alt="logo" height="30" src="/logo.png" width="30" />
          <span className="ml-2 text-lg font-bold">Connect Me</span>
        </div>
        <Button
          aria-label="Collapse sidebar"
          className="absolute right-3 top-3"
          size="icon"
          variant="ghost"
        >
          <PanelLeftCloseIcon className="h-4 w-4" />
        </Button>
      </div>

      <nav aria-label="Practice tutor navigation" className="flex-grow space-y-1 px-3">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const supported = ["dashboard", "students", "profile", "resources", "hours"].includes(
            key,
          );
          const isActive = activeView === key;

          return (
            <Button
              className={cn(
                "w-full justify-start",
                isActive
                  ? "bg-blue-400/10 text-blue-500 hover:bg-blue-400/10 hover:text-blue-500"
                  : "text-primary-dark hover:bg-muted hover:text-foreground",
              )}
              data-tour={"nav-" + key}
              key={key}
              onClick={supported ? () => onSelect(key as SandboxView) : undefined}
              variant="ghost"
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
              <span className="ml-3">{label}</span>
            </Button>
          );
        })}
      </nav>

      <div className="space-y-1 px-3 pb-3">
        <SidebarUtility icon={Flag} label="Report an Issue" />
        <SidebarUtility icon={Settings} label="Settings" />
        <SidebarUtility icon={HelpCircle} label="Tutor Portal Manual" />
        <SidebarUtility icon={LogOut} label="Logout" />
      </div>
    </aside>
  );
}

function SidebarUtility({ icon: Icon, label }: { icon: typeof Flag; label: string }) {
  return (
    <Button className="w-full justify-start text-primary-dark" variant="ghost">
      <Icon aria-hidden="true" className="h-5 w-5" />
      <span className="ml-3">{label}</span>
    </Button>
  );
}

function PortalView({
  actionsOpen,
  exitFormCompleted,
  onOpenActions,
  onOpenExitForm,
  view,
}: {
  actionsOpen: boolean;
  exitFormCompleted: boolean;
  onOpenActions: () => void;
  onOpenExitForm: () => void;
  view: SandboxView;
}) {
  if (view === "students") return <StudentsPracticeView />;
  if (view === "profile") return <ProfilePracticeView />;
  if (view === "resources") return <ResourcesPracticeView />;
  if (view === "hours") return <HoursPracticeView />;

  return (
    <DashboardPracticeView
      actionsOpen={actionsOpen}
      exitFormCompleted={exitFormCompleted}
      onOpenActions={onOpenActions}
      onOpenExitForm={onOpenExitForm}
    />
  );
}

function DashboardPracticeView({
  actionsOpen,
  exitFormCompleted,
  onOpenActions,
  onOpenExitForm,
}: {
  actionsOpen: boolean;
  exitFormCompleted: boolean;
  onOpenActions: () => void;
  onOpenExitForm: () => void;
}) {
  return (
    <>
      <section className="p-8">
        <h1 className="mb-6 text-3xl font-bold">This Week</h1>
        <div className="flex space-x-6">
          <div className="flex-grow rounded-lg bg-white p-6 shadow">
            <SessionTable
              actionsOpen={false}
              exitFormCompleted={exitFormCompleted}
              interactive={false}
              onOpenActions={onOpenActions}
              onOpenExitForm={onOpenExitForm}
            />
          </div>
        </div>
      </section>

      <section className="p-8 pt-0" data-tour="dashboard-sessions">
        <h2 className="mb-6 text-3xl font-bold">Active Sessions</h2>
        <div className="flex space-x-6">
          <div className="flex-grow rounded-lg bg-white p-6 shadow">
            <Input className="mb-4 w-64" placeholder="Filter sessions..." readOnly />
            <SessionTable
              actionsOpen={actionsOpen}
              exitFormCompleted={exitFormCompleted}
              interactive
              onOpenActions={onOpenActions}
              onOpenExitForm={onOpenExitForm}
            />
            <TableFooterSummary label="1 row(s) total." />
          </div>
        </div>
      </section>

      <section className="p-8 pt-0">
        <h2 className="mb-6 text-3xl font-bold">Past Sessions</h2>
        <div className="flex space-x-6">
          <div className="flex-grow rounded-lg bg-white p-6 shadow">
            <Input className="mb-4 w-64" placeholder="Filter sessions..." readOnly />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mark Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Meeting Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-3 py-1 text-green-800">
                      <CheckCircle className="mr-1 h-3.5 w-3.5" />
                      Complete
                    </span>
                  </TableCell>
                  <TableCell>August 11, 2026 at 4:00 PM EDT</TableCell>
                  <TableCell className="font-medium">Tutoring Session with Jordan Lee</TableCell>
                  <TableCell>Jordan Lee</TableCell>
                  <TableCell>1 hr</TableCell>
                  <TableCell>
                    <Button variant="outline">View Session Notes</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </>
  );
}

function SessionTable({
  actionsOpen,
  exitFormCompleted,
  interactive,
  onOpenActions,
  onOpenExitForm,
}: {
  actionsOpen: boolean;
  exitFormCompleted: boolean;
  interactive: boolean;
  onOpenActions: () => void;
  onOpenExitForm: () => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mark Status</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Student</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Meeting</TableHead>
          <TableHead>Session Exit Form</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>
            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-blue-800">
              <Clock className="mr-1 h-3.5 w-3.5" />
              {exitFormCompleted ? "Complete" : "Active"}
            </span>
          </TableCell>
          <TableCell>August 18, 2026 at 4:00 PM EDT</TableCell>
          <TableCell className="font-medium">Tutoring Session with Jordan Lee</TableCell>
          <TableCell>Jordan Lee</TableCell>
          <TableCell>1 hr</TableCell>
          <TableCell>
            <button
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
              type="button"
            >
              <Video className="h-4 w-4" />
              Meeting
            </button>
          </TableCell>
          <TableCell>
            <Button
              data-tour={interactive ? "session-exit-trigger" : undefined}
              onClick={interactive ? onOpenExitForm : undefined}
              variant="outline"
            >
              {exitFormCompleted ? "SEF Submitted" : "SEF Due 08/20"}
            </Button>
          </TableCell>
          <TableCell>
            <DropdownMenu
              modal={false}
              onOpenChange={(open) => {
                if (interactive && open) onOpenActions();
              }}
              open={interactive && actionsOpen}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Session actions"
                  data-tour={interactive ? "session-actions" : undefined}
                  size="icon"
                  variant="ghost"
                >
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              {interactive && <SessionActionsMenu />}
            </DropdownMenu>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function SessionActionsMenu() {
  return (
    <DropdownMenuContent
      align="end"
      className="z-[120] w-52 max-h-none overflow-visible data-[state=closed]:animate-none data-[state=open]:animate-none"
      data-tour="session-actions-menu"
      onCloseAutoFocus={(event) => event.preventDefault()}
    >
      <DropdownMenuGroup className="pointer-events-none">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem>
          <Edit className="mr-2 h-4 w-4" />
          Edit Session
        </DropdownMenuItem>
        <DropdownMenuItem>
          <UserRoundPlus className="mr-2 h-4 w-4" />
          Request Substitute
        </DropdownMenuItem>
        <DropdownMenuItem>
          <CalendarX className="mr-2 h-4 w-4" />
          Cancel
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
}

function TableFooterSummary({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <span>Rows per page</span>
        <div className="rounded-md border px-3 py-2">5</div>
        <span>Page 1 of 1</span>
        <Button disabled size="icon" variant="ghost">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button disabled size="icon" variant="ghost">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SessionExitPracticeDialog({ onSubmit }: { onSubmit: () => void }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Session Exit Form</h2>
          <Button variant="outline">The session did not happen</Button>
        </div>
        <div className="space-y-5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox disabled />I have a question or a concern
          </label>
          <Textarea
            disabled
            value="Reviewed integer operations and practiced two-step equations. Jordan completed the examples independently."
          />
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked disabled />
            <span>
              <span className="text-red-500">*</span> My student knows about our next class
            </span>
          </label>
          <Button className="w-full" data-tour="exit-form-submit" onClick={onSubmit}>
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}

function StudentsPracticeView() {
  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">My Students</h1>
      <div className="flex space-x-6">
        <div className="flex-grow rounded-lg bg-white p-6 shadow">
          <Input className="mb-4 w-64" placeholder="Filter students..." readOnly />
          <div className="overflow-x-auto rounded-lg border" data-tour="student-contacts">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Subjects</TableHead>
                  <TableHead>Student Email</TableHead>
                  <TableHead>Parent Email</TableHead>
                  <TableHead>Parent Phone</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>2026-08-03</TableCell>
                  <TableCell>Jordan Lee</TableCell>
                  <TableCell>
                    <Button variant="outline">View Availabilities</Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>Math</span>
                      <span>Science</span>
                    </div>
                  </TableCell>
                  <TableCell>jordan.lee@example.test</TableCell>
                  <TableCell>parent.lee@example.test</TableCell>
                  <TableCell>(202) 555-0147</TableCell>
                  <TableCell>
                    <Button
                      aria-label="Remove student pairing"
                      className="text-red-500"
                      size="icon"
                      variant="ghost"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span>1 row(s) total.</span>
            <span>Rows per page&nbsp;&nbsp; 10 &nbsp;&nbsp; Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfilePracticeView() {
  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-6xl" data-tour="profile-form">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <User className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Update Your Profile</h1>
          </div>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Keep your profile information up to date to help others connect with you more
            effectively
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <section className="h-fit rounded-lg border bg-card">
            <div className="p-6">
              <h2 className="flex items-center gap-2 text-2xl font-semibold">
                <Calendar className="h-5 w-5 text-blue-600" />
                Availability Schedule
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Set your available days and times for meetings or sessions
              </p>
            </div>
            <div className="px-6 pb-6">
              <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border bg-gray-50 p-4">
                <ProfileValue label="Day" value="Monday" />
                <ProfileValue label="Start Time" value="4:00 PM" />
                <ProfileValue label="End Time" value="6:00 PM" />
              </div>
              <Button className="w-full bg-transparent" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Time Slot
              </Button>
            </div>
          </section>

          <div className="space-y-8">
            <ProfileEntryCard
              description="Add topics and subjects you're passionate about or knowledgeable in"
              icon={<BookOpen className="h-5 w-5 text-green-600" />}
              placeholder="e.g., Mathematics, Physics, Literature"
              title="Subjects of Interest"
              values={["Mathematics", "Science"]}
            />
            <ProfileEntryCard
              description="List the languages you can communicate in"
              icon={<Languages className="h-5 w-5 text-purple-600" />}
              placeholder="e.g., English, Spanish, French"
              title="Languages Spoken"
              values={["English"]}
            />
          </div>
        </div>

        <div className="flex justify-center pt-16">
          <Button className="px-12 py-3 text-lg" size="lg">
            <CheckCircle className="mr-2 h-5 w-5" />
            Update Profile
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <div className="mt-1 rounded-md border bg-background px-3 py-2 text-sm">{value}</div>
    </div>
  );
}

function ProfileEntryCard({
  description,
  icon,
  placeholder,
  title,
  values,
}: {
  description: string;
  icon: ReactNode;
  placeholder: string;
  title: string;
  values: string[];
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="p-6">
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          {icon}
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="px-6 pb-6">
        <div className="flex gap-2">
          <Input placeholder={placeholder} readOnly />
          <Button size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4 flex gap-2">
          {values.map((value) => (
            <span className="rounded-md bg-secondary px-3 py-1 text-sm" key={value}>
              {value}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const SAMPLE_RESOURCES = [
  {
    title: "ALL Khan Academy Math Exercises",
    description:
      "A compilation of K–8 Khan Academy math curriculum for targeted practice questions.",
    type: "Worksheet/practice questions",
    subject: "Math",
  },
  {
    title: "826 Digital Library",
    description: "ELA lessons, projects, videos, and educator tools across a range of topics.",
    type: "Activities, Lesson Plans, Videos",
    subject: "English",
  },
  {
    title: "Hand2Mind",
    description: "Downloadable worksheets and lesson plans for targeted practice.",
    type: "Activities, Lesson Plans",
    subject: "Math, Science",
  },
];

function ResourcesPracticeView() {
  return (
    <div className="relative p-8">
      <h1 className="mb-6 text-3xl font-bold">Tutor Resources</h1>
      <div className="flex gap-6" data-tour="resource-list">
        <div className="flex-grow rounded-lg bg-white p-6 shadow">
          <input
            className="mb-4 w-64 rounded border p-2"
            placeholder="Filter resources..."
            readOnly
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_RESOURCES.map((resource) => (
                <TableRow key={resource.title}>
                  <TableCell>{resource.title}</TableCell>
                  <TableCell>{resource.description}</TableCell>
                  <TableCell>
                    <Button variant="outline">Open Resource</Button>
                  </TableCell>
                  <TableCell>{resource.type}</TableCell>
                  <TableCell>{resource.subject}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            <span>19 resource(s) total.</span>
            <span>Rows per page&nbsp;&nbsp; 10 &nbsp;&nbsp; Page 1 of 2</span>
          </div>
        </div>

        <div className="w-[300px] space-y-8">
          <ResourceCard
            description="This handbook covers expectations, policy, attendance, and other necessary information for tutors."
            subtitle="Read before your first tutoring session!"
            title="Tutor Handbook"
          />
          <ResourceCard
            description="This manual contains helpful information for tutors."
            subtitle="Manual that tutors can refer to"
            title="Tutor Manual"
          />
          <ResourceCard
            description="Find answers to common questions asked by tutors."
            subtitle="Frequently asked questions for tutors."
            title="Tutor FAQs"
          />
        </div>
      </div>
    </div>
  );
}

function ResourceCard({
  description,
  subtitle,
  title,
}: {
  description: string;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="flex aspect-square flex-col justify-between rounded-lg border bg-card p-6">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <p className="mt-8">{description}</p>
      </div>
      <Button className="w-full">Open {title}</Button>
    </section>
  );
}

function HoursPracticeView() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="mb-6 text-3xl font-bold">My Hours</h1>
      <div className="mb-6 flex gap-1 rounded-lg bg-white p-1">
        <Button className="bg-blue-100 text-blue-700 hover:bg-blue-100" size="sm">
          Card Layout
        </Button>
        <Button className="bg-white text-gray-600 hover:bg-gray-100" size="sm">
          Unified Table
        </Button>
      </div>

      <section className="mb-6 rounded-lg border bg-card" data-tour="hours-summary">
        <div className="p-6">
          <h2 className="text-2xl font-semibold">Hours Summary</h2>
        </div>
        <div className="grid grid-cols-3 gap-5 px-6 pb-6 text-center">
          <HoursMetric label="Session Hours" value="12" />
          <HoursMetric label="Event Hours" value="1.5" />
          <HoursMetric label="Total Hours" value="13.5" />
        </div>
      </section>

      <HoursTable title="Students" leftHeading="Student" leftValue="Jordan Lee" hours="12" />
      <HoursTable
        title="Events"
        leftHeading="Summary"
        leftValue="Biweekly Meeting Attendance"
        hours="1.5"
      />
    </div>
  );
}

function HoursTable({
  hours,
  leftHeading,
  leftValue,
  title,
}: {
  hours: string;
  leftHeading: string;
  leftValue: string;
  title: string;
}) {
  return (
    <section className="mb-6 rounded-lg border bg-card p-4">
      <h2 className="mb-6 text-lg font-semibold">{title}</h2>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>{leftHeading}</TableHead>
              <TableHead>Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{leftValue}</TableCell>
              <TableCell>{hours}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function HoursMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-3xl font-bold text-blue-800">{value}</div>
      <div className="mt-1 text-sm text-gray-600">{label}</div>
    </div>
  );
}
