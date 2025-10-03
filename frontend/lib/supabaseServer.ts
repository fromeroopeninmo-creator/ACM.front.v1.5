// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

// Cliente Supabase para usar en Server Components / API Routes
export const supabaseServer = () => {
  return createServerComponentClient({ cookies });
};
