// app/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Obtiene la sesión
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Si no hay sesión y quiere acceder a / (protegido), lo mandamos a /login
  if (!session && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Si ya hay sesión y quiere ir a /login, lo mandamos a home
  if (session && req.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return res;
}
