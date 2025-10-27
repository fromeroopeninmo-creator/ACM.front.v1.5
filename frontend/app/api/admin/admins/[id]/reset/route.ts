export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

type Role = "empresa" | "asesor" | "soporte" | "super_admin" | "super_admin_root";

type ResetBody = {
  /**
   * Si se provee, (solo super_admin_root) fija la contraseña directamente
   * mediante admin.updateUserById. Si no se provee, se genera un link de
   * recuperación que el usuario debe abrir para setear su contraseña.
   */
  newPassword?: string;
};

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

function deny(msg: string, status = 403) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 0) Auth de quien llama
    const server = supabaseServer();
    const { data: auth } = await server.auth.getUser();
    const callerId = auth?.user?.id ?? null;
    if (!callerId) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    // 1) Autorización del caller
    const callerRole = await resolveUserRole(callerId);
    const isRoot = callerRole === "super_admin_root";
    const isAdmin = isRoot || callerRole === "super_admin";
    if (!isAdmin) return deny("Acceso denegado.");

    const userId = params.id;
    const body = (await req.json().catch(() => ({}))) as ResetBody;

    // 2) Traer perfil destino y validar que sea admin/root
    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role")
      .eq("id", userId)
      .maybeSingle();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
    if (!prof) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

    const targetRole = (prof.role as Role) || "empresa";
    if (targetRole !== "super_admin" && targetRole !== "super_admin_root") {
      return deny("Solo se gestionan perfiles admin/root en este endpoint.");
    }
    const isTargetRoot = targetRole === "super_admin_root";
    if (!isRoot && isTargetRoot) {
      return deny("No autorizado para operar sobre usuarios root.");
    }

    // 3) Dos modos:
    //    A) newPassword provisto → solo ROOT puede fijarla directamente
    //    B) sin newPassword → generar link de recuperación y devolverlo
    if (body?.newPassword) {
      if (!isRoot) {
        return deny("Solo super_admin_root puede fijar contraseñas directamente.");
      }

      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: body.newPassword,
      });
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 });
      }

      return NextResponse.json(
        { ok: true, mode: "direct", message: "Contraseña actualizada." },
        { status: 200 }
      );
    }

    // 4) Generar link de recuperación (válido para cambiar contraseña)
    //    Para esto necesitamos el email del usuario.
    const email = (prof as any)?.email as string | null;
    if (!email) {
      return NextResponse.json(
        {
          error:
            "El perfil no tiene email. Actualice el email del usuario antes de generar un link de recuperación.",
        },
        { status: 400 }
      );
    }

    // WARNING: supabase-js v2 admin.generateLink requiere email y type.
    // Usamos type "recovery" para que el usuario setee una nueva contraseña.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 400 });
    }

    // Estructura de retorno: devolvemos un URL usable como fallback
    // linkData.formattedActionLink suele contener el enlace listo (v2).
    const actionLink =
      // @ts-ignore — distintos minors de SDK pueden nombrar diferente
      linkData?.properties?.action_link ||
      // @ts-ignore
      linkData?.action_link ||
      // @ts-ignore
      linkData?.formattedActionLink ||
      null;

    return NextResponse.json(
      {
        ok: true,
        mode: "recovery_link",
        email,
        action_link: actionLink,
        message:
          "Comparte este action_link con el usuario para que restablezca su contraseña.",
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Error inesperado al resetear contraseña." },
      { status: 500 }
    );
  }
}
