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
    let timeoutId: number | undefined;

    const run = async () => {
      setStatus("checking");
      setMsg("Verificando enlace de verificación…");

      const qsError = getErrorFromQS();
      if (qsError) {
        console.warn("[auth/callback] error en querystring:", qsError);

        if (cancelled) return;

        setStatus("error");
        setMsg(
          `No pudimos validar tu cuenta: ${qsError}. Probá solicitar un nuevo enlace o iniciar sesión manualmente.`
        );
        return;
      }

      // 🧩 En este flujo asumimos:
      // - Si Supabase llegó hasta acá con el token OK, el email ya fue verificado.
      // - La empresa/usuario ya se crean vía triggers en BD.
      // Por lo tanto, NO intentamos crear sesión automática ni llamar a /api/empresa/bootstrap.
      if (cancelled) return;

      setStatus("done");
      setMsg(
        "Tu email fue verificado correctamente. Ahora iniciá sesión con tu email y contraseña para acceder a tu panel."
      );

      // Redirigir automáticamente al login luego de unos segundos
      timeoutId = window.setTimeout(() => {
        if (!cancelled) {
          router.replace("/auth/login");
        }
      }, 3500);
    };

    run();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
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
            {/* Este bloque se muestra solo si hubo un error explícito en el enlace */}
            <div className="text-2xl mb-2">⚠️</div>
            <h1 className="text-lg font-semibold">
              No pudimos completar el proceso
            </h1>
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
