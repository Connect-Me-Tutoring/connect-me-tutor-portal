export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  category: "policy" | "faq";
}

export const policyQuizQuestions: QuizQuestion[] = [
  {
    id: "attendance-policy",
    question:
      "What should you do if you cannot attend a scheduled tutoring session?",
    options: [
      "Simply don't show up — the student will understand",
      "Notify your student at least 24 hours in advance and reschedule",
      "Send a text to the student 5 minutes before the session",
      "Ask another tutor to cover for you without telling anyone",
    ],
    correctIndex: 1,
    explanation:
      "You must notify both your student and the Connect Me team at least 24 hours in advance. Consistent no-shows can result in removal from the program.",
    category: "policy",
  },
  {
    id: "session-frequency",
    question: "How often are tutoring sessions typically held with a student?",
    options: [
      "Once a month",
      "Every day",
      "Once a week",
      "Twice a week, always",
    ],
    correctIndex: 2,
    explanation:
      "Sessions are generally held once a week. The specific day and time are set when you are paired with your student based on overlapping availability.",
    category: "faq",
  },
  {
    id: "session-duration",
    question: "What is the standard length of a tutoring session?",
    options: ["30 minutes", "1 hour", "2 hours", "As long as you want"],
    correctIndex: 1,
    explanation:
      "Each tutoring session is 1 hour long by default. Session duration is configured per enrollment and may vary for certain programs.",
    category: "policy",
  },
  {
    id: "first-session",
    question:
      "What should you prioritize during your first session with a new student?",
    options: [
      "Jump straight into a lesson plan you prepared",
      "Build rapport, learn about the student's interests, and assess their needs",
      "Give them a diagnostic test immediately",
      "Let the student lead the entire session",
    ],
    correctIndex: 1,
    explanation:
      "Your first session is about building a connection with your student. Get to know them, learn their interests, and gently assess where they are academically so you can plan future sessions effectively.",
    category: "policy",
  },
  {
    id: "zoom-sessions",
    question: "Where do tutoring sessions take place?",
    options: [
      "In-person at a local library",
      "Over a Connect Me Zoom link provided in the portal",
      "On any video call platform of your choice",
      "Via phone call only",
    ],
    correctIndex: 1,
    explanation:
      "All sessions happen over Zoom using the meeting link assigned to your enrollment in the tutor portal. Do not use personal Zoom accounts or other platforms.",
    category: "faq",
  },
  {
    id: "session-exit-form",
    question: "What must you complete after every tutoring session?",
    options: [
      "Nothing — just log off",
      "A session exit form in the portal summarizing what you covered",
      "An email to the admin team",
      "A formal written report submitted by mail",
    ],
    correctIndex: 1,
    explanation:
      "After every session, you must fill out the session exit form in the portal. This helps the Connect Me team track progress, log hours, and flag any concerns.",
    category: "policy",
  },
  {
    id: "reschedule-process",
    question:
      "If you need to reschedule a session, what is the correct process?",
    options: [
      "Just pick a new time and show up then",
      "Use the reschedule feature in the tutor portal to propose a new time",
      "Text the student's parent directly",
      "Cancel the session and wait for next week",
    ],
    correctIndex: 1,
    explanation:
      "Use the reschedule feature in the portal. This notifies the student (and their parent/guardian) and keeps the admin team informed. Avoid informal rescheduling outside the system.",
    category: "policy",
  },
  {
    id: "student-concerns",
    question:
      "What should you do if your student shares something concerning (e.g., safety issues at home)?",
    options: [
      "Keep it to yourself — it's private",
      "Post about it on social media to raise awareness",
      "Report it to the Connect Me team immediately",
      "Try to solve the problem yourself",
    ],
    correctIndex: 2,
    explanation:
      "If a student discloses anything concerning, report it to the Connect Me team right away. You are not expected to handle these situations alone — the team has protocols to support the student appropriately.",
    category: "policy",
  },
  {
    id: "communication-channels",
    question:
      "What is the primary way to communicate with your student between sessions?",
    options: [
      "Personal phone number",
      "Instagram DMs",
      "The built-in chat feature in the tutor portal",
      "Your personal email",
    ],
    correctIndex: 2,
    explanation:
      "Use the portal's built-in chat to communicate with your student. This keeps all communication documented and accessible to the admin team if needed.",
    category: "faq",
  },
  {
    id: "tutor-resources",
    question:
      "Where can you find lesson plans and worksheets for your sessions?",
    options: [
      "You must create all materials from scratch",
      "The Resources page in the tutor portal has curated links and materials",
      "Ask the student to bring their own materials",
      "Search randomly on the internet during the session",
    ],
    correctIndex: 1,
    explanation:
      "The Resources page in the portal provides curated educational resources organized by subject and grade level — including Khan Academy exercises, reading comprehension worksheets, science labs, and more.",
    category: "faq",
  },
  {
    id: "volunteer-hours",
    question: "How are your volunteer/tutoring hours tracked?",
    options: [
      "You self-report hours in a separate spreadsheet",
      "Hours are automatically tracked through session completion and exit forms in the portal",
      "You email the admin team each week with your hours",
      "Hours are not tracked",
    ],
    correctIndex: 1,
    explanation:
      "Your hours are tracked through the portal when you complete sessions and submit exit forms. You can view your accumulated hours on the My Hours page.",
    category: "faq",
  },
  {
    id: "unpair-process",
    question:
      "What should you do if you feel your pairing with a student isn't working out?",
    options: [
      "Stop showing up until they reassign you",
      "Tell the student you don't want to tutor them anymore",
      "Reach out to the Connect Me team to discuss the situation and explore options",
      "Switch students with another tutor on your own",
    ],
    correctIndex: 2,
    explanation:
      "Communicate with the Connect Me team. They can mediate, provide tips, or re-pair you with a different student if needed. Never ghost a student or handle re-pairing informally.",
    category: "policy",
  },
];
