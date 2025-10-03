import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Creamos cliente con cookies de la request
  const supabase = createMiddlewareClient({ req, res });

  // ✅ Refresca el token de sesión automáticamente en cada request
  await supabase.auth.getSession();

  return res;
}
