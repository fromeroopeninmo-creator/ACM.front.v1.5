// app/api/informes/create/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CreateBody = {
  datos: any;
  titulo?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateBody;
    if (!body?.datos) {
      return NextResponse.json(
        { error: 'Falta el campo "datos" con el JSON del informe.' },
        { status: 400 }
      );
    }

    // 1) Cliente de sesión (anon) para conocer el usuario
    const cookieStore = cookies();
    const supabaseSession = createRouteHandlerClient({ cookies: () => cookieStore });
    const {
      data: { user },
      error: userErr,
    } = await supabaseSession.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json(
        { error: 'No hay sesión válida.' },
        { status: 401 }
      );
    }

    // 2) Resolver empresa_id y si es asesor
    //    Intento 1: ¿es empresa? (empresas.user_id = auth.uid())
    const { data: empresaMatch, error: empErr } = await supabaseSession
      .from('empresas')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (empErr && empErr.code !== 'PGRST116') {
      // PGRST116 = no rows
      console.warn('empresas lookup error:', empErr.message);
    }

    let empresa_id: string | null = null;
    let asesor_id: string | null = null;

    if (empresaMatch?.id) {
      empresa_id = empresaMatch.id;
    } else {
      // Intento 2: ¿es perfil (asesor)? (profiles.id = auth.uid())
      const { data: perfil, error: profErr } = await supabaseSession
        .from('profiles')
        .select('id, role, empresa_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profErr && profErr.code !== 'PGRST116') {
        console.warn('profiles lookup error:', profErr.message);
      }

      if (perfil?.empresa_id) {
        empresa_id = perfil.empresa_id;
      }
      if (perfil?.role === 'asesor') {
        asesor_id = user.id;
      }
    }

    if (!empresa_id) {
      return NextResponse.json(
        {
          error:
            'No se pudo determinar la empresa del usuario (empresa_id). Verificá que el usuario esté vinculado a una empresa.',
        },
        { status: 400 }
      );
    }

    // 3) Cliente admin (Service Role) — esto BYPASSEA RLS
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      {
        auth: { persistSession: false },
      }
    );

    const insertPayload = {
      empresa_id,
      asesor_id, // null si es empresa
      autor_id: user.id,
      datos_json: body.datos,
      titulo: body.titulo ?? 'Informe VAI',
      tipo: 'VAI',
      estado: 'borrador',
      etiquetas: [],
      payload: {},
    };

    const { data: inserted, error: insErr } = await admin
      .from('informes')
      .insert(insertPayload)
      .select('id, created_at')
      .single();

    if (insErr) {
      console.error('insert informes error:', insErr);
      return NextResponse.json(
        {
          error:
            'No se pudo guardar el informe en la base de datos.',
          details: insErr.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        informe: inserted,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error('create informe exception:', e);
    return NextResponse.json(
      { error: 'Error inesperado al crear el informe.', details: e?.message },
      { status: 500 }
    );
  }
}
