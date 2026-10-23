export function requiresTutorOrientation(
  role: string | null | undefined,
  orientationCompletedAt: string | null | undefined,
) {
  return role === "Tutor" && !orientationCompletedAt;
}

export function isTutorNavigationRestricted(
  orientationEnabled: boolean,
  role: string | null | undefined,
  orientationCompletedAt: string | null | undefined,
) {
  return orientationEnabled && requiresTutorOrientation(role, orientationCompletedAt);
}
