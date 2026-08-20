"use server";

import { cookies, headers } from "next/headers";
import { defaultLocale, isValidLocale, localeCookieName, type Locale } from "./config";

export async function getUserLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  if (isValidLocale(cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = (await headers()).get("accept-language");
  const preferred = acceptLanguage?.split(",")[0]?.split("-")[0];
  if (isValidLocale(preferred)) {
    return preferred;
  }

  return defaultLocale;
}

export async function setUserLocale(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set(localeCookieName, locale);
}
