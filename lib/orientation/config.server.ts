import "server-only";

export const isTutorOrientationEnabled = () => process.env.TUTOR_ORIENTATION_ENABLED === "true";

export const canViewTutorOrientation = (role: string | null | undefined) =>
  role === "Tutor" || role === "Admin";
