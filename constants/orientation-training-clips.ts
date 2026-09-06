export interface OrientationTrainingClip {
  id: string;
  title: string;
  sourceTime: string;
  durationLabel: string;
  src: string;
  focus: string;
  reflectionPrompt: string;
}

export const ORIENTATION_TRAINING_CLIPS: readonly OrientationTrainingClip[] = [
  {
    id: "productive-wait-time",
    title: "Productive Wait Time",
    sourceTime: "1:05–2:14 · edited",
    durationLabel: "35 sec",
    src: "/api/orientation/videos/clip-01-productive-wait-time.mp4",
    focus:
      "The tutor invites the student to try independently, pauses, and responds when the student asks for help. The long quiet work period is shortened in this excerpt.",
    reflectionPrompt:
      "What could you say before quiet work time so the student knows both what to try and how to ask for help?",
  },
  {
    id: "check-and-release",
    title: "Checking for Understanding",
    sourceTime: "3:04–3:40",
    durationLabel: "36 sec",
    src: "/api/orientation/videos/clip-02-check-and-release.mp4",
    focus:
      "After modeling one algebraic move, the tutor checks whether it helped, summarizes what changed, and explicitly asks the student to continue.",
    reflectionPrompt:
      "What evidence would tell you that you have modeled enough and should return the next step to the student?",
  },
  {
    id: "diagnose-student-thinking",
    title: "Understanding Student Reasoning",
    sourceTime: "12:02–12:44",
    durationLabel: "43 sec",
    src: "/api/orientation/videos/clip-03-diagnose-student-thinking.mp4",
    focus:
      "Instead of immediately judging the student's decimal answer, the tutor asks to see the process, starts with the first step, and identifies what was done correctly.",
    reflectionPrompt:
      "What follow-up question could help you locate the first point where a student's reasoning changed direction?",
  },
  {
    id: "target-the-misconception",
    title: "Prerequisite Skill Practice",
    sourceTime: "17:44–19:06 · edited",
    durationLabel: "1 min 2 sec",
    src: "/api/orientation/videos/clip-04-target-the-misconception.mp4",
    focus:
      "The tutor pauses the harder equation, gives a simpler like-terms example, lets the student solve it, and connects that success back to why unlike terms stay separate. The quiet work period is shortened.",
    reflectionPrompt:
      "How can a simpler example reveal whether the blocker is the current problem or a prerequisite skill?",
  },
  {
    id: "use-guided-analogy",
    title: "Guided Error Correction",
    sourceTime: "23:50–24:32",
    durationLabel: "43 sec",
    src: "/api/orientation/videos/clip-05-use-guided-analogy.mp4",
    focus:
      "When the student says that 4a plus negative 4a leaves a, the tutor reframes 4a as one number and asks what any number plus its negative equals. The student supplies the correction.",
    reflectionPrompt:
      "How did the tutor's analogy preserve the student's ownership of the correction?",
  },
  {
    id: "near-miss-to-success",
    title: "Supporting Self-Correction",
    sourceTime: "27:57–28:23",
    durationLabel: "26 sec",
    src: "/api/orientation/videos/clip-06-turn-near-miss-into-success.mp4",
    focus:
      "The student is one symbol away from the answer. The tutor says they are very close, restates the division, and asks for the quotient so the student removes the extra variable themselves.",
    reflectionPrompt:
      "How can you acknowledge that an answer is close without either accepting it or replacing it with the correct answer?",
  },
  {
    id: "normalize-uncertainty",
    title: "Productive Struggle",
    sourceTime: "35:03–35:22",
    durationLabel: "19 sec",
    src: "/api/orientation/videos/clip-07-normalize-uncertainty.mp4",
    focus:
      "When the student apologizes for feeling confused, the tutor immediately removes the shame and reframes not knowing as the reason they are learning together.",
    reflectionPrompt:
      "How could you respond when a student apologizes for being confused or getting something wrong?",
  },
  {
    id: "plan-follow-up",
    title: "Post-Session Follow-Up",
    sourceTime: "37:41–37:57",
    durationLabel: "17 sec",
    src: "/api/orientation/videos/clip-08-plan-follow-up.mp4",
    focus:
      "The tutor offers to turn the session's handwritten work into a picture the student can use later, then checks whether the explanation makes more sense.",
    reflectionPrompt:
      "What follow-up artifact could you give a student so today's reasoning remains usable after the call ends?",
  },
] as const;

export const ORIENTATION_TRAINING_VIDEO_FILES = ORIENTATION_TRAINING_CLIPS.map((clip) =>
  clip.src.split("/").at(-1)!,
);
