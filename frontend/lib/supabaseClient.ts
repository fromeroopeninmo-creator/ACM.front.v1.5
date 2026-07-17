"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/**
 * Cliente único de Supabase para componentes del App Router.
 *
 * createBrowserSupabaseClient quedó deprecado. Al exportarlo desde este módulo,
 * todos los contextos y componentes reutilizan la misma instancia.
 */
export const supabase = createClientComponentClient();
