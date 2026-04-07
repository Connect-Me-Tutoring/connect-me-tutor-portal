import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import {
  createMiddlewareClient,
  SupabaseClient,
  User,
} from "@supabase/auth-helpers-nextjs";

async function verifyAdminMiddleware(user: User, supabase: SupabaseClient) {
  if (!user) throw new Error("Unauthenticated error");
  const { data: profile } = await supabase
    .from("Profiles")
    .select("role")
    .eq("user_id", user.id)
    .single()
    .throwOnError();

  if (profile.role !== "Admin") throw new Error("Unauthorized error");
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const path = req.nextUrl.pathname;

  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (path === "/") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    } 
  }

  return res; // keep response as fallback
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/api/:path*",
    "/meeting/:path*",
  ],
};

/**
 * const publicUrls = ["/set-password", "/auth", "/contact"];
      if (publicUrls.some((url) => path.startsWith(url))) {
        return res;
      }
 */
