// app/api/auth/dev-signup/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * IMPORTANTE:
 *  - Usa la Service Role Key: NO expongas esta ruta al público en producción.
 *  - Pensada solo para “modo desarrollo” cuando el signup normal falla.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mapea algunos mensajes comunes de Supabase → HTTP status razonable
function mapSupabaseErrorToStatus(message?: string): number {
  const msg = (message || "").toLowerCase();

  if (
    msg.includes("duplicate key") ||
    msg.includes("already registered") ||
    msg.includes("user already exists") ||
    msg.includes("email rate limit exceeded")
  ) {
    return 409; // conflicto / ya existe
  }

  if (
    msg.includes("invalid") ||
    msg.includes("malformed") ||
    msg.includes("password") ||
    msg.includes("email")
  ) {
    return 422; // datos inválidos
  }

  if (msg.includes("permission") || msg.includes("not allowed")) {
    return 403; // prohibido
  }

  return 500; // genérico
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const clean = (v: string) => (typeof v === "string" ? v.trim() : v);

    const {
      email,
      password,
      nombre,
      apellido,
      telefono,
      direccion,
      localidad,
      provincia,
      razonSocial,
      inmobiliaria,
      condicionFiscal,
      cuit,
    } = body || {};

    if (
      !email ||
      !password ||
      !nombre ||
      !apellido ||
      !telefono ||
      !direccion ||
      !localidad ||
      !provincia ||
      !razonSocial ||
      !inmobiliaria ||
      !condicionFiscal ||
      !cuit
    ) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios." },
        { status: 400 }
      );
    }

    // 1) Crear user confirmado
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: clean(email),
        password: clean(password),
        email_confirm: true,
        user_metadata: {
          nombre: clean(nombre),
          apellido: clean(apellido),
          telefono: clean(telefono),
          direccion: clean(direccion),
          localidad: clean(localidad),
          provincia: clean(provincia),
          razon_social: clean(razonSocial),
          inmobiliaria: clean(inmobiliaria),
          condicion_fiscal: clean(condicionFiscal),
          cuit: clean(cuit),
          role: "empresa",
        },
      });

    if (createErr || !created?.user?.id) {
      const status = mapSupabaseErrorToStatus(createErr?.message);
      return NextResponse.json(
        { error: createErr?.message || "No se pudo crear el usuario (admin)." },
        { status }
      );
    }

    const userId = created.user.id;

    // 2) Insertar empresa y devolver su id
    const { data: empresaRow, error: empErr } = await supabaseAdmin
      .from("empresas")
      .insert([
        {
          user_id: userId,
          nombre_comercial: clean(inmobiliaria),
          razon_social: clean(razonSocial),
          cuit: clean(cuit),
          matriculado: `${clean(nombre)} ${clean(apellido)}`,
          telefono: clean(telefono),
          direccion: clean(direccion),
          localidad: clean(localidad),
          provincia: clean(provincia),
          condicion_fiscal: clean(condicionFiscal),
          color: "#E6A930",
          logo_url: "",
        },
      ])
      .select("id")
      .single();

    if (empErr || !empresaRow?.id) {
      // Cleanup: si falló empresa, borrar user
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (e: any) {
        console.warn("Cleanup: fallo al borrar usuario tras error en empresa:", e?.message || e);
      }

      const status = mapSupabaseErrorToStatus(empErr?.message);
      return NextResponse.json(
        { error: `Error creando empresa: ${empErr?.message || "desconocido"}` },
        { status }
      );
    }

    const empresaId = empresaRow.id;

    // 3) (Opcional) Insertar profile enlazado a la empresa con rol "empresa"
    //    Si esta tabla/flujo no existe en tu esquema, podés retirarlo sin problemas.
    const { error: profErr } = await supabaseAdmin.from("profiles").insert([
      {
        id: userId, // si tu PK de profiles es uuid del user
        email: clean(email),
        nombre: clean(nombre),
        apellido: clean(apellido),
        role: "empresa",
        empresa_id: empresaId,
        telefono: clean(telefono),
      },
    ]);

    if (profErr) {
      // Cleanup: borrar empresa + user para no dejar huérfanos
      try {
        await supabaseAdmin.from("empresas").delete().eq("id", empresaId);
      } catch (e: any) {
        console.warn("Cleanup: fallo al borrar empresa:", e?.message || e);
      }

      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (e: any) {
        console.warn("Cleanup: fallo al borrar usuario:", e?.message || e);
      }

      const status = mapSupabaseErrorToStatus(profErr?.message);
      return NextResponse.json(
        { error: `Error creando profile: ${profErr.message}` },
        { status }
      );
    }

    // (Opcional) emitir una sesión aquí si quisieras auto-login;
    // en general lo dejamos para el login normal.
    return NextResponse.json({
      ok: true,
      user_id: userId,
      empresa_id: empresaId,
      message: "Usuario, empresa y profile creados (modo dev, email confirmado).",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error interno." },
      { status: 500 }
    );
  }
}
