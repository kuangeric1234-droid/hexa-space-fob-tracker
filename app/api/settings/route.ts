import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  return NextResponse.json(data ?? {
    default_fob_deposit: 100,
    default_remote_deposit: 200,
    auto_create_deposit_fee: true,
    auto_refund_on_return: true,
    notification_email: null,
  })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { error } = await supabase.from('app_settings').update(body).eq('id', 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
