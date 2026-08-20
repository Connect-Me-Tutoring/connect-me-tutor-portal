import { getRequestConfig } from "next-intl/server";
import { getUserLocale } from "./locale";

// Each namespace maps to messages/<locale>/<namespace>.json. Add an entry
// here whenever a new namespace file is introduced.
const namespaces = [
  "common",
  "auth",
  "settings",
  "adminEnrollments",
  "adminSchedule",
  "adminPeople",
  "adminOps",
  "tutorPages",
  "tutorSessions",
  "student",
  "pairing",
  "chat",
  "profileSessions",
  "dashboardMisc",
] as const;

export default getRequestConfig(async () => {
  const locale = await getUserLocale();

  const messages = Object.fromEntries(
    await Promise.all(
      namespaces.map(async (namespace) => [
        namespace,
        (await import(`../messages/${locale}/${namespace}.json`)).default,
      ]),
    ),
  );

  return { locale, messages };
});
