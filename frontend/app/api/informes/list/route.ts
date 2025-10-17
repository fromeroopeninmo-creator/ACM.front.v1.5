// frontend/app/api/informes/list/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "#lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const server = supabaseServer(); // ✅ sin cookies()
    const { data: userRes } = await server.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // Querystring ?page=1&perPage=20
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const perPage = Math.min(
      Math.max(parseInt(searchParams.get("perPage") || "20", 10), 1),
      100
    );
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    // Determinar empresa_id y rol de vista
    let empresa_id: string | null = null;
    let isEmpresa = false;

    // ¿Es empresa?
    {
      const { data: emp } = await server
        .from("empresas")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (emp?.id) {
        empresa_id = emp.id;
        isEmpresa = true;
      }
    }

    // ¿Es asesor?
    if (!empresa_id) {
      const { data: as } = await server
        .from("asesores")
        .select("empresa_id")
        .eq("id", user.id)
        .maybeSingle();
      if (as?.empresa_id) {
        empresa_id = as.empresa_id;
        isEmpresa = false;
      }
    }

    if (!empresa_id) {
      return NextResponse.json(
        { error: "No se pudo determinar la empresa asociada." },
        { status: 400 }
      );
    }

    // Consulta: empresa ve todos sus informes; asesor ve SOLO sus informes
    let query = server
      .from("informes")
      .select("id, empresa_id, autor_id, autor_role, titulo, tipo, created_at, thumb_path", {
        count: "exact",
      })
      .eq("empresa_id", empresa_id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!isEmpresa) {
      query = query.eq("autor_id", user.id); // Asesor: sólo los propios
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("❌ Error listando informes:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Si el bucket es público, podés enviar URL pública de thumb si existe
    const withUrls = (data || []).map((row) => {
      let thumb_url: string | null = null;
      if (row.thumb_path) {
        const { data: pub } = server.storage.from("informes").getPublicUrl(row.thumb_path);
        thumb_url = pub?.publicUrl || null;
      }
      return { ...row, thumb_url };
    });

    return NextResponse.json(
      {
        ok: true,
        page,
        perPage,
        total: count ?? 0,
        items: withUrls,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("💥 Error en /api/informes/list:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error interno del servidor." },
      { status: 500 }
    );
  }
}
