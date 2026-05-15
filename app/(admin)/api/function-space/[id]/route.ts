import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_FIELDS = ['status', 'internal_notes', 'hire_fee', 'deposit_amount', 'notes'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const body = await request.json()

  const updates: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in body) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('function_space_bookings')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (updates.status) {
    await supabase.from('audit_log').insert({
      action: `booking_status_${updates.status}`,
      entity_type: 'function_space_booking',
      entity_id: id,
      metadata: { new_status: updates.status },
    })
  }

  return NextResponse.json({ ok: true })
}
