// frontend/app/dashboard/empresa/planes/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "#lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

interface EmpresaPlan {
  plan_nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  max_asesores: number; // calculado: override ?? plan.max_asesores
}

interface Plan {
  id: string;
  nombre: string;
  max_asesores: number;
  precio?: number | string | null;
  duracion_dias?: number | null;
  precio_extra_por_asesor?: number | string | null; // Personalizado
}

type PreviewResult = {
  tipo?: "upgrade" | "downgrade" | "sin_cambio";
  accion?: "upgrade" | "downgrade" | "sin_cambio"; // compat viejo
  empresa_id: string;
  plan_actual?: { id: string; nombre: string; precio_neto?: number | null } | null;
  plan_nuevo?: { id: string; nombre: string; precio_neto?: number | null } | null;
  dias_ciclo?: number | null;
  dias_restantes?: number | null;
  delta_neto?: number;
  iva?: number;
  total?: number;
  aplicar_desde?: string | null; // para downgrade programado
  nota?: string | null;

  // compat viejo (estructura anidada)
  ciclo?: {
    inicio?: string;
    fin?: string;
    dias_ciclo?: number | null;
    dias_restantes?: number | null;
  };
  delta?: {
    neto?: number;
    iva?: number;
    total?: number;
    moneda?: string;
  };
};

