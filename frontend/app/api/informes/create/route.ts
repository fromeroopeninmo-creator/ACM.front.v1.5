export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

type CreateBody = {
  titulo?: string;
  data: any;            // JSON del informe (obligatorio)
  fotos?: string[];     // URLs públicas (opcional)
};

export async function POST(req: Request) {
  try {
    const server = supabaseServer();
    const { data: userRes } = await server.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = (await req.json()) as CreateBody | null;
    if (!body || body.data == null) {
      return NextResponse.json(
        { error: "Falta 'data' (JSON del informe)." },
        { status: 400 }
      );
    }

    const titulo = (body.titulo ?? "").toString().trim() || "Informe";
    const fotos = Array.isArray(body.fotos) ? body.fotos.slice(0, 5) : [];

    // Resolver empresa_id según el rol:
    // - empresa: buscar empresas.id donde user_id = auth.uid()
    // - asesor:  buscar asesores.empresa_id donde asesores.id = auth.uid()
    // (admins/soporte: por ahora bloqueamos; si luego quieres habilitarlo, lo ajustamos)
    let empresaId: string | null = null;
    const role =
      (user.user_metadata as any)?.role ||
      (user as any)?.role ||
      "empresa";

    if (role === "empresa") {
      const { data: emp, error: empErr } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (empErr) {
        return NextResponse.json(
          { error: empErr.message || "Error obteniendo empresa." },
          { status: 400 }
        );
      }
      if (!emp?.id) {
        return NextResponse.json(
          { error: "No se encontró empresa asociada al usuario." },
          { status: 400 }
        );
      }
      empresaId = emp.id;
    } else if (role === "asesor") {
      const { data: as, error: asErr } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();

      if (asErr) {
        return NextResponse.json(
          { error: asErr.message || "Error obteniendo empresa del asesor." },
          { status: 400 }
        );
      }
      if (!as?.empresa_id) {
        return NextResponse.json(
          { error: "El asesor no tiene empresa asociada." },
          { status: 400 }
        );
      }
      empresaId = as.empresa_id;
    } else {
      return NextResponse.json(
        { error: "Solo empresas y asesores pueden crear informes por ahora." },
        { status: 403 }
      );
    }

    // Insert limpio: solo columnas existentes en la tabla
    const { data: inserted, error: insErr } = await server
      .from("informes")
      .insert([
        {
          empresa_id: empresaId,
          autor_id: user.id,
          titulo,
          data: body.data,
          fotos, // text[] en la tabla
        },
      ])
      .select("id")
      .maybeSingle();

    if (insErr) {
      return NextResponse.json(
        { error: insErr.message || "Error creando informe." },
        { status: 400 }
      );
    }

    return NextResponse.json({ id: inserted?.id || null });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error interno." },
      { status: 500 }
    );
  }
}
