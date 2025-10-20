// frontend/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  // Importante: /api/* y assets están excluidos por el matcher (ver abajo).
  const res = NextResponse.next();

  const supabase = createMiddlewareClient({ req, res });

  // Refrescar sesión si existe
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname, search } = req.nextUrl;

  // Rutas públicas
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";

  // Si no hay sesión y la ruta no es pública → redirigir a /login
  if (!session && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    // Volver a la página original tras login
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

// EXCLUIR /api y assets básicos del middleware
export const config = {
  matcher: [
    // Cubre todo excepto estas rutas:
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
