// frontend/app/api/auth/dev-signup/route.ts
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
      return NextResponse.json(
        { error: createErr?.message || "No se pudo crear el usuario (admin)." },
        { status: 500 }
      );
    }

    const userId = created.user.id;

    // 2) Insertar empresa
    const { error: empErr } = await supabaseAdmin.from("empresas").insert([
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
    ]);

    if (empErr) {
      // opcional: limpiar el usuario creado si falló empresa
      // await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: `Error creando empresa: ${empErr.message}` },
        { status: 500 }
      );
    }

    // (Opcional) emitir una sesión aquí si quisieras auto-login;
    // en general lo dejamos para el login normal.
    return NextResponse.json({
      ok: true,
      user_id: userId,
      message: "Usuario y empresa creados (modo dev, email confirmado).",
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error interno." },
      { status: 500 }
    );
  }
}
