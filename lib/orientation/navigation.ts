export function isTutorNavigationRestricted(
  orientationEnabled: boolean,
  role: string | null | undefined,
  orientationCompletedAt: string | null | undefined,
) {
  return orientationEnabled && role === "Tutor" && !orientationCompletedAt;
}
