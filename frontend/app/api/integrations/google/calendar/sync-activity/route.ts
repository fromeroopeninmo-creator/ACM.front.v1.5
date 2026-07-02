
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || "";
const STATE_SECRET =
  process.env.GOOGLE_OAUTH_STATE_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "vai-prop-google-state";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_SCOPES = ["openid", "email", "profile", CALENDAR_SCOPE];
const ARG_TIME_ZONE = "America/Argentina/Cordoba";

type AuthUser = {
  id: string;
  email?: string | null;
  role?: string | null;
};

function jsonError(message: string, status = 400, extra?: Record<string, any>) {
  return NextResponse.json({ ok: false, error: message, ...(extra || {}) }, { status });
}

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signState(payload: Record<string, any>) {
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(crypto.createHmac("sha256", STATE_SECRET).update(body).digest());
  return `${body}.${sig}`;
}

function verifyState(state: string) {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Estado OAuth inválido.");
  const expected = base64url(crypto.createHmac("sha256", STATE_SECRET).update(body).digest());
  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) throw new Error("Firma OAuth inválida.");
  const parsed = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  const ageMs = Date.now() - Number(parsed.ts || 0);
  if (!parsed.user_id || ageMs > 1000 * 60 * 20) throw new Error("Estado OAuth vencido.");
  return parsed as { user_id: string; returnTo?: string; ts: number };
}

async function getUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  const auth = req.headers.get("authorization") || "";
  let token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  // Fallback best-effort para instalaciones que tengan Supabase Auth en cookies SSR.
  if (!token) {
    for (const cookie of req.cookies.getAll()) {
      const value = cookie.value;
      if (!cookie.name.includes("auth-token") && !cookie.name.includes("access-token")) continue;
      try {
        const decoded = decodeURIComponent(value);
        const maybeJson = JSON.parse(decoded);
        if (Array.isArray(maybeJson) && typeof maybeJson[0] === "string") token = maybeJson[0];
        if (maybeJson?.access_token) token = maybeJson.access_token;
      } catch {
        if (value.split(".").length === 3) token = value;
      }
      if (token) break;
    }
  }

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  const user = data.user as any;
  return {
    id: user.id,
    email: user.email ?? null,
    role: user.user_metadata?.role ?? user.app_metadata?.role ?? null,
  };
}

async function exchangeCodeForTokens(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json().catch(() => null as any);
  if (!res.ok) throw new Error(json?.error_description || json?.error || "No se pudo obtener token de Google.");
  return json as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
  };
}

async function getGoogleUserInfo(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => null as any);
  if (!res.ok) return null;
  return json as { email?: string; name?: string; picture?: string };
}

