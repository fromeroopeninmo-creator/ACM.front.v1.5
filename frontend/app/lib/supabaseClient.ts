// app/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Nota: el "!" le indica a TypeScript que estas vars existen.
// Si preferís, podés validar y lanzar un error más claro:
// if (!url || !anon) throw new Error("Supabase env vars are missing");

export const supabase = createClient(url, anon);
