export interface OrientationTrainingClip {
  id: string;
  title: string;
  durationLabel: string;
  src: string;
  reflectionPrompt: string;
  transcript: readonly {
    speaker: "Student" | "Tutor";
    text: string;
  }[];
}

export const ORIENTATION_TRAINING_CLIPS: readonly OrientationTrainingClip[] = [
  {
    id: "productive-wait-time",
    title: "Productive Wait Time",
    durationLabel: "35 sec",
    src: "/api/orientation/videos/clip-01-productive-wait-time.mp4",
    reflectionPrompt:
      "What did the tutor do well to set clear expectations for the student before the quiet work period began, and how could you use that approach in your own sessions?",
    transcript: [
      {
        speaker: "Tutor",
        text: "All right, here's the question. Let me know if you need help, and I'll help you with it.",
      },
      { speaker: "Student", text: "Okay." },
      { speaker: "Tutor", text: "Do you need some help?" },
      { speaker: "Student", text: "Yeah." },
      {
        speaker: "Tutor",
        text: "Yeah. So basically, what we're going to do—I'm going to try to write this out. Okay. So first, all we need to do is get the N on one side. N is the variable. Then we need to get a number on the other side, so N equals something, right?",
      },
      { speaker: "Student", text: "Yeah." },
      { speaker: "Tutor", text: "Because we want to find out what N is." },
    ],
  },
  {
    id: "check-and-release",
    title: "Checking for Understanding",
    durationLabel: "36 sec",
    src: "/api/orientation/videos/clip-02-check-and-release.mp4",
    reflectionPrompt:
      "What did the tutor do to see if the student was understanding the problem so far and ready to move on, and what might you look for in your own students to know they're ready to proceed?",
    transcript: [
      {
        speaker: "Tutor",
        text: "Yeah. So for this one, we want to get rid of this one-half N. We can just have 2, so we can add one-half N on each side. Does that help you a little bit?",
      },
      { speaker: "Student", text: "Yeah, it did." },
      {
        speaker: "Tutor",
        text: "So now, if we add 0.5N to each side, we'll have 2 because we got rid of the negative one-half N. Two equals—and then we have to add one-half N here—so we have three-and-a-half N plus 16. Do you want to keep going with this?",
      },
      { speaker: "Student", text: "Yeah." },
      { speaker: "Tutor", text: "Okay." },
    ],
  },
  {
    id: "diagnose-student-thinking",
    title: "Understanding Student Reasoning",
    durationLabel: "43 sec",
    src: "/api/orientation/videos/clip-03-diagnose-student-thinking.mp4",
    reflectionPrompt:
      "What benefit did you observe from starting from the beginning instead of judging the student’s answer, and how might starting at the beginning change the dynamic in your own sessions?",
    transcript: [
      { speaker: "Student", text: "I got 0.8125 as A." },
      {
        speaker: "Tutor",
        text: "Yeah. Can you show me how you got it? So what did you do first?",
      },
      { speaker: "Student", text: "First, I subtracted 5 from both sides." },
      {
        speaker: "Tutor",
        text: "Okay. So we did 4A, and then we subtracted 5, right? So what did you get after that?",
      },
      { speaker: "Student", text: "After that, I got 4A equals negative 3 plus 3.25A." },
      { speaker: "Tutor", text: "That's correct." },
    ],
  },
  {
    id: "target-the-misconception",
    title: "Prerequisite Skill Practice",
    durationLabel: "1 min 2 sec",
    src: "/api/orientation/videos/clip-04-target-the-misconception.mp4",
    reflectionPrompt:
      "Why did the tutor connect the success of the simpler question back to the original question, and how will implementing that in your sessions build the student’s confidence?",
    transcript: [
      {
        speaker: "Tutor",
        text: "Also, just as a side note, have you ever tried something like: if you have 3X plus 4Y plus 2X plus Y, would you know how to simplify that? If I told you to combine the like terms, would you know how to do that?",
      },
      { speaker: "Student", text: "Yes. It would be 5X plus 5Y." },
      {
        speaker: "Tutor",
        text: "Yeah, exactly. And you see how the 5X and the 5Y, even when we simplify it, are still separate?",
      },
      { speaker: "Student", text: "Yeah." },
      {
        speaker: "Tutor",
        text: "Because they're not the same, right? X and Y can represent different things. If X was 1 and Y was 2, it wouldn't make sense for us to add them together, right?",
      },
      { speaker: "Student", text: "Right." },
      { speaker: "Tutor", text: "Because they represent different things." },
    ],
  },
  {
    id: "use-guided-analogy",
    title: "Guided Error Correction",
    durationLabel: "43 sec",
    src: "/api/orientation/videos/clip-05-use-guided-analogy.mp4",
    reflectionPrompt:
      "What made this analogy effective in helping the student supply their own correction, and how could you use similar analogies to clarify misconceptions in your sessions?",
    transcript: [
      { speaker: "Student", text: "4A plus negative 4A would be A." },
      {
        speaker: "Tutor",
        text: "Well, if we have a number—let's just pick a number—what's a number plus its negative version?",
      },
      { speaker: "Student", text: "Zero." },
      {
        speaker: "Tutor",
        text: "Yeah. So now we just have zero, and this 3 right here is positive 3. We have 3 plus zero, but we don't need to write the zero out, right? They just cancel each other out. If you want, we could write it this way. We could rearrange them: 4A minus 4A plus 3. Obviously, the 4A minus 4A is zero, so it's just 3, right?",
      },
      { speaker: "Student", text: "Right." },
      { speaker: "Tutor", text: "So now we have 3." },
    ],
  },
  {
    id: "near-miss-to-success",
    title: "Supporting Self-Correction",
    durationLabel: "26 sec",
    src: "/api/orientation/videos/clip-06-turn-near-miss-into-success.mp4",
    reflectionPrompt:
      "What did the tutor do to help the student recognize and correct a nearly correct answer without giving away the solution, and how could you use that approach to preserve student ownership in your own sessions?",
    transcript: [
      {
        speaker: "Tutor",
        text: "Yeah, you're very, very close. So we divide each side by negative 0.75, right?",
      },
      { speaker: "Student", text: "Mm-hmm." },
      {
        speaker: "Tutor",
        text: "So what's 3 divided by negative 0.75? You said it was negative 4, right?",
      },
      { speaker: "Student", text: "Right." },
      { speaker: "Tutor", text: "So negative 4—but there's no A here." },
      { speaker: "Student", text: "Oh, negative 4 equals A." },
      { speaker: "Tutor", text: "Yeah, yeah, yeah. Does that make sense?" },
      { speaker: "Student", text: "Yes." },
      { speaker: "Tutor", text: "Yeah. So negative 4 equals A." },
    ],
  },
  {
    id: "normalize-uncertainty",
    title: "Productive Struggle",
    durationLabel: "19 sec",
    src: "/api/orientation/videos/clip-07-normalize-uncertainty.mp4",
    reflectionPrompt:
      "How did the tutor respond when the student apologized for being confused, and how could a similar response help students feel more comfortable working through mistakes in your own sessions?",
    transcript: [
      { speaker: "Student", text: "Oh my goodness. I'm sorry. My brain is currently—" },
      { speaker: "Tutor", text: "Oh, don't worry. Don't worry." },
      {
        speaker: "Tutor",
        text: "Yeah, it's good if you don't know something because we're learning, right? It's better than just reviewing stuff that you already know.",
      },
      { speaker: "Student", text: "Yeah." },
    ],
  },
  {
    id: "plan-follow-up",
    title: "Post-Session Follow-Up",
    durationLabel: "17 sec",
    src: "/api/orientation/videos/clip-08-plan-follow-up.mp4",
    reflectionPrompt:
      "What did the tutor do to make the session’s work useful after the call ended, and what kind of follow-up could you provide to support a student’s continued practice and retention?",
    transcript: [
      {
        speaker: "Tutor",
        text: "Yeah. If you want, I can write all of this down and then send you a picture or something after this.",
      },
      { speaker: "Student", text: "Okay." },
      { speaker: "Tutor", text: "But yeah. All right. Does that kind of make more sense now?" },
      { speaker: "Student", text: "Yeah. Mm-hmm." },
    ],
  },
] as const;

export const ORIENTATION_TRAINING_VIDEO_FILES = ORIENTATION_TRAINING_CLIPS.map((clip) =>
  clip.src.split("/").at(-1)!,
);
