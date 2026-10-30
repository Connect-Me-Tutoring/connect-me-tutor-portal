import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasTutorOrientationAccess } from "@/lib/orientation/config.server";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { isBearerTokenAuthorized } from "@/lib/security/bearer-token";

const PUBLIC_PATHS = [
  "/",
  "/auth",
  "/forgot-password",
  "/set-password",
  "/contact",
  "/privacy",
  "/parental-consent",
];
const SELF_VERIFYING_API_PATHS = ["/api/zoom", "/api/session-exit-form"];
const ORIENTATION_PATHS = ["/orientation", "/api/orientation"];

function isPublicPath(path: string) {
  return PUBLIC_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isSelfVerifyingApiPath(path: string) {
  return SELF_VERIFYING_API_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function isOrientationPath(path: string) {
  return ORIENTATION_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function withSessionCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  return target;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const path = request.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: settings, error: profileError } = await supabase
      .from("user_settings")
      .select("profile:Profiles!last_active_profile_id(id, email, role, orientation_completed_at)")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Unable to check tutor orientation status in proxy", profileError);
    }

    const selectedProfile = settings?.profile;
    const profile = Array.isArray(selectedProfile) ? selectedProfile[0] : selectedProfile;
    const orientationRequired =
      profile?.role === "Tutor" &&
      !profile.orientation_completed_at &&
      (await hasTutorOrientationAccess(profile));
    const isPublicAccountPath = isPublicPath(path) && path !== "/";

    if (orientationRequired && !isOrientationPath(path) && !isPublicAccountPath) {
      if (path.startsWith("/api/")) {
        return withSessionCookies(
          response,
          NextResponse.json(
            { error: "Complete tutor orientation before accessing the portal." },
            { status: 403 },
          ),
        );
      }

      return withSessionCookies(
        response,
        NextResponse.redirect(new URL("/orientation", request.url)),
      );
    }
  }

  if (user && path === "/") {
    return withSessionCookies(response, NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  const isExempt =
    !!user ||
    isPublicPath(path) ||
    isSelfVerifyingApiPath(path) ||
    isCronRequestAuthorized(request) ||
    isBearerTokenAuthorized(request);

  if (!isExempt) {
    if (path.startsWith("/api/")) {
      return withSessionCookies(
        response,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    return withSessionCookies(response, NextResponse.redirect(new URL("/", request.url)));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|ingest/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
