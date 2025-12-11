// app/auth/callback/page.tsx
"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "#lib/supabaseClient";

type Status = "idle" | "checking" | "bootstrapping" | "done" | "error";

export default function AuthCallbackPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string>("Procesando verificación…");

  // Leer posible error en el querystring del redirect de Supabase (solo para logging)
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

      const qsError = getErrorFromQS();
      if (qsError) {
        console.warn("[auth/callback] error en querystring:", qsError);
      }

      // 0) Intentar intercambiar el código del enlace por una sesión (no es fatal si falla)
      try {
        const fullUrl =
          typeof window !== "undefined" ? window.location.href : "";
        if (fullUrl) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(fullUrl);
          if (exchangeError) {
            console.warn(
              "[auth/callback] exchangeCodeForSession error:",
              exchangeError.message || exchangeError
            );
          }
        }
      } catch (err) {
        console.error("[auth/callback] excepción en exchangeCodeForSession:", err);
      }

      // 1) Esperar a que aparezca la sesión (puede tardar un poco tras el redirect)
      let tries = 0;
      let session:
        | Awaited<
            ReturnType<typeof supabase.auth.getSession>
          >["data"]["session"]
        | null = null;

      while (!session && tries < 6) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
        if (!session) {
          await new Promise((r) => setTimeout(r, 500));
          tries++;
        }
      }

      if (cancelled) return;

      // 🧩 Caso 1: NO hay sesión, pero igual llegamos desde el mail.
      // En tu flujo, la cuenta ya está creada y el mail ya se verificó.
      // Mostramos mensaje de éxito y pedimos iniciar sesión manualmente.
      if (!session) {
        setStatus("done");
        setMsg(
          "Tu email ya fue verificado o está en proceso. Ahora iniciá sesión con tu email y contraseña para acceder a tu panel."
        );
        return;
      }

      // 🧩 Caso 2: SÍ hay sesión -> hacemos bootstrap como best-effort
      try {
        setStatus("bootstrapping");
        setMsg("Creando tu empresa y asignando plan de prueba…");

        const res = await fetch("/api/empresa/bootstrap", {
          method: "POST",
          cache: "no-store",
        });

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          console.error(
            "[auth/callback] Error en /api/empresa/bootstrap:",
            res.status,
            j
          );
          // No lanzamos: no rompemos la UX aunque falle el bootstrap.
        }
      } catch (e) {
        console.error(
          "[auth/callback] Excepción llamando /api/empresa/bootstrap:",
          e
        );
        // Tampoco lanzamos: tu empresa ya se crea por triggers en BD.
      }

      if (cancelled) return;

      setStatus("done");
      setMsg("¡Listo! Redirigiendo a tu panel…");
      router.replace("/dashboard");
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const isLoading =
    status === "idle" || status === "checking" || status === "bootstrapping";

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
            {/* En el caso sin sesión, el usuario verá este bloque y usará el botón para ir al login */}
            <button
              onClick={() => router.push("/auth/login")}
              className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Ir a Iniciar Sesión
            </button>
          </>
        ) : (
          <>
            {/* Este bloque debería ser ya muy poco frecuente; solo errores inesperados */}
            <div className="text-2xl mb-2">⚠️</div>
            <h1 className="text-lg font-semibold">
              No pudimos completar el proceso
            </h1>
            <p className="text-gray-600 mt-2">
              Ocurrió un error inesperado. Probá iniciar sesión manualmente con
              tu email y contraseña. Si el problema persiste, contactanos.
            </p>
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
