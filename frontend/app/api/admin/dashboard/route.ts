export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "#lib/supabaseServer";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function assertAdmin() {
  const server = supabaseServer();
  const { data: { user } } = await server.auth.getUser();
  if (!user?.id) return false;
  const { data } = await admin.from("profiles").select("role").or(`id.eq.${user.id},user_id.eq.${user.id}`).limit(1).maybeSingle();
  return data?.role === "super_admin" || data?.role === "super_admin_root";
}

function ms(v: unknown): number | null { const n = v ? new Date(String(v)).getTime() : NaN; return Number.isFinite(n) ? n : null; }
function monthKey(d: Date) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`; }
function num(v: unknown) { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; }
function approved(v: unknown) { return ["paid","approved","accredited","aprobado","acreditado","completado"].includes(String(v ?? "").toLowerCase()); }

export async function GET(req: Request) {
  try {
    if (!(await assertAdmin())) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
    const url = new URL(req.url);
    const months = [1,3,6,12].includes(Number(url.searchParams.get("months"))) ? Number(url.searchParams.get("months")) : 6;
    const now = new Date(); const nowMs = now.getTime(); const today = now.toISOString().slice(0,10);
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()-(months-1), 1));
    const warning30 = new Date(nowMs + 30*86400000).toISOString().slice(0,10);

    const [eQ,sQ,aQ,mQ,pQ] = await Promise.all([
      admin.from("empresas").select("id,suspendida,eliminada_at"),
      admin.from("suscripciones").select("id,empresa_id,estado,inicio,fin,ciclo_inicio,ciclo_fin,plan_id,plan_actual_id,metadata,created_at,updated_at"),
      admin.from("empresa_acuerdos_comerciales").select("id,empresa_id,activo,fecha_inicio,fecha_fin"),
      admin.from("movimientos_financieros").select("id,empresa_id,fecha,monto_neto,total,estado,origen,referencia_pasarela,metadata").gte("fecha", periodStart.toISOString()),
      admin.from("planes").select("id,es_trial,es_desarrollo"),
    ]);
    for (const q of [eQ,sQ,aQ,mQ,pQ]) if (q.error) throw new Error(q.error.message);

    const empresas=(eQ.data??[]).filter((e:any)=>!e.eliminada_at); const plans=new Map((pQ.data??[]).map((p:any)=>[String(p.id),p]));
    const cycleMap=new Map<string,any>();
    for (const s of sQ.data??[]) {
      if (String(s.estado).toLowerCase()!=="activa") continue;
      const start=ms(s.ciclo_inicio??s.inicio), end=ms(s.ciclo_fin??s.fin);
      if(start==null||end==null||start>nowMs||end<=nowMs) continue;
      const prev=cycleMap.get(String(s.empresa_id)); if(!prev||end>(ms(prev.ciclo_fin??prev.fin)??0)) cycleMap.set(String(s.empresa_id),s);
    }

    let acuerdosPorVencer=0;
    for(const a of aQ.data??[]) if(a.activo&&String(a.fecha_inicio)<=today&&(!a.fecha_fin||String(a.fecha_fin)>=today)&&a.fecha_fin&&String(a.fecha_fin)<=warning30) acuerdosPorVencer++;

    let empresasConAcceso=0,clientesPagos=0,trials=0,desarrollo=0,vencen7d=0;
    for(const e of empresas as any[]){ if(e.suspendida) continue; const c=cycleMap.get(String(e.id)); if(!c) continue; empresasConAcceso++; const p=plans.get(String(c.plan_actual_id??c.plan_id)); if(p?.es_desarrollo) desarrollo++; else if(p?.es_trial) trials++; else clientesPagos++; const end=ms(c.ciclo_fin??c.fin); if(end&&end<=nowMs+7*86400000) vencen7d++; }

    const monthly=new Map<string,number>(); for(let i=months-1;i>=0;i--){const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1));monthly.set(monthKey(d),0);}
    const seen=new Set<string>();
    for(const m of mQ.data??[]){ if(!approved(m.estado)||String(m.origen??"").toLowerCase().includes("simul")) continue; const d=new Date(m.fecha); if(Number.isNaN(d.getTime())) continue; const key=String(m.referencia_pasarela??m.metadata?.externo_payment_id??m.id); if(seen.has(key)) continue; seen.add(key); const mk=monthKey(d); if(monthly.has(mk)) monthly.set(mk,(monthly.get(mk)??0)+num(m.monto_neto??m.total)); }
    for(const s of sQ.data??[]){ const meta=(s.metadata??{}) as any; if(!approved(meta.payment_status)) continue; const pid=String(meta.externo_payment_id??""); const key=pid||`sub:${s.id}`; if(seen.has(key)) continue; const d=new Date(s.updated_at??s.created_at??s.inicio); if(Number.isNaN(d.getTime())||d<periodStart) continue; seen.add(key); const mk=monthKey(d); if(monthly.has(mk)) monthly.set(mk,(monthly.get(mk)??0)+num(meta.precio_neto_final??meta.precio_total_final)); }

    const suspendidas=empresas.filter((e:any)=>!!e.suspendida).length; const sinCiclo=empresas.filter((e:any)=>!e.suspendida&&!cycleMap.has(String(e.id))).length;
    return NextResponse.json({generatedAt:now.toISOString(),period:{months,desde:periodStart.toISOString(),hasta:now.toISOString()},kpis:{empresasTotal:empresas.length,empresasConAcceso,clientesPagos,trials,desarrollo,suspendidas,sinCiclo,vencen7d,acuerdosPorVencer,ingresosPeriodo:Array.from(monthly.values()).reduce((a,b)=>a+b,0)},ingresosMensuales:Array.from(monthly.entries()).map(([mes,monto])=>({mes,monto})),distribucion:[{label:"Con acceso",value:empresasConAcceso},{label:"Suspendidas",value:suspendidas},{label:"Sin ciclo",value:sinCiclo}]});
  } catch(e:any){ return NextResponse.json({error:e?.message??"Error inesperado."},{status:500}); }
}
