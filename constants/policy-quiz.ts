export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  /** Indices of the correct answer(s). Single-select questions have one element. */
  correctIndices: number[];
  explanation: string;
  category: "policy" | "faq" | "protocol";
  /** When true, the question uses checkboxes and requires all correct answers. */
  multiSelect?: boolean;
}

export const policyQuizQuestions: QuizQuestion[] = [
  {
    id: "min-sessions-hours",
    question:
      "How many tutoring sessions with a student must be completed in order to receive hours?",
    options: ["5", "8", "10", "15"],
    correctIndices: [2],
    explanation:
      "You must complete at least 10 tutoring sessions with a student before your volunteer hours for that pairing are counted.",
    category: "policy",
  },
  {
    id: "drop-student-consequence",
    question:
      "If a tutor drops a student before completing the minimum session requirement without a valid reason, what may happen?",
    options: [
      "The tutor may not receive those volunteer hours",
      "The tutor will automatically be removed from Connect Me",
      "The tutor must attend additional meetings",
      "The tutor cannot tutor again",
    ],
    correctIndices: [0],
    explanation:
      "If you drop a student before completing the required minimum sessions without a valid reason, you may not receive the volunteer hours from those sessions.",
    category: "policy",
  },
  {
    id: "sef-purpose",
    question:
      "The Session Exit Form (SEF) must be completed after every tutoring session to:",
    options: [
      "Receive volunteer hours",
      "Request a substitute",
      "Contact Admissions",
      "Document session attendance",
    ],
    correctIndices: [0, 3],
    explanation:
      "The SEF serves two purposes: it documents your session attendance and is required for you to receive your volunteer hours.",
    category: "policy",
    multiSelect: true,
  },
  {
    id: "sef-deadline",
    question:
      "How long after a tutoring session does a tutor have to complete the Session Exit Form (SEF)?",
    options: [
      "24 hours",
      "2 Days",
      "1 Week",
      "Before the next biweekly meeting",
    ],
    correctIndices: [0],
    explanation:
      "You must complete the SEF within 24 hours of your tutoring session. Late submissions may result in unlogged hours.",
    category: "policy",
  },
  {
    id: "biweekly-absence",
    question:
      "If you cannot attend a biweekly meeting, when should you submit the excused absence form?",
    options: [
      "At least 24 hours before the meeting",
      "At least 12 hours before the meeting",
      "Within 24 hours after the meeting",
      "Anytime before the next biweekly meeting",
    ],
    correctIndices: [0],
    explanation:
      "The excused absence form must be submitted at least 24 hours before the biweekly meeting you will miss.",
    category: "policy",
  },
  {
    id: "find-resources",
    question:
      "Where can tutors find important documents and resources?",
    options: [
      "Tutor Documents channel on Discord",
      "Parent email threads",
      "Resources tab on the Tutor Portal",
      "Tutor FAQ",
    ],
    correctIndices: [0, 2, 3],
    explanation:
      "Important documents and resources can be found on the Tutor Documents channel on Discord, the Resources tab in the Tutor Portal, and the Tutor FAQ. Parent email threads are not a source for tutor documents.",
    category: "faq",
    multiSelect: true,
  },
  {
    id: "welcome-message",
    question:
      "After being paired with a student, what must a tutor send before the first session?",
    options: [
      "A tutoring contract",
      "A progress report",
      "A welcome message",
      "A lesson plan",
    ],
    correctIndices: [2],
    explanation:
      "Before your first session, you should send a welcome message to introduce yourself and set expectations with the student and their parent/guardian.",
    category: "policy",
  },
  {
    id: "substitute-requests",
    question: "How many substitute requests may a tutor submit each month?",
    options: ["Unlimited", "1", "2", "3"],
    correctIndices: [2],
    explanation:
      "Tutors may submit up to 2 substitute requests per month. Plan ahead so you can attend your scheduled sessions.",
    category: "policy",
  },
  {
    id: "four-step-order",
    question:
      "What is the correct order of the 4-Step Protocol when a student does not attend a session?",
    options: [
      "Contact Admissions/Ghosts Manager → Text → Email → Call",
      "Call → Email → Text → Contact Admissions/Ghosts Manager",
      "Call → Text → Email → Contact Admissions/Ghosts Manager",
      "Contact Admissions/Ghosts Manager → Call → Text → Email",
    ],
    correctIndices: [2],
    explanation:
      "The 4-Step Protocol is: (1) Call the parent, (2) Text the parent, (3) Email the parent, (4) Contact the Ghosts Manager. Always start with a direct call.",
    category: "protocol",
  },
  {
    id: "protocol-first-call",
    question:
      "A student has not joined the Zoom session. According to the 4-Step Protocol, when should you first call the parent?",
    options: [
      "Immediately when the session starts",
      "After 5 minutes",
      "After 10 minutes",
      "After 15 minutes",
    ],
    correctIndices: [1],
    explanation:
      "If the student hasn't joined after 5 minutes, initiate Step 1 of the 4-Step Protocol by calling the parent/guardian.",
    category: "protocol",
  },
  {
    id: "protocol-after-call",
    question:
      "After calling the parent, what is the next step in the 4-Step Protocol?",
    options: [
      "Email the parent",
      "Send a text message to the parent",
      "Contact the Ghosts Manager",
      "Complete the SEF",
    ],
    correctIndices: [1],
    explanation:
      "After calling (Step 1), the next step is to send a text message to the parent (Step 2). The protocol order is Call → Text → Email → Contact Ghosts Manager.",
    category: "protocol",
  },
  {
    id: "protocol-fifteen-min",
    question:
      "You have called and texted the parent. Fifteen minutes have passed and the student has still not joined. What should you do?",
    options: [
      "Continue waiting",
      "Contact Admissions immediately",
      "Leave the Zoom and complete the SEF",
      "Cancel future sessions",
    ],
    correctIndices: [2],
    explanation:
      "After 15 minutes with no response, leave the Zoom session and complete the Session Exit Form to document the no-show. Continue with email (Step 3) and contacting the Ghosts Manager (Step 4) as needed.",
    category: "protocol",
  },
  {
    id: "protocol-no-response-one-day",
    question:
      "If the parent has not responded to your call or text after one day, what should you do?",
    options: [
      "Report the student as a ghost",
      "Email the parent",
      "Contact admissions",
      "Remove the student from the portal",
    ],
    correctIndices: [1],
    explanation:
      "If there's no response after one day, move to Step 3 of the 4-Step Protocol: email the parent. Escalate to the Ghosts Manager only after email attempts are also unanswered.",
    category: "protocol",
  },
  {
    id: "protocol-no-response-days",
    question:
      "If the parent still has not responded after several days, who should you contact?",
    options: [
      "Director of Admissions",
      "Tutor Onboarder",
      "Ghosts Manager",
      "Another tutor",
    ],
    correctIndices: [2],
    explanation:
      "Step 4 of the 4-Step Protocol: if all prior contact attempts fail, reach out to the Ghosts Manager who handles ongoing no-show situations.",
    category: "protocol",
  },
  {
    id: "stop-tutoring-actions",
    question:
      "Select all actions that should be taken if you can no longer tutor a student.",
    options: [
      "Inform the parent professionally",
      "Delete the enrollment with the student on the portal",
      "Complete the New Tutor Request Form",
      "Stop attending sessions immediately",
    ],
    correctIndices: [0, 2],
    explanation:
      "If you can no longer tutor a student, you must inform the parent professionally and complete the New Tutor Request Form so the student can be re-paired. Do not stop attending sessions without notice or delete enrollments yourself.",
    category: "policy",
    multiSelect: true,
  },
  {
    id: "max-pause-duration",
    question:
      "If you need to take a break from tutoring, what is the maximum amount of time you may pause tutoring while remaining in Connect Me?",
    options: ["1 month", "2 months", "3 months", "6 months"],
    correctIndices: [2],
    explanation:
      "You may pause tutoring for up to 3 months and still remain in Connect Me. Longer absences may require re-onboarding.",
    category: "policy",
  },
  {
    id: "international-tutor-meetings",
    question:
      "An international tutor cannot reasonably attend the standard biweekly meeting time. What should they do?",
    options: [
      "Submit an excused absence form before every meeting",
      "Contact the Director of Operations to receive an alternative attendance method",
      "Contact the Ghosts Manager",
      "Skip the meetings without penalty",
    ],
    correctIndices: [1],
    explanation:
      "International tutors who cannot attend the standard meeting time should contact the Director of Operations to arrange an alternative attendance method.",
    category: "faq",
  },
  {
    id: "excused-if-not-tutoring",
    question:
      "True or False: You are excused from biweekly meetings if not tutoring a student.",
    options: ["True", "False"],
    correctIndices: [1],
    explanation:
      "False. You are still required to attend biweekly meetings even if you are not currently paired with a student. These meetings cover important updates and training.",
    category: "policy",
  },
  {
    id: "change-meeting-times",
    question:
      "How do you change your meeting times with a student, or add another session per week?",
    options: [
      'Use the "My Students" tab to update the student\'s schedule',
      "Use the Dashboard tab to reschedule all future sessions",
      "Submit a request through the Chats feature for an administrator to update the schedule",
      'Use the "My Enrollments" tab to edit the session time or create a new enrollment',
    ],
    correctIndices: [3],
    explanation:
      'Use the "My Enrollments" tab on the portal to edit the session time for an existing enrollment or create a new enrollment if you need an additional session per week.',
    category: "faq",
  },
];
