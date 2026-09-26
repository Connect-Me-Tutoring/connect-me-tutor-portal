import { ORIENTATION_TRAINING_CLIPS } from "@/constants/orientation-training-clips";

const STORAGE_VERSION = 1;
const STORAGE_KEY_PREFIX = "connect-me:tutor-orientation:experienced-tutor";
const MAX_REFLECTION_LENGTH = 4000;
const MAX_PROGRESS_SECONDS = 60 * 60;
const allowedClipIds = new Set(ORIENTATION_TRAINING_CLIPS.map((clip) => clip.id));

export interface OrientationTrainingProgress {
  activeClipId: string;
  completedClipIds: string[];
  furthestWatchedSeconds: Record<string, number>;
  reflections: Record<string, string>;
  watchedClipIds: string[];
}

interface StoredOrientationTrainingProgress extends OrientationTrainingProgress {
  version: typeof STORAGE_VERSION;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function filterClipIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value.filter((item): item is string => typeof item === "string" && allowedClipIds.has(item)),
    ),
  );
}

function filterReflections(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, string] =>
          allowedClipIds.has(entry[0]) && typeof entry[1] === "string",
      )
      .map(([clipId, reflection]) => [clipId, reflection.slice(0, MAX_REFLECTION_LENGTH)]),
  );
}

function filterProgress(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        (entry): entry is [string, number] =>
          allowedClipIds.has(entry[0]) &&
          typeof entry[1] === "number" &&
          Number.isFinite(entry[1]) &&
          entry[1] >= 0,
      )
      .map(([clipId, seconds]) => [clipId, Math.min(seconds, MAX_PROGRESS_SECONDS)]),
  );
}

export function createEmptyOrientationTrainingProgress(): OrientationTrainingProgress {
  return {
    activeClipId: ORIENTATION_TRAINING_CLIPS[0].id,
    completedClipIds: [],
    furthestWatchedSeconds: {},
    reflections: {},
    watchedClipIds: [],
  };
}

export function parseOrientationTrainingProgress(
  serializedProgress: string | null,
): OrientationTrainingProgress {
  if (!serializedProgress) return createEmptyOrientationTrainingProgress();

  try {
    const parsed: unknown = JSON.parse(serializedProgress);
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION) {
      return createEmptyOrientationTrainingProgress();
    }

    const activeClipId =
      typeof parsed.activeClipId === "string" && allowedClipIds.has(parsed.activeClipId)
        ? parsed.activeClipId
        : ORIENTATION_TRAINING_CLIPS[0].id;

    return {
      activeClipId,
      completedClipIds: filterClipIds(parsed.completedClipIds),
      furthestWatchedSeconds: filterProgress(parsed.furthestWatchedSeconds),
      reflections: filterReflections(parsed.reflections),
      watchedClipIds: filterClipIds(parsed.watchedClipIds),
    };
  } catch {
    return createEmptyOrientationTrainingProgress();
  }
}

export function getOrientationTrainingProgressStorageKey(profileId: string) {
  return STORAGE_KEY_PREFIX + ":" + profileId;
}

export function readOrientationTrainingProgress(
  storage: Pick<Storage, "getItem">,
  profileId: string,
) {
  try {
    return parseOrientationTrainingProgress(
      storage.getItem(getOrientationTrainingProgressStorageKey(profileId)),
    );
  } catch {
    return createEmptyOrientationTrainingProgress();
  }
}

export function writeOrientationTrainingProgress(
  storage: Pick<Storage, "setItem">,
  profileId: string,
  progress: OrientationTrainingProgress,
) {
  const storedProgress: StoredOrientationTrainingProgress = {
    ...progress,
    version: STORAGE_VERSION,
  };

  try {
    storage.setItem(
      getOrientationTrainingProgressStorageKey(profileId),
      JSON.stringify(storedProgress),
    );
  } catch {
    // Progress persistence is best effort when browser storage is unavailable.
  }
}
