import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Creamos cliente de supabase para leer sesión desde cookies
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 🔒 Redirigir al login si no hay sesión y quiere entrar a rutas protegidas
  if (!session && req.nextUrl.pathname.startsWith("/")) {
    if (
      !req.nextUrl.pathname.startsWith("/login") &&
      !req.nextUrl.pathname.startsWith("/register")
    ) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 🔑 Si hay sesión y quiere ir al login/registro → lo mando al home
  if (session && (req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/register")) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
