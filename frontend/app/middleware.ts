// frontend/app/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  // Importante: dejamos que /api/* y assets pasen sin tocarse desde el matcher (ver abajo).
  const res = NextResponse.next();

  const supabase = createMiddlewareClient({ req, res });

  // Refresca sesión si existe (evita enviar al login innecesariamente)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // Rutas públicas que no requieren autenticación
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname === "/" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml";

  // Si no hay sesión y la ruta no es pública → redirigir a /login
  if (!session && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    // (Opcional) Volver a la página original después de login:
    loginUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

// Muy importante: EXCLUIR /api/* del middleware
// para que no intercepte (ni redirija) tus endpoints de API.
// También excluimos assets y rutas públicas comunes.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|assets|.*\\.(png|jpg|jpeg|webp|svg|ico)).*)",
  ],
};
