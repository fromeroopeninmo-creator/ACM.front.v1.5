import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "#lib/supabaseServer";

export const dynamic = "force-dynamic";

type Params = { q?: string; estado?: string; ordenar?: string; creada_desde?: string; creada_hasta?: string; ciclo_hasta?: string; acuerdo_hasta?: string; page?: string; pageSize?: string };
type Row = { id:string; nombre:string; razonSocial?:string|null; cuit?:string|null; ubicacion?:string|null; creadaEn?:string|null; suspendida:boolean; suspensionMotivo?:string|null; acceso:boolean; estado:string; plan?:string|null; cicloFin?:string|null; diasParaVencer?:number|null; acuerdo?:{id:string;tipo?:string|null;fechaFin?:string|null;precioNeto?:number|null;maxAsesores?:number|null;diasParaVencer?:number|null}|null };
type Response = { page:number; pageSize:number; total:number; items:Row[] };

function cookieHeader() { return cookies().getAll().map((c) => `${c.name}=${c.value}`).join("; "); }
function baseUrl() { const v=process.env.NEXT_PUBLIC_SITE_URL||process.env.NEXT_PUBLIC_VERCEL_URL||process.env.VERCEL_URL; return v?(v.startsWith("http")?v:`https://${v}`):"http://localhost:3000"; }
function date(v?:string|null){ if(!v)return "—"; const d=new Date(v); return Number.isNaN(d.getTime())?"—":new Intl.DateTimeFormat("es-AR",{dateStyle:"medium"}).format(d); }
function money(v?:number|null){ return v==null?"—":new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(v); }
function isoFromOffset(days:number){ const d=new Date(Date.now()+days*86400000); return d.toISOString().slice(0,10); }

