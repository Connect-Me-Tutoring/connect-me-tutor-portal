export interface OrientationTrainingClip {
  id: string;
  title: string;
  durationLabel: string;
  src: string;
  reflectionPrompt: string;
}

export const ORIENTATION_TRAINING_CLIPS: readonly OrientationTrainingClip[] = [
  {
    id: "productive-wait-time",
    title: "Productive Wait Time",
    durationLabel: "35 sec",
    src: "/api/orientation/videos/clip-01-productive-wait-time.mp4",
    reflectionPrompt:
      "What did the tutor do well to set clear expectations for the student before the quiet work period began, and how could you use that approach in your own sessions?",
  },
  {
    id: "check-and-release",
    title: "Checking for Understanding",
    durationLabel: "36 sec",
    src: "/api/orientation/videos/clip-02-check-and-release.mp4",
    reflectionPrompt:
      "What did the tutor do to see if the student was understanding the problem so far and ready to move on, and what might you look for in your own students to know they're ready to proceed?",
  },
  {
    id: "diagnose-student-thinking",
    title: "Understanding Student Reasoning",
    durationLabel: "43 sec",
    src: "/api/orientation/videos/clip-03-diagnose-student-thinking.mp4",
    reflectionPrompt:
      "What benefit did you observe from starting from the beginning instead of judging the student’s answer, and how might starting at the beginning change the dynamic in your own sessions?",
  },
  {
    id: "target-the-misconception",
    title: "Prerequisite Skill Practice",
    durationLabel: "1 min 2 sec",
    src: "/api/orientation/videos/clip-04-target-the-misconception.mp4",
    reflectionPrompt:
      "Why did the tutor connect the success of the simpler question back to the original question, and how will implementing that in your sessions build the student’s confidence?",
  },
  {
    id: "use-guided-analogy",
    title: "Guided Error Correction",
    durationLabel: "43 sec",
    src: "/api/orientation/videos/clip-05-use-guided-analogy.mp4",
    reflectionPrompt:
      "What made this analogy effective in helping the student supply their own correction, and how could you use similar analogies to clarify misconceptions in your sessions?",
  },
  {
    id: "near-miss-to-success",
    title: "Supporting Self-Correction",
    durationLabel: "26 sec",
    src: "/api/orientation/videos/clip-06-turn-near-miss-into-success.mp4",
    reflectionPrompt:
      "What did the tutor do to help the student recognize and correct a nearly correct answer without giving away the solution, and how could you use that approach to preserve student ownership in your own sessions?",
  },
  {
    id: "normalize-uncertainty",
    title: "Productive Struggle",
    durationLabel: "19 sec",
    src: "/api/orientation/videos/clip-07-normalize-uncertainty.mp4",
    reflectionPrompt:
      "How did the tutor respond when the student apologized for being confused, and how could a similar response help students feel more comfortable working through mistakes in your own sessions?",
  },
  {
    id: "plan-follow-up",
    title: "Post-Session Follow-Up",
    durationLabel: "17 sec",
    src: "/api/orientation/videos/clip-08-plan-follow-up.mp4",
    reflectionPrompt:
      "What did the tutor do to make the session’s work useful after the call ended, and what kind of follow-up could you provide to support a student’s continued practice and retention?",
  },
] as const;

export const ORIENTATION_TRAINING_VIDEO_FILES = ORIENTATION_TRAINING_CLIPS.map((clip) =>
  clip.src.split("/").at(-1)!,
);
