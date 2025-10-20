// app/api/informes/create/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Base64Image = string | undefined | null;
const isBase64Image = (s: string | undefined | null) =>
  !!s && /^data:image\/(png|jpe?g);base64,/.test(s);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

async function uploadBase64Image(opts: {
  empresaId: string;
  informeId: string;
  base64: string;
  fileName: string;
  bucket?: string;
  maxWidth?: number;
}) {
  const { empresaId, informeId, base64, fileName, bucket = "informes", maxWidth = 800 } = opts;

  const match = base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.*)$/);
  if (!match) throw new Error("Formato base64 inválido");

  const data = Buffer.from(match[2], "base64");

  const resized = await sharp(data)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const path = `${empresaId}/${informeId}/${fileName}`;
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, resized, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;

  const { data: pub } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return pub.publicUrl;
}

async function resolveUserId(req: Request) {
  // 1) Intentar por cookies (SSR)
  const server = supabaseServer();
  const { data: auth } = await server.auth.getUser();
  let userId = auth?.user?.id ?? null;

  // 2) Fallback por Authorization: Bearer <JWT>
  if (!userId) {
    const authz = req.headers.get("authorization") || "";
    const jwt = authz.startsWith("Bearer ") ? authz.slice(7) : null;
    if (jwt) {
      const { data: userFromToken } = await supabaseAdmin.auth.getUser(jwt);
      userId = userFromToken.user?.id ?? null;
    }
  }
  return userId;
}

async function resolveEmpresaAsesor(userId: string) {
  let empresaId: string | null = null;
  let asesorId: string | null = null;
  let role: Role = "empresa";

  // role desde profiles (más estable que user_metadata en SSR)
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("id, role, empresa_id")
    .eq("id", userId)
    .maybeSingle();

  if (prof?.role) role = prof.role as Role;

  if (role === "asesor" && prof?.empresa_id) {
    asesorId = prof.id;
    empresaId = prof.empresa_id;
  } else {
    // ¿es empresa dueña?
    const { data: emp } = await supabaseAdmin
      .from("empresas")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (emp?.id) {
      empresaId = emp.id;
    } else if (prof?.empresa_id) {
      empresaId = prof.empresa_id;
    }
  }

  return { empresaId, asesorId, role };
}

