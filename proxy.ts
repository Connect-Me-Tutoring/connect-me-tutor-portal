import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATH_PREFIXES = ["/auth", "/set-password", "/forgot-password", "/contact"];

const PROTECTED_API_PREFIXES = ["/api/admin", "/api/pairing", "/api/qstash", "/api/sessions"];

function isPublicPath(path: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isProtectedApiPath(path: string) {
  return PROTECTED_API_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isCronOrWebhookPath(path: string) {
  return path.startsWith("/api/cron") || path.startsWith("/api/zoom") || path.startsWith("/ingest");
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

  if (user && path === "/") {
    return withSessionCookies(response, NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  if (!user && !isPublicPath(path) && !isCronOrWebhookPath(path)) {
    if (path.startsWith("/dashboard") || path.startsWith("/meeting")) {
      return withSessionCookies(response, NextResponse.redirect(new URL("/", request.url)));
    }

    if (isProtectedApiPath(path)) {
      return withSessionCookies(
        response,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }
  }

  return response;
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/api/:path*", "/meeting/:path*"],
};
