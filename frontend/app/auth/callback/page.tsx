"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "#lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  const [status, setStatus] = useState<"idle" | "checking" | "bootstrapping" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string>("Procesando verificación…");

  // Pequeño helper para leer params del redirect
  const getErrorFromQS = () => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const err = qs.get("error_description") || qs.get("error");
      return err || null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setStatus("checking");
      setMsg("Verificando sesión…");

      // 0) Si Supabase nos trae error en el redirect, lo mostramos de una
      const qsError = getErrorFromQS();
      if (qsError) {
        setStatus("error");
        setMsg(`No pudimos validar tu cuenta: ${qsError}`);
        return;
      }

      // 1) Esperar a que aparezca la sesion (a veces tarda ~1s tras el redirect)
      let tries = 0;
      let session = null as Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"];

      while (!session && tries < 6) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
        if (!session) {
          await new Promise((r) => setTimeout(r, 500));
          tries++;
        }
      }

      if (cancelled) return;

      if (!session) {
        setStatus("error");
        setMsg("No pudimos obtener tu sesión luego del correo de verificación. Probá iniciar sesión manualmente.");
        return;
      }

      // 2) Bootstrap en el backend (crear empresa + plan Trial si no existen)
      try {
        setStatus("bootstrapping");
        setMsg("Creando tu empresa y asignando plan de prueba…");

        const res = await fetch("/api/empresa/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // el backend puede leer al usuario desde la cookie (auth) o desde el body si lo necesitás
          body: JSON.stringify({}), 
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error || `Error ${res.status} inicializando tu cuenta`);
        }

        setStatus("done");
        setMsg("¡Listo! Redirigiendo a tu panel…");
        // 3) Redirigir al panel SEGÚN ROL (deja que /dashboard derive)
        router.replace("/dashboard");
      } catch (e: any) {
        setStatus("error");
        setMsg(e?.message || "Error inicializando tu cuenta.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const isLoading = status === "idle" || status === "checking" || status === "bootstrapping";

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-center">
        {isLoading ? (
          <>
            <div className="animate-pulse text-2xl mb-2">⏳</div>
            <h1 className="text-lg font-semibold">Verificando tu cuenta…</h1>
            <p className="text-gray-600 mt-2">{msg}</p>
          </>
        ) : status === "done" ? (
          <>
            <div className="text-2xl mb-2">✅</div>
            <h1 className="text-lg font-semibold">¡Cuenta verificada!</h1>
            <p className="text-gray-600 mt-2">{msg}</p>
          </>
        ) : (
          <>
            <div className="text-2xl mb-2">⚠️</div>
            <h1 className="text-lg font-semibold">No pudimos completar el proceso</h1>
            <p className="text-gray-600 mt-2">{msg}</p>
            <button
              onClick={() => router.push("/auth/login")}
              className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Ir a Iniciar Sesión
            </button>
          </>
        )}
      </div>
    </div>
  );
}