export default async function EmpresasPage({ searchParams }: { searchParams: Params }) {
  const s=supabaseServer(); const {data:{user}}=await s.auth.getUser(); if(!user)redirect("/login");
  const {data:p}=await s.from("profiles").select("role").or(`id.eq.${user.id},user_id.eq.${user.id}`).limit(1).maybeSingle();
  const role=p?.role??(user.user_metadata as any)?.role; if(role!=="super_admin"&&role!=="super_admin_root")redirect("/");

  const normalized={...searchParams};
  if(searchParams.ciclo_hasta==="proximos7") normalized.ciclo_hasta=isoFromOffset(7);
  if(searchParams.acuerdo_hasta==="proximos30") normalized.acuerdo_hasta=isoFromOffset(30);
  const usp=new URLSearchParams(); Object.entries(normalized).forEach(([k,v])=>{if(v)usp.set(k,String(v));});
  let data:Response={page:1,pageSize:20,total:0,items:[]}; let error:string|null=null;
  try{ const r=await fetch(`${baseUrl()}/api/admin/empresas/resumen?${usp}`,{headers:{cookie:cookieHeader()},cache:"no-store"}); if(!r.ok)throw new Error(await r.text()); data=await r.json(); }catch(e:any){error=e?.message??"No se pudo cargar empresas.";}
  const pages=Math.max(1,Math.ceil(data.total/data.pageSize));
  const href=(page:number)=>{const q=new URLSearchParams(usp);q.set("page",String(page));return `/dashboard/admin/empresas?${q}`;};

  return <main className="mx-auto w-full max-w-[1700px] space-y-5 p-4 md:p-6 xl:p-8">
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-600">Administración comercial</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">Empresas</h1><p className="mt-1 text-sm text-slate-500">Acceso real, ciclos pagados y acuerdos próximos a vencer.</p></div>
      <a href="/dashboard/admin" className="w-full rounded-xl border bg-white px-4 py-2.5 text-center text-sm font-semibold hover:bg-slate-50 dark:bg-neutral-900 sm:w-auto">← Volver al panel</a>
    </header>

    <section className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-neutral-900">
      <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-8">
        <label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium text-slate-500">Buscar</span><input name="q" defaultValue={searchParams.q} placeholder="Empresa, CUIT o ubicación" className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm"/></label>
        <label><span className="mb-1 block text-xs font-medium text-slate-500">Estado</span><select name="estado" defaultValue={searchParams.estado??"todos"} className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm"><option value="todos">Todos</option><option value="activa">Activas</option><option value="suspendida">Suspendidas</option><option value="sin_ciclo">Sin ciclo</option></select></label><label><span className="mb-1 block text-xs font-medium text-slate-500">Ordenar por</span><select name="ordenar" defaultValue={searchParams.ordenar??"prioridad"} className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm"><option value="prioridad">Alertas primero</option><option value="ultimas">Últimas empresas</option><option value="antiguas">Más antiguas</option><option value="nombre">Nombre A–Z</option></select></label>
        <label><span className="mb-1 block text-xs font-medium text-slate-500">Creada desde</span><input type="date" name="creada_desde" defaultValue={searchParams.creada_desde} className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm"/></label>
        <label><span className="mb-1 block text-xs font-medium text-slate-500">Creada hasta</span><input type="date" name="creada_hasta" defaultValue={searchParams.creada_hasta} className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm"/></label>
        <label><span className="mb-1 block text-xs font-medium text-slate-500">Ciclo vence hasta</span><input type="date" name="ciclo_hasta" defaultValue={normalized.ciclo_hasta} className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm"/></label>
        <label><span className="mb-1 block text-xs font-medium text-slate-500">Acuerdo vence hasta</span><input type="date" name="acuerdo_hasta" defaultValue={normalized.acuerdo_hasta} className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm"/></label>
        <div className="flex gap-2 sm:col-span-2 xl:col-span-8"><button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Aplicar filtros</button><a href="/dashboard/admin/empresas" className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Limpiar</a></div>
      </form>
    </section>

    {error?<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>:null}
    <div className="flex items-center justify-between"><p className="text-sm text-slate-500"><strong className="text-slate-900 dark:text-white">{data.total}</strong> empresas encontradas</p></div>

    <section className="grid gap-3 lg:hidden">
      {data.items.map((x)=><article key={x.id} className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold">{x.nombre}</h2><p className="mt-1 text-xs text-slate-500">{x.cuit||"Sin CUIT"} · {x.ubicacion||"Sin ubicación"}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${x.estado==="activa"?"bg-emerald-50 text-emerald-700":x.estado==="suspendida"?"bg-red-50 text-red-700":"bg-amber-50 text-amber-700"}`}>{x.estado==="activa"?"Activa":x.estado==="suspendida"?"Suspendida":"Sin ciclo"}</span></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Plan</dt><dd className="font-medium">{x.plan||"—"}</dd></div><div><dt className="text-xs text-slate-500">Vence ciclo</dt><dd className="font-medium">{date(x.cicloFin)}</dd></div><div><dt className="text-xs text-slate-500">Acuerdo</dt><dd className="font-medium">{x.acuerdo?date(x.acuerdo.fechaFin):"Sin acuerdo"}</dd></div><div><dt className="text-xs text-slate-500">Precio acordado</dt><dd className="font-medium">{money(x.acuerdo?.precioNeto)}</dd></div></dl>
        {x.acuerdo?.diasParaVencer!=null&&x.acuerdo.diasParaVencer<=30?<p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs font-medium text-amber-800">Acuerdo por vencer en {x.acuerdo.diasParaVencer} día(s).</p>:null}
        <a href={`/dashboard/admin/empresas/${x.id}`} className="mt-4 block rounded-xl bg-slate-950 px-4 py-2.5 text-center text-sm font-semibold text-white">Abrir empresa</a>
      </article>)}
    </section>

    <section className="hidden overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-neutral-900 lg:block"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-neutral-950"><tr><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Plan / ciclo</th><th className="px-4 py-3">Acuerdo</th><th className="px-4 py-3">Alta</th><th className="px-4 py-3 text-right">Acción</th></tr></thead><tbody>{data.items.map((x)=><tr key={x.id} className="border-t align-top hover:bg-slate-50/70 dark:hover:bg-neutral-800"><td className="px-4 py-4"><p className="font-semibold">{x.nombre}</p><p className="mt-1 text-xs text-slate-500">{x.cuit||"Sin CUIT"} · {x.ubicacion||"Sin ubicación"}</p></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${x.estado==="activa"?"bg-emerald-50 text-emerald-700":x.estado==="suspendida"?"bg-red-50 text-red-700":"bg-amber-50 text-amber-700"}`}>{x.estado}</span>{x.suspensionMotivo?<p className="mt-2 max-w-52 text-xs text-red-600">{x.suspensionMotivo}</p>:null}</td><td className="px-4 py-4"><p className="font-medium">{x.plan||"—"}</p><p className="mt-1 text-xs text-slate-500">Vence {date(x.cicloFin)}</p>{x.diasParaVencer!=null&&x.diasParaVencer<=7?<p className="mt-1 text-xs font-semibold text-blue-700">{x.diasParaVencer} día(s)</p>:null}</td><td className="px-4 py-4">{x.acuerdo?<><p className="font-medium">{money(x.acuerdo.precioNeto)}</p><p className="mt-1 text-xs text-slate-500">Hasta {date(x.acuerdo.fechaFin)}</p>{x.acuerdo.diasParaVencer!=null&&x.acuerdo.diasParaVencer<=30?<p className="mt-1 text-xs font-semibold text-amber-700">Renegociar · {x.acuerdo.diasParaVencer} día(s)</p>:null}</>:<span className="text-slate-400">Sin acuerdo</span>}</td><td className="px-4 py-4 text-slate-500">{date(x.creadaEn)}</td><td className="px-4 py-4 text-right"><a href={`/dashboard/admin/empresas/${x.id}`} className="inline-flex rounded-lg border px-3 py-2 font-semibold hover:bg-slate-50">Gestionar</a></td></tr>)}</tbody></table></div></section>

    <footer className="flex flex-col items-center justify-between gap-3 sm:flex-row"><p className="text-sm text-slate-500">Página {data.page} de {pages}</p><div className="flex gap-2"><a aria-disabled={data.page<=1} href={data.page<=1?"#":href(data.page-1)} className={`rounded-xl border px-4 py-2 text-sm ${data.page<=1?"pointer-events-none opacity-40":""}`}>Anterior</a><a aria-disabled={data.page>=pages} href={data.page>=pages?"#":href(data.page+1)} className={`rounded-xl border px-4 py-2 text-sm ${data.page>=pages?"pointer-events-none opacity-40":""}`}>Siguiente</a></div></footer>
  </main>;
}
