import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // Rutas públicas
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    if (session) {
      // Si ya está logueado, lo mando a home
      return NextResponse.redirect(new URL("/", req.url));
    }
    return res;
  }

  // Rutas protegidas
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