async function refreshGoogleAccessToken(connection: any) {
  if (!connection?.refresh_token) {
    throw new Error("La conexión de Google no tiene refresh_token. Volvé a conectar Google Calendar.");
  }

  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: connection.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json().catch(() => null as any);
  if (!res.ok) throw new Error(json?.error_description || json?.error || "No se pudo refrescar token de Google.");

  const expiresAt = new Date(Date.now() + Number(json.expires_in || 3600) * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("user_google_connections")
    .update({
      access_token: json.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function getValidConnection(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_google_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Google Calendar no está conectado.");

  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (!data.access_token || expiresAt < Date.now() + 1000 * 60 * 2) {
    return refreshGoogleAccessToken(data);
  }

  return data;
}

async function canUserAccessActivity(user: AuthUser, activity: any) {
  // Empresa propietaria de la actividad
  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("id", activity.empresa_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (empresa?.id) return true;

  // Asesor propio de la actividad
  if (user.email && activity.asesor_id) {
    const { data: asesor } = await supabaseAdmin
      .from("asesores")
      .select("id, empresa_id")
      .eq("id", activity.asesor_id)
      .eq("empresa_id", activity.empresa_id)
      .eq("email", user.email)
      .maybeSingle();

    if (asesor?.id) return true;
  }

  return false;
}

function dateTimeWithArgentinaOffset(dateKey: string, timeValue?: string | null) {
  const hhmm = (timeValue || "09:00").substring(0, 5);
  return `${dateKey}T${hhmm}:00-03:00`;
}

function addMinutesToDateTime(dateTime: string, minutes: number) {
  const d = new Date(dateTime);
  d.setMinutes(d.getMinutes() + Math.max(15, minutes || 30));
  return d.toISOString();
}

function buildWhatsappText(contacto: any) {
  if (!contacto) return "";
  const nombre = [contacto.nombre, contacto.apellido].filter(Boolean).join(" ").trim();
  const tel = contacto.telefono_whatsapp || contacto.telefono || "";
  return [nombre, tel].filter(Boolean).join(" · ");
}

async function buildGoogleEventFromActivity(activity: any) {
  let contacto: any = null;
  if (activity.contacto_id) {
    const { data } = await supabaseAdmin
      .from("tracker_contactos")
      .select("id, nombre, apellido, telefono, telefono_whatsapp, email, direccion, zona")
      .eq("id", activity.contacto_id)
      .maybeSingle();
    contacto = data;
  }

  const dateKey = (activity.fecha_programada || new Date().toISOString()).substring(0, 10);
  const startDateTime = dateTimeWithArgentinaOffset(dateKey, activity.hora);
  const duration = Number(activity.duracion_minutos || 30);

  const descriptionParts = [
    activity.notas ? `Notas: ${activity.notas}` : "",
    contacto ? `Contacto: ${buildWhatsappText(contacto)}` : "",
    contacto?.email ? `Email: ${contacto.email}` : "",
    contacto?.direccion ? `Dirección: ${contacto.direccion}` : "",
    contacto?.zona ? `Zona: ${contacto.zona}` : "",
    "Creado desde VAI Prop.",
  ].filter(Boolean);

  return {
    summary: activity.titulo || "Actividad VAI Prop",
    description: descriptionParts.join("\n"),
    location: contacto?.direccion || contacto?.zona || undefined,
    start: {
      dateTime: startDateTime,
      timeZone: ARG_TIME_ZONE,
    },
    end: {
      dateTime: addMinutesToDateTime(startDateTime, duration),
      timeZone: ARG_TIME_ZONE,
    },
    reminders: {
      useDefault: true,
    },
    extendedProperties: {
      private: {
        vai_prop_activity_id: activity.id,
        vai_prop_empresa_id: activity.empresa_id,
        vai_prop_asesor_id: activity.asesor_id || "",
      },
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return jsonError("No autenticado.", 401);

    const body = await req.json().catch(() => null as any);
    const activityId = body?.activity_id || body?.actividad_id || body?.id;
    if (!activityId) return jsonError("Falta activity_id.", 400);

    const { data: activity, error: activityErr } = await supabaseAdmin
      .from("tracker_actividades")
      .select("*")
      .eq("id", activityId)
      .maybeSingle();

    if (activityErr) throw activityErr;
    if (!activity) return jsonError("Actividad no encontrada.", 404);

    const allowed = await canUserAccessActivity(user, activity);
    if (!allowed) return jsonError("No tenés permisos para sincronizar esta actividad.", 403);

    const connection = await getValidConnection(user.id);
    const eventPayload = await buildGoogleEventFromActivity(activity);

    const hasGoogleEvent = !!activity.google_calendar_event_id;
    const endpoint = hasGoogleEvent
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(activity.google_calendar_event_id)}`
      : "https://www.googleapis.com/calendar/v3/calendars/primary/events";

    const res = await fetch(endpoint, {
      method: hasGoogleEvent ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    });

    const googleJson = await res.json().catch(() => null as any);

    if (!res.ok) {
      const msg = googleJson?.error?.message || "Google Calendar rechazó la operación.";
      await supabaseAdmin
        .from("tracker_actividades")
        .update({
          google_calendar_sync_status: "error",
          google_calendar_sync_error: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activity.id);
      return jsonError(msg, res.status, { google: googleJson });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("tracker_actividades")
      .update({
        google_calendar_event_id: googleJson.id || activity.google_calendar_event_id,
        google_calendar_html_link: googleJson.htmlLink || null,
        google_calendar_synced_at: new Date().toISOString(),
        google_calendar_sync_status: "synced",
        google_calendar_sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activity.id)
      .select("*")
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({
      ok: true,
      action: hasGoogleEvent ? "updated" : "created",
      activity: updated,
      google_event: {
        id: googleJson.id,
        htmlLink: googleJson.htmlLink,
      },
    });
  } catch (err: any) {
    console.error("Google sync activity error:", err);
    return jsonError(err?.message || "No se pudo sincronizar la actividad con Google Calendar.", 500);
  }
}
