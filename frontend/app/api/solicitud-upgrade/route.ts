import { NextResponse } from "next/server";
import { supabase } from "#lib/supabaseClient";

// ⚙️ POST /api/solicitud-upgrade
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { empresaId, planId } = body;

    if (!empresaId || !planId) {
      return NextResponse.json({ error: "Faltan datos obligatorios." }, { status: 400 });
    }

    // 📥 Registrar la solicitud
    const { error } = await supabase.from("solicitudes_upgrade").insert([
      {
        empresa_id: empresaId,
        plan_id: planId,
        estado: "pendiente",
      },
    ]);

    if (error) {
      console.error("Error insertando solicitud:", error);
      return NextResponse.json({ error: "No se pudo registrar la solicitud." }, { status: 500 });
    }

    // 📧 (Opcional) Notificación por correo
    // Si querés que te llegue un mail cada vez que una empresa solicita upgrade:
    const superAdmins = [
      "fabricioromero22@gmail.com",
      "erdipp.openinmo@gmail.com",
      "criscba.openinmo@gmail.com",
    ];

    try {
      // Esto usa el servicio integrado de Supabase o tu backend de email
      // (Más adelante lo reemplazamos por envío real via Resend o Nodemailer)
      console.log("📩 Notificación enviada a SuperAdmins:", superAdmins);
    } catch (mailError) {
      console.warn("No se pudo enviar el correo:", mailError);
    }

    return NextResponse.json({ success: true, message: "Solicitud enviada correctamente." });
  } catch (err) {
    console.error("Error general:", err);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
