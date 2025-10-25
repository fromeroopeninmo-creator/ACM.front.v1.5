export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

async function resolveUserRole(userId: string): Promise<Role | null> {
  const { data: p1 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (p1?.role) return p1.role as Role;

  const { data: p2 } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (p2?.role as Role) ?? null;
}

/** Escapa valores para CSV, respetando el delimitador elegido */
function csvEscape(v: any, delim: string) {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  const needsQuotes = s.includes('"') || s.includes("\n") || s.includes(delim);
  return needsQuotes ? `"${s}"` : s;
}

function toMoney(n: any) {
  if (n === null || n === undefined) return 0;
  const x = typeof n === "string" ? Number(n) : Number(n);
  return Number.isFinite(x) ? x : 0;
}

export async function GET(req: Request, { params }: { params: { empresaId: string } }) {
  try {
    // 0) Auth
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    // 1) Autorización
    const role = await resolveUserRole(userId);
    const allowed: Role[] = ["super_admin", "super_admin_root"];
    if (!role || !allowed.includes(role)) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    }

    // 2) Params
    const url = new URL(req.url);
    const empresaId = params.empresaId;
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");
    const estado = (url.searchParams.get("estado") || "") as "" | "pending" | "paid" | "failed" | "refunded";
    const tipo = (url.searchParams.get("tipo") || "") as "" | "subscription" | "extra_asesor" | "ajuste";
    const delim = url.searchParams.get("delim") || ";"; // ; por defecto (Excel es-AR)

    if (!empresaId) {
      return NextResponse.json({ error: "empresaId requerido en la URL." }, { status: 400 });
    }
    if (!desde || !hasta) {
      return NextResponse.json(
        { error: "Parámetros 'desde' y 'hasta' son requeridos (YYYY-MM-DD)." },
        { status: 400 }
      );
    }

    // 3) Empresa (para nombre/cuit)
    const { data: empRow, error: empErr } = await supabaseAdmin
      .from("empresas")
      .select("id, nombre_comercial, razon_social, cuit")
      .eq("id", empresaId)
      .maybeSingle();
    if (empErr) return NextResponse.json({ error: empErr.message }, { status: 400 });

    const empresaNombre = (empRow?.nombre_comercial || empRow?.razon_social || "") as string;
    const empresaCuit = (empRow?.cuit || "") as string;

    // 4) Movimientos desde ledger (si no existe ledger, devuelve CSV vacío con header)
    let q = supabaseAdmin
      .from("ledger")
      .select("id, fecha, tipo, concepto, estado, monto_neto, iva_21, total_con_iva")
      .eq("empresa_id", empresaId)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true });

    if (estado) q = q.eq("estado", estado);
    if (tipo) q = q.eq("tipo", tipo);

    const { data: rows, error: ledErr } = await q;
    if (ledErr) return NextResponse.json({ error: ledErr.message }, { status: 400 });

    // 5) CSV (BOM + sep= + header + filas)
    const headerCols = [
      "empresa_id",
      "empresa_nombre",
      "cuit",
      "fecha",
      "tipo",
      "concepto",
      "estado",
      "monto_neto",
      "iva_21",
      "total_con_iva",
    ];

    const sepLine = `sep=${delim}\n`;
    const header = headerCols.join(delim) + "\n";
    const lines = (rows || []).map((r: any) => {
      return [
        csvEscape(empresaId, delim),
        csvEscape(empresaNombre, delim),
        csvEscape(empresaCuit, delim),
        csvEscape(r.fecha, delim),
        csvEscape(r.tipo, delim),
        csvEscape(r.concepto, delim),
        csvEscape(r.estado, delim),
        toMoney(r.monto_neto),
        toMoney(r.iva_21),
        toMoney(r.total_con_iva),
      ].join(delim);
    });

    const csv = sepLine + header + lines.join("\n") + "\n";
    const bom = "\uFEFF";
    const body = bom + csv;

    const fnameBase = empresaNombre
      ? empresaNombre.normalize("NFKD").replace(/[^\w\-]+/g, "_")
      : empresaId;
    const headers = new Headers({
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="cashflow_${fnameBase}_${desde}_${hasta}.csv"`,
      "cache-control": "no-store",
    });

    return new NextResponse(body, { status: 200, headers });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado al exportar CSV." },
      { status: 500 }
    );
  }
}
