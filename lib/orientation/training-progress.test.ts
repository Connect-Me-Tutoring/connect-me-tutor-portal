import { describe, expect, it, vi } from "vitest";

import {
  createEmptyOrientationTrainingProgress,
  getOrientationTrainingProgressStorageKey,
  parseOrientationTrainingProgress,
  readOrientationTrainingProgress,
  writeOrientationTrainingProgress,
} from "./training-progress";

describe("orientation training progress", () => {
  it("falls back safely when saved progress is missing, malformed, or outdated", () => {
    expect(parseOrientationTrainingProgress(null)).toEqual(
      createEmptyOrientationTrainingProgress(),
    );
    expect(parseOrientationTrainingProgress("{invalid")).toEqual(
      createEmptyOrientationTrainingProgress(),
    );
    expect(parseOrientationTrainingProgress('{"version":0}')).toEqual(
      createEmptyOrientationTrainingProgress(),
    );
  });

  it("keeps valid progress while discarding unknown or unsafe values", () => {
    const progress = parseOrientationTrainingProgress(
      JSON.stringify({
        version: 1,
        activeClipId: "normalize-uncertainty",
        completedClipIds: ["normalize-uncertainty", "unknown", "normalize-uncertainty"],
        watchedClipIds: ["productive-wait-time", "unknown"],
        reflections: {
          "normalize-uncertainty": "A thoughtful response",
          unknown: "discard me",
        },
        furthestWatchedSeconds: {
          "productive-wait-time": 12.5,
          "normalize-uncertainty": Number.NaN,
          unknown: 30,
        },
      }),
    );

    expect(progress).toEqual({
      activeClipId: "normalize-uncertainty",
      completedClipIds: ["normalize-uncertainty"],
      watchedClipIds: ["productive-wait-time"],
      reflections: { "normalize-uncertainty": "A thoughtful response" },
      furthestWatchedSeconds: { "productive-wait-time": 12.5 },
    });
  });

  it("scopes saved progress to the current profile and tolerates unavailable storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };
    const progress = {
      ...createEmptyOrientationTrainingProgress(),
      activeClipId: "check-and-release",
    };

    writeOrientationTrainingProgress(storage, "profile-1", progress);

    expect(storage.setItem).toHaveBeenCalledWith(
      getOrientationTrainingProgressStorageKey("profile-1"),
      expect.any(String),
    );
    expect(readOrientationTrainingProgress(storage, "profile-1")).toEqual(progress);
    expect(readOrientationTrainingProgress(storage, "profile-2")).toEqual(
      createEmptyOrientationTrainingProgress(),
    );
  });
});
