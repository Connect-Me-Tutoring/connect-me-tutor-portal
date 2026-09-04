import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExperiencedTutorTraining } from "./ExperiencedTutorTraining";
import { ORIENTATION_TRAINING_CLIPS } from "@/constants/orientation-training-clips";

describe("ExperiencedTutorTraining", () => {
  it("defines eight protected, focused training clips", () => {
    expect(ORIENTATION_TRAINING_CLIPS).toHaveLength(8);
    expect(
      ORIENTATION_TRAINING_CLIPS.every((clip) =>
        /^\/api\/orientation\/videos\/clip-\d{2}-[a-z-]+\.mp4$/.test(clip.src),
      ),
    ).toBe(true);
    expect(
      ORIENTATION_TRAINING_CLIPS.every(
        (clip) => !/[;—]/.test(clip.title) && !("coachingNote" in clip),
      ),
    ).toBe(true);
    expect(ORIENTATION_TRAINING_CLIPS[3].durationLabel).toBe("1 min 2 sec");
  });

  it("renders the first clip, its focus, and a locked reflection", () => {
    const markup = renderToStaticMarkup(<ExperiencedTutorTraining />);

    expect(markup).toContain("Experienced Tutor Examples");
    expect(markup).toContain("Productive Wait Time");
    expect(markup).toContain("/api/orientation/videos/clip-01-productive-wait-time.mp4");
    expect(markup).toContain("Watch the full clip to unlock the reflection");
    expect(markup).toContain("responses stay in this activity and are not saved");
    expect(markup).not.toContain("Coaching guidance");
  });
});
