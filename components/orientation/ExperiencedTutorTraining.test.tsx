import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { clampUnwatchedSeek, ExperiencedTutorTraining } from "./ExperiencedTutorTraining";
import { ORIENTATION_TRAINING_CLIPS } from "@/constants/orientation-training-clips";

describe("ExperiencedTutorTraining", () => {
  it("defines eight protected training clips without internal source metadata", () => {
    expect(ORIENTATION_TRAINING_CLIPS).toHaveLength(8);
    expect(
      ORIENTATION_TRAINING_CLIPS.every((clip) =>
        /^\/api\/orientation\/videos\/clip-\d{2}-[a-z-]+\.mp4$/.test(clip.src),
      ),
    ).toBe(true);
    expect(
      ORIENTATION_TRAINING_CLIPS.every(
        (clip) =>
          !/[;—]/.test(clip.title) &&
          !("coachingNote" in clip) &&
          !("focus" in clip) &&
          !("sourceTime" in clip),
      ),
    ).toBe(true);
    expect(ORIENTATION_TRAINING_CLIPS[3].durationLabel).toBe("1 min 2 sec");
  });

  it("renders the first clip and its locked reflection without internal guidance", () => {
    const markup = renderToStaticMarkup(<ExperiencedTutorTraining />);

    expect(markup).toContain("Experienced Tutor Examples");
    expect(markup).toContain("Productive Wait Time");
    expect(markup).toContain("/api/orientation/videos/clip-01-productive-wait-time.mp4");
    expect(markup).toContain("Reflection question");
    expect(markup).toContain(
      "What did the tutor do well to set clear expectations for the student before the quiet work period began, and how could you use that approach in your own sessions?",
    );
    expect(markup).toContain("Watch the full clip to unlock the reflection");
    expect(markup).toContain("You can replay any part you have already watched");
    expect(markup).not.toContain("responses stay in this activity and are not saved");
    expect(markup).not.toContain("Your response is not saved");
    expect(markup).not.toContain("Coaching guidance");
    expect(markup).not.toContain("Teaching focus");
    expect(markup).not.toContain("Source 1:05");
  });

  it("uses the approved reflection questions for the first five clips", () => {
    expect(ORIENTATION_TRAINING_CLIPS.slice(0, 5).map((clip) => clip.reflectionPrompt)).toEqual([
      "What did the tutor do well to set clear expectations for the student before the quiet work period began, and how could you use that approach in your own sessions?",
      "What did the tutor do to see if the student was understanding the problem so far and ready to move on, and what might you look for in your own students to know they're ready to proceed?",
      "What benefit did you observe from starting from the beginning instead of judging the student’s answer, and how might starting at the beginning change the dynamic in your own sessions?",
      "Why did the tutor connect the success of the simpler question back to the original question, and how will implementing that in your sessions build the student’s confidence?",
      "What made this analogy effective in helping the student supply their own correction, and how could you use similar analogies to clarify misconceptions in your sessions?",
    ]);
  });

  it("uses observation and application questions for the remaining clips", () => {
    expect(ORIENTATION_TRAINING_CLIPS.slice(5).map((clip) => clip.reflectionPrompt)).toEqual([
      "What did the tutor do to help the student recognize and correct a nearly correct answer without giving away the solution, and how could you use that approach to preserve student ownership in your own sessions?",
      "How did the tutor respond when the student apologized for being confused, and how could a similar response help students feel more comfortable working through mistakes in your own sessions?",
      "What did the tutor do to make the session’s work useful after the call ended, and what kind of follow-up could you provide to support a student’s continued practice and retention?",
    ]);
  });

  it("allows rewinding but blocks seeking beyond unwatched video", () => {
    expect(clampUnwatchedSeek(8, 12, false)).toBe(8);
    expect(clampUnwatchedSeek(20, 12, false)).toBe(12);
    expect(clampUnwatchedSeek(20, 12, true)).toBe(20);
  });
});