export async function POST(req: Request) {
  try {
    // ========= 1) Usuario =========
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // ========= 2) Body =========
    const body = await req.json().catch(() => null as any);
    const {
      datos,
      titulo = "Informe VAI",
      id: incomingId,
      informeId: incomingInformeId, // por compatibilidad
    } = body || {};
    if (!datos) {
      return NextResponse.json({ error: "Faltan 'datos'." }, { status: 400 });
    }
    const targetId: string | null = incomingId || incomingInformeId || null;

    // ========= 3) Resolver empresa/asesor/rol =========
    const { empresaId, asesorId, role } = await resolveEmpresaAsesor(userId);
    if (!empresaId && role !== "soporte" && role !== "super_admin" && role !== "super_admin_root") {
      return NextResponse.json(
        { error: "No se pudo determinar la empresa del usuario." },
        { status: 400 }
      );
    }

    // ========= 4) Si viene id → UPDATE; si no → CREATE (con nuevo id) =========
    let informeId = targetId ?? "";
    let existente:
      | (Record<string, any> & {
          id: string;
          empresa_id: string | null;
          autor_id: string | null;
          imagen_principal_url?: string | null;
          comp1_url?: string | null;
          comp2_url?: string | null;
          comp3_url?: string | null;
          comp4_url?: string | null;
        })
      | null = null;

    if (targetId) {
      // Traer para validar ownership/rol
      const { data: inf, error: infErr } = await supabaseAdmin
        .from("informes")
        .select("*")
        .eq("id", targetId)
        .maybeSingle();
      if (infErr) {
        return NextResponse.json({ error: infErr.message }, { status: 400 });
      }
      if (!inf) {
        return NextResponse.json({ error: "Informe no encontrado." }, { status: 404 });
      }

      // Autorización de escritura
      if (role === "empresa") {
        if (!inf.empresa_id || !empresaId || inf.empresa_id !== empresaId) {
          return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
        }
      } else if (role === "asesor") {
        if (inf.autor_id !== userId) {
          return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
        }
      }
      // soporte/super_admin/* → permitido

      existente = inf as any;
      informeId = targetId;
    } else {
      // Generar id nuevo para CREATE
      try {
        const { data: idGen } = await supabaseAdmin.rpc("uuid_generate_v4");
        informeId = idGen ?? crypto.randomUUID();
      } catch {
        // @ts-ignore
        informeId = crypto.randomUUID();
      }
    }

    // ========= 5) Subir imágenes si vienen en base64 (solo pisa las provistas) =========
    // Si es update y no viene base64, conservamos la URL existente.
    let imagen_principal_url: string | null =
      existente?.imagen_principal_url ?? null;
    const compUrls: (string | null)[] = [
      existente?.comp1_url ?? null,
      existente?.comp2_url ?? null,
      existente?.comp3_url ?? null,
      existente?.comp4_url ?? null,
    ];

    const mainB64: Base64Image = datos?.mainPhotoBase64;
    if (isBase64Image(mainB64)) {
      imagen_principal_url = await uploadBase64Image({
        empresaId: empresaId || "admin",
        informeId,
        base64: mainB64!,
        fileName: "principal.jpg",
      });
    }

    if (Array.isArray(datos?.comparables)) {
      for (let i = 0; i < Math.min(datos.comparables.length, 4); i++) {
        const b64 = datos.comparables[i]?.photoBase64 as Base64Image;
        if (isBase64Image(b64)) {
          const url = await uploadBase64Image({
            empresaId: empresaId || "admin",
            informeId,
            base64: b64!,
            fileName: `comp${i + 1}.jpg`,
          });
          compUrls[i] = url;
        }
      }
    }

    // ========= 6) Limpiar base64 del JSON a guardar, y reflejar URLs (nuevas o existentes) =========
    const datosLimpios = {
      ...datos,
      mainPhotoBase64: undefined,
      mainPhotoUrl:
        imagen_principal_url || datos?.mainPhotoUrl || existente?.imagen_principal_url || "",
      comparables: Array.isArray(datos?.comparables)
        ? datos.comparables.map((c: any, idx: number) => ({
            ...c,
            photoBase64: undefined,
            photoUrl:
              compUrls[idx] || c.photoUrl || (existente ? (existente as any)[`comp${idx + 1}_url`] : "") || "",
          }))
        : [],
    };

    // ========= 7) CREATE o UPDATE en DB =========
    if (!targetId) {
      // CREATE
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("informes")
        .insert({
          id: informeId,
          empresa_id: empresaId,
          asesor_id: role === "asesor" ? userId : null,
          autor_id: userId,
          tipo: "VAI",
          titulo,
          datos_json: datosLimpios,
          imagen_principal_url,
          comp1_url: compUrls[0],
          comp2_url: compUrls[1],
          comp3_url: compUrls[2],
          comp4_url: compUrls[3],
          estado: "borrador",
          etiquetas: [],
        })
        .select()
        .maybeSingle();

      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, informe: inserted }, { status: 200 });
    } else {
      // UPDATE (sobrescritura)
      const { data: updated, error: updErr } = await supabaseAdmin
        .from("informes")
        .update({
          titulo,
          datos_json: datosLimpios,
          imagen_principal_url,
          comp1_url: compUrls[0],
          comp2_url: compUrls[1],
          comp3_url: compUrls[2],
          comp4_url: compUrls[3],
          // estado, etiquetas quedan como estén (o podrías permitir cambiarlas desde UI)
          updated_at: new Date().toISOString(),
        })
        .eq("id", informeId)
        .select()
        .maybeSingle();

      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, informe: updated }, { status: 200 });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado" },
      { status: 500 }
    );
  }
}
