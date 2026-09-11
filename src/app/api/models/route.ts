import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAuthenticatedSupabaseClient } from '@/lib/supabase-server';
import type { LocalModel } from '@/types';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAuthenticatedSupabaseClient();
  const { data, error } = await supabase
    .from('local_models')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data as LocalModel[]);
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const supabase = createAuthenticatedSupabaseClient();

    const { data, error } = await supabase
      .from('local_models')
      .insert({
        clerk_user_id: userId,
        name: body.name,
        provider: body.provider,
        config: body.config ?? {},
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data as LocalModel, { status: 201 });
  } catch (err) {
    console.error('POST /api/models crashed:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}