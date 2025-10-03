// lib/supabaseClient.ts
"use client";

import { createBrowserSupabaseClient } from "@supabase/auth-helpers-nextjs";

// Cliente Supabase para usar en componentes del lado del cliente
export const supabase = createBrowserSupabaseClient();
