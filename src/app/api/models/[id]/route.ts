import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAuthenticatedSupabaseClient } from '@/lib/supabase-server';
import type { LocalModel } from '@/types';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const supabase = createAuthenticatedSupabaseClient();

  const { data, error } = await supabase
    .from('local_models')
    .update({
      name: body.name,
      provider: body.provider,
      config: body.config ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', id) // RLS also enforces clerk_user_id match, but keeping the id filter is still required
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(data as LocalModel);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createAuthenticatedSupabaseClient();

  const { error } = await supabase.from('local_models').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}