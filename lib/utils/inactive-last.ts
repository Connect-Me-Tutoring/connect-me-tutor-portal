import { Profile } from "@/types";

/**
 * Returns a copy with Inactive profiles moved after Active ones (#807).
 * Stable: within each group the incoming order (e.g. newest first from
 * getAllProfiles) is kept. Doesn't mutate the input, since it's React state.
 */
export function inactiveLast<T extends Pick<Profile, "status">>(profiles: T[]): T[] {
  return [
    ...profiles.filter((p) => p.status !== "Inactive"),
    ...profiles.filter((p) => p.status === "Inactive"),
  ];
}