export default function EmpresaPlanesPage() {
  const { user } = useAuth();

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [planActual, setPlanActual] = useState<EmpresaPlan | null>(null);
  const [planesDisponibles, setPlanesDisponibles] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Estado UI para “Personalizado”
  const [personalCount, setPersonalCount] = useState<number>(21); // 21..50

  // Preview prorrateo
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewConfirmLoading, setPreviewConfirmLoading] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{
    planId: string;
    personalizadoCount?: number;
  } | null>(null);

  // IVA
  const IVA_PCT = 0.21;

  // --- HELPERS PREVIEW NORMALIZADOS (para soportar backend viejo/nuevo) ---

  const previewTipo = useMemo<"upgrade" | "downgrade" | "sin_cambio" | null>(() => {
    if (!preview) return null;
    const anyPrev = preview as any;
    return anyPrev.tipo ?? anyPrev.accion ?? null;
  }, [preview]);

  const previewDiasCiclo = useMemo<number | null>(() => {
    if (!preview) return null;
    const anyPrev = preview as any;
    return (
      anyPrev.dias_ciclo ??
      anyPrev.ciclo?.dias_ciclo ??
      null
    );
  }, [preview]);

  const previewDiasRestantes = useMemo<number | null>(() => {
    if (!preview) return null;
    const anyPrev = preview as any;
    return (
      anyPrev.dias_restantes ??
      anyPrev.ciclo?.dias_restantes ??
      null
    );
  }, [preview]);

  const previewDeltaNeto = useMemo<number>(() => {
    if (!preview) return 0;
    const anyPrev = preview as any;
    return (
      anyPrev.delta_neto ??
      anyPrev.delta?.neto ??
      0
    );
  }, [preview]);

  const previewIva = useMemo<number>(() => {
    if (!preview) return 0;
    const anyPrev = preview as any;
    return (
      anyPrev.iva ??
      anyPrev.delta?.iva ??
      0
    );
  }, [preview]);

  const previewTotal = useMemo<number>(() => {
    if (!preview) return 0;
    const anyPrev = preview as any;
    return (
      anyPrev.total ??
      anyPrev.delta?.total ??
      0
    );
  }, [preview]);

  // 🔎 Resolver empresas.id
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!user?.id) return;
      const { data: emp, error } = await supabase
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("Error buscando empresa:", error);
        setEmpresaId(null);
        return;
      }
      setEmpresaId(emp?.id ?? null);
    };
    fetchEmpresa();
  }, [user]);

  // 📡 Plan actual + planes
  useEffect(() => {
    const fetchPlanes = async () => {
      if (!empresaId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Plan actual (traemos override)
        const { data: empresaPlan, error: errorEmpresaPlan } = await supabase
          .from("empresas_planes")
          .select(`
            plan_id,
            fecha_inicio,
            fecha_fin,
            activo,
            max_asesores_override,
            planes:plan_id (nombre, max_asesores)
          `)
          .eq("empresa_id", empresaId)
          .eq("activo", true)
          .maybeSingle();

        if (errorEmpresaPlan) {
          console.error("Error obteniendo plan actual:", errorEmpresaPlan);
          setPlanActual(null);
        } else if (empresaPlan) {
          const planDataRaw = (empresaPlan as any).planes;
          const planData = Array.isArray(planDataRaw) ? planDataRaw[0] : planDataRaw;
          const baseMax = planData?.max_asesores ?? 0;
          const override = (empresaPlan as any)?.max_asesores_override as number | null;
          setPlanActual({
            plan_nombre: planData?.nombre || "Sin plan",
            fecha_inicio: empresaPlan.fecha_inicio,
            fecha_fin: empresaPlan.fecha_fin,
            activo: empresaPlan.activo,
            max_asesores: override ?? baseMax, // ← usa override si está seteado
          });
          // si el plan activo es Personalizado, inicializamos el slider con el override o 21
          if ((planData?.nombre || "").toLowerCase() === "personalizado") {
            setPersonalCount(Math.max(21, Math.min(50, override ?? 21)));
          }
        } else {
          setPlanActual(null);
        }

        // Planes (ocultamos Trial y Desarrollo)
        const { data: planes, error: errorPlanes } = await supabase
          .from("planes")
          .select("id, nombre, max_asesores, precio, duracion_dias, precio_extra_por_asesor")
          .neq("nombre", "Trial")
          .neq("nombre", "Desarrollo")
          .order("max_asesores", { ascending: true });

        if (errorPlanes) {
          console.error("Error cargando planes:", errorPlanes);
        } else {
          setPlanesDisponibles(planes || []);
        }
      } catch (err) {
        console.error("Error cargando planes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanes();
  }, [empresaId]);

  // 🚀 Upgrade/Downgrade → Primero PREVIEW, luego CONFIRM
  const handleUpgrade = async (planId: string, opts?: { personalizadoCount?: number }) => {
    if (!empresaId) return;
    setMensaje("Calculando prorrateo...");
    setPreview(null);
    setPreviewTarget(null);

    try {
      // PREVIEW
      const qs = new URLSearchParams();
      qs.set("empresa_id", empresaId);
      qs.set("nuevo_plan_id", planId);
      if (typeof opts?.personalizadoCount === "number") {
        qs.set("max_asesores_override", String(opts.personalizadoCount));
      }

      const res = await fetch(`/api/billing/preview-change?${qs.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const data: any = await res.json();

      if (res.ok && data) {
        // Log simple para ver shape en consola (te ayuda a debuggear si algo falla)
        console.log("preview-change response:", data);
        setPreview(data as PreviewResult);
        setPreviewTarget({ planId, personalizadoCount: opts?.personalizadoCount });
        setPreviewVisible(true);
        setMensaje(null);
        return;
      }

      // Fallback: si aún no está el endpoint, usamos el flujo anterior (solicitud-upgrade)
      console.warn("preview-change no disponible. Fallback a /api/solicitud-upgrade");
      await legacyUpgrade(planId, opts);
    } catch (err) {
      console.error("Error en preview-change:", err);
      // Fallback seguro
      await legacyUpgrade(planId, opts);
    } finally {
      setTimeout(() => setMensaje(null), 2500);
    }
  };

  // Fallback histórico (tu endpoint existente)
  const legacyUpgrade = async (planId: string, opts?: { personalizadoCount?: number }) => {
    try {
      const body: any = { empresaId, planId };
      if (typeof opts?.personalizadoCount === "number") {
        body.maxAsesoresOverride = opts.personalizadoCount; // << enviar override al backend
      }

      const res = await fetch("/api/solicitud-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        console.error("Error desde API:", data.error || data);
        setMensaje("❌ No se pudo cambiar el plan. Intenta nuevamente.");
        return;
      }

      setMensaje(`✅ ${data.message}`);
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error("Error de red:", err);
      setMensaje("❌ No se pudo conectar al servidor.");
    } finally {
      setTimeout(() => setMensaje(null), 3500);
    }
  };

  const confirmPreview = async () => {
    if (!empresaId || !previewTarget) return;
    setPreviewConfirmLoading(true);
    setMensaje("Aplicando cambio de plan...");

    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          nuevo_plan_id: previewTarget.planId,
          max_asesores_override:
            typeof previewTarget.personalizadoCount === "number"
              ? previewTarget.personalizadoCount
              : undefined,
        }),
      });
      const data: any = await res.json();

      if (!res.ok || data?.error) {
        console.error("change-plan error:", data?.error || data);
        setMensaje("❌ No se pudo confirmar el cambio.");
        return;
      }

      // Caso upgrade → eventualmente redirigirá a checkout (cuando tengas pasarela real)
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }

      // Caso downgrade programado (o sin cobro) → refrescar
      setMensaje("✅ Cambio aplicado.");
      setPreviewVisible(false);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error("Error en change-plan:", err);
      setMensaje("❌ Error de red al confirmar cambio.");
    } finally {
      setPreviewConfirmLoading(false);
      setTimeout(() => setMensaje(null), 3000);
    }
  };

  // 💵 formato
  const fmtPrice = (p?: number | string | null) => {
    if (p == null) return "—";
    const val = typeof p === "string" ? parseFloat(p) : p;
    if (!isFinite(val)) return "—";
    if (val === 0) return "Gratis";
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(val);
  };
  const num = (x?: number | string | null) =>
    typeof x === "string" ? parseFloat(x) : (x ?? 0);

  const withIVA = (net?: number | string | null) => {
    if (net == null) return null;
    const n = typeof net === "string" ? parseFloat(net) : net;
    if (!isFinite(n)) return null;
    return Math.round(n * (1 + IVA_PCT));
  };

  // Premium base y extra unitario (para Personalizado)
  const premiumPrecio = useMemo(() => {
    const p = planesDisponibles.find((pl) => pl.nombre === "Premium");
    return num(p?.precio);
  }, [planesDisponibles]);

  const extraUnitPrice = useMemo(() => {
    const p = planesDisponibles.find((pl) => pl.nombre === "Personalizado");
    return num(p?.precio_extra_por_asesor);
  }, [planesDisponibles]);

  const personalizadoNeto = useMemo(() => {
    const extra = Math.max(0, personalCount - 20);
    return premiumPrecio + extra * extraUnitPrice;
  }, [personalCount, premiumPrecio, extraUnitPrice]);

  const personalizadoTotalConIVA = useMemo(
    () => withIVA(personalizadoNeto),
    [personalizadoNeto]
  );

  const planActualNombre = useMemo(
    () => (planActual?.plan_nombre ? planActual.plan_nombre : "Sin plan"),
    [planActual]
  );

  // Renombre visual “Pro” → “Profesional”
  const displayPlanName = (n: string) => (n === "Pro" ? "Profesional" : n);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh] text-gray-500">
        Cargando información de planes…
      </div>
    );
  }

  const esTrial = planActual?.plan_nombre === "Trial";

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <section className="bg-white shadow-sm rounded-xl p-6">
        <h1 className="text-2xl font-semibold">Suscripción Mensual</h1>
        <p className="text-gray-600 mt-1">
          Plan actual:{" "}
          <span className="font-semibold">{planActualNombre}</span>{" "}
          {planActual?.max_asesores ? (
            <span className="text-gray-500">
              ({planActual.max_asesores} asesores)
            </span>
          ) : null}
        </p>
      </section>

      {/* Plan actual */}
      {planActual ? (
        <section className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {planActual.plan_nombre}
              </h2>
              <p className="text-sm text-gray-600">
                Asesores permitidos:{" "}
                <strong>{planActual.max_asesores}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Inicio:{" "}
                {new Date(planActual.fecha_inicio).toLocaleDateString("es-AR")}
              </p>
              <p className="text-sm text-gray-600">
                Vencimiento:{" "}
                {new Date(planActual.fecha_fin).toLocaleDateString("es-AR")}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded self-start ${
                planActual.activo
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {planActual.activo ? "Activo" : "Inactivo"}
            </span>
          </div>

          {esTrial && (
            <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              🔸 Estás usando el plan <strong>Trial</strong> (prueba gratuita
              de 7 días). No podés agregar asesores con este plan. Realizá un{" "}
              <strong>upgrade</strong> para habilitar tus asesores.
            </p>
          )}
        </section>
      ) : (
        <section className="bg-white shadow-sm rounded-xl p-6 border border-dashed border-gray-300">
          <p className="text-gray-600">No se encontró un plan activo.</p>
        </section>
      )}

      {/* Planes */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Planes disponibles</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planesDisponibles.map((plan) => {
            const isActive = plan.nombre === planActual?.plan_nombre;
            const isPersonalizado = plan.nombre === "Personalizado";

            // Neto y total con IVA para planes no personalizados
            const neto = num(plan.precio);
            const totalConIVA = withIVA(neto);

            return (
              <div
                key={plan.id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow transition flex flex-col"
              >
                <div className="mb-4">
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-xl font-semibold text-blue-700">
                      {displayPlanName(plan.nombre)}
                    </h3>
                    <span className="text-sm text-gray-500">
                      {plan.duracion_dias
                        ? `${plan.duracion_dias} días`
                        : ""}
                    </span>
                  </div>

                  {!isPersonalizado ? (
                    <>
                      {/* Precio grande: neto + IVA (literal) */}
                      <div className="mt-2">
                        <div className="text-2xl font-bold">
                          {fmtPrice(neto)}{" "}
                          <span className="text-base font-semibold">
                            + IVA
                          </span>
                        </div>
                        {/* Debajo: total final */}
                        <div className="text-xs text-gray-600">
                          Total:{" "}
                          {totalConIVA != null ? fmtPrice(totalConIVA) : "—"}
                        </div>
                      </div>

                      {/* Bullets visuales (incluye “Hasta X asesores”) */}
                      <ul className="mt-3 text-sm text-gray-700 space-y-1">
                        <li>
                          <strong>
                            • Hasta {plan.max_asesores} asesores
                          </strong>
                        </li>
                        <li>• Sin límites de informes</li>
                        <li>• Guarda / Carga / Edita tus informes</li>
                        <li>• Informe descargable en PDF</li>
                      </ul>
                    </>
                  ) : (
                    <>
                      {/* Card especial Personalizado */}
                      <div className="mt-2 space-y-2">
                        <div className="mt-3">
                          <label className="block text-sm text-gray-600 mb-1">
                            Cantidad de asesores
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={21}
                              max={50}
                              value={personalCount}
                              onChange={(e) =>
                                setPersonalCount(
                                  parseInt(e.target.value || "21", 10)
                                )
                              }
                              className="w-full"
                            />
                            <input
                              type="number"
                              min={21}
                              max={50}
                              value={personalCount}
                              onChange={(e) => {
                                const v = Math.max(
                                  21,
                                  Math.min(
                                    50,
                                    parseInt(e.target.value || "21", 10)
                                  )
                                );
                                setPersonalCount(v);
                              }}
                              className="w-20 border rounded-lg px-2 py-1"
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            De 21 a 50 asesores (incluidos).
                          </div>
                        </div>

                        {/* Precio personalizado: grande “Total: $neto + IVA”, abajo total final */}
                        <div className="mt-3">
                          <div className="text-2xl font-bold">
                            Total: {fmtPrice(personalizadoNeto)}{" "}
                            <span className="text-base font-semibold">
                              + IVA
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            Total:{" "}
                            {fmtPrice(personalizadoTotalConIVA ?? 0)}
                          </div>
                        </div>

                        {/* Bullets */}
                        <ul className="mt-3 text-sm text-gray-700 space-y-1">
                          <li>
                            <strong>
                              • Hasta {personalCount} asesores
                            </strong>
                          </li>
                          <li>• Sin límites de informes</li>
                          <li>• Guarda / Carga / Edita tus informes</li>
                          <li>• Informe descargable en PDF</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>

                {/* Botón */}
                {!isPersonalizado ? (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isActive}
                    className={`mt-auto w-full py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isActive ? "Plan actual" : "Seleccionar plan"}
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      handleUpgrade(plan.id, {
                        personalizadoCount: personalCount,
                      })
                    }
                    disabled={
                      isActive &&
                      planActual?.max_asesores === personalCount
                    }
                    className={`mt-auto w-full py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive &&
                      planActual?.max_asesores === personalCount
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isActive
                      ? planActual?.max_asesores === personalCount
                        ? "Plan actual"
                        : "Actualizar cupo"
                      : "Seleccionar plan"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Mensaje temporal */}
      {mensaje && (
        <p className="text-center text-blue-600 font-medium">{mensaje}</p>
      )}

      {/* MODAL PREVIEW PRORRATEO */}
      {previewVisible && preview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-2">
              Confirmar cambio de plan
            </h3>

            <div className="text-sm text-gray-700 space-y-1 mb-3">
              {preview.plan_actual?.nombre && preview.plan_nuevo?.nombre ? (
                <p>
                  {preview.plan_actual.nombre} →{" "}
                  <strong>{preview.plan_nuevo.nombre}</strong>
                </p>
              ) : null}
              {previewDiasRestantes !== null &&
              previewDiasCiclo !== null ? (
                <p>
                  Días restantes:{" "}
                  <strong>{previewDiasRestantes}</strong> de{" "}
                  {previewDiasCiclo}
                </p>
              ) : null}
            </div>

            {previewTipo === "upgrade" && (
              <div className="border rounded-lg p-3 mb-3 bg-emerald-50 border-emerald-200">
                <p className="text-sm">
                  Delta neto:{" "}
                  <strong>{fmtPrice(previewDeltaNeto)}</strong>
                </p>
                <p className="text-sm">
                  IVA (21%):{" "}
                  <strong>{fmtPrice(previewIva)}</strong>
                </p>
                <p className="text-sm">
                  Total a pagar ahora:{" "}
                  <strong>{fmtPrice(previewTotal)}</strong>
                </p>
              </div>
            )}

            {previewTipo === "downgrade" && (
              <div className="border rounded-lg p-3 mb-3 bg-amber-50 border-amber-200">
                <p className="text-sm">
                  El cambio se aplicará desde:{" "}
                  <strong>
                    {preview.aplicar_desde
                      ? new Date(
                          preview.aplicar_desde
                        ).toLocaleDateString("es-AR")
                      : "próximo ciclo"}
                  </strong>
                </p>
                <p className="text-xs text-gray-600">
                  No se generan créditos ni reembolsos. Seguirás usando tu
                  plan actual hasta esa fecha.
                </p>
              </div>
            )}

            {preview.nota && (
              <p className="text-xs text-gray-500 mb-2">
                {preview.nota}
              </p>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => {
                  setPreviewVisible(false);
                  setPreview(null);
                  setPreviewTarget(null);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                disabled={previewConfirmLoading}
              >
                Cancelar
              </button>
              <button
                onClick={confirmPreview}
                className={`px-4 py-2 rounded-lg text-sm text-white ${
                  previewTipo === "upgrade"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-700 hover:bg-gray-800"
                } ${
                  previewConfirmLoading
                    ? "opacity-70 cursor-not-allowed"
                    : ""
                }`}
                disabled={previewConfirmLoading}
              >
                {previewConfirmLoading
                  ? "Aplicando..."
                  : previewTipo === "upgrade"
                  ? "Pagar diferencia"
                  : "Confirmar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
