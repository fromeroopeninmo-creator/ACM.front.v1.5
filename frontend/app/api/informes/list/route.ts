// app/api/informes/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Scope = "empresa" | "asesor";
type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

export async function GET(req: Request) {
  try {
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const userId = auth?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get("scope") as Scope) || null;

    // ---------------- Resolver role + empresa_id ----------------
    let role: Role = "empresa";
    let empresaId: string | null = null;

    // ¿Es empresa dueña?
    const { data: emp } = await supabaseAdmin
      .from("empresas")
      .select("id, user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (emp?.id) {
      role = "empresa";
      empresaId = emp.id;
    } else {
      // ¿Perfil (asesor/soporte/admin)?
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id, role, empresa_id")
        .eq("id", userId)
        .maybeSingle();

      if (prof?.role) role = prof.role as Role;
      if (prof?.empresa_id) empresaId = prof.empresa_id;
    }

    // ---------------- Construir query base ----------------
    let query = supabaseAdmin
      .from("informes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (scope === "empresa") {
      if (!empresaId) {
        return NextResponse.json({ ok: true, items: [], informes: [], total: 0 }, { status: 200 });
      }
      query = query.eq("empresa_id", empresaId);
    } else if (scope === "asesor") {
      // Mantengo tu comportamiento actual: listar por autor_id (el usuario que lo creó)
      query = query.eq("autor_id", userId);
    } else {
      // default: si sos empresa, por empresa; si sos asesor, por autor_id
      if (role === "empresa" && empresaId) {
        query = query.eq("empresa_id", empresaId);
      } else {
        query = query.eq("autor_id", userId);
      }
    }

    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const informes = (data ?? []) as any[];

    if (informes.length === 0) {
      return NextResponse.json(
        { ok: true, items: [], informes: [], total: 0 },
        { status: 200 }
      );
    }

    // ---------------- Enriquecer con datos del asesor ----------------
    // Tomamos asesor_id de cada informe (puede ser null si lo creó la empresa)
    const asesorIds = Array.from(
      new Set(
        informes
          .map((r) => r.asesor_id)
          .filter((v: string | null | undefined) => !!v)
      )
    ) as string[];

    let asesoresMap = new Map<string, { email: string | null }>();
    let perfilesMap = new Map<string, { nombre: string | null; apellido: string | null }>();

    if (asesorIds.length > 0) {
      // a) Email de asesores
      const { data: asesores, error: asesErr } = await supabaseAdmin
        .from("asesores")
        .select("id, email")
        .in("id", asesorIds);

      if (!asesErr && Array.isArray(asesores)) {
        asesores.forEach((a: any) => {
          asesoresMap.set(a.id, { email: a.email || null });
        });
      }

      // b) Nombre/Apellido desde profiles
      const { data: perfiles, error: perfErr } = await supabaseAdmin
        .from("profiles")
        .select("id, nombre, apellido")
        .in("id", asesorIds);

      if (!perfErr && Array.isArray(perfiles)) {
        perfiles.forEach((p: any) => {
          perfilesMap.set(p.id, {
            nombre: p.nombre || null,
            apellido: p.apellido || null,
          });
        });
      }
    }

    // ---------------- Normalización para el front ----------------
    const enrich = (inf: any) => {
      const asesorId: string | null = inf.asesor_id ?? null;

      const email = asesorId ? asesoresMap.get(asesorId)?.email ?? null : null;
      const nombre = asesorId ? perfilesMap.get(asesorId)?.nombre ?? null : null;
      const apellido = asesorId ? perfilesMap.get(asesorId)?.apellido ?? null : null;

      const autor_nombre =
        (nombre && apellido ? `${nombre} ${apellido}`.trim() : null) || email || null;

      // Fallbacks para visual
      const cliente =
        inf?.datos_json?.clientName ??
        inf?.datos_json?.cliente ??
        null;

      const tipologia =
        inf?.datos_json?.propertyType ??
        inf?.datos_json?.tipologia ??
        null;

      return {
        ...inf,
        autor_nombre,
        asesor_email: email,
        cliente,
        tipologia,
      };
    };

    const informesEnriquecidos = informes.map(enrich);

    // Items “plano” para UIs viejas + mantener compat
    const items = informesEnriquecidos.map((inf: any) => ({
      id: inf.id,
      titulo: inf.titulo,
      tipo: inf.tipo,
      empresa_id: inf.empresa_id,
      autor_id: inf.autor_id,
      estado: inf.estado,
      created_at: inf.created_at ?? inf.fecha_creacion ?? null,
      updated_at: inf.updated_at ?? null,
      imagen_principal_url: inf.imagen_principal_url ?? null,

      // Campos que ahora usa la UI (EmpresaInformesPage)
      autor_nombre: inf.autor_nombre ?? null,
      asesor_email: inf.asesor_email ?? null,
      datos_json: inf.datos_json ?? null,
      cliente: inf.cliente ?? null,
      tipologia: inf.tipologia ?? null,
    }));

    return NextResponse.json(
      {
        ok: true,
        items,                    // para UIs que usan "items"
        informes: informesEnriquecidos, // para UIs que usan "informes"
        total: count ?? items.length,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Error inesperado" }, { status: 500 });
  }
}
