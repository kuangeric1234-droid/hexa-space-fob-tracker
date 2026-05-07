import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role for writes — RLS policy allows anon inserts on this table
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { member_id, member_name, email, fob_confirmations, additional_fobs, notes } = body

  if (!member_name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const { error } = await supabase.from('fob_audit_responses').insert({
    member_id: member_id || null,
    member_name: member_name.trim(),
    email: email?.trim() || null,
    fob_confirmations: fob_confirmations ?? [],
    additional_fobs: additional_fobs ?? [],
    notes: notes?.trim() || null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
