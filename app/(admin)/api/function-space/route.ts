import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const body = await request.json()

  if (!body.client_name?.trim()) {
    return NextResponse.json({ error: 'client_name is required' }, { status: 400 })
  }
  if (!body.event_date || !body.start_time || !body.end_time) {
    return NextResponse.json({ error: 'event_date, start_time, and end_time are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('function_space_bookings')
    .insert({
      client_name: body.client_name.trim(),
      client_company: body.client_company?.trim() || null,
      client_email: body.client_email?.trim() || null,
      client_phone: body.client_phone?.trim() || null,
      space_name: body.space_name ?? 'Function Space',
      event_date: body.event_date,
      start_time: body.start_time,
      end_time: body.end_time,
      guest_count: body.guest_count ?? null,
      event_type: body.event_type ?? null,
      hire_fee: body.hire_fee ?? null,
      deposit_amount: body.deposit_amount ?? null,
      notes: body.notes?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create booking' }, { status: 500 })
  }

  await supabase.from('audit_log').insert({
    action: 'booking_created',
    entity_type: 'function_space_booking',
    entity_id: data.id,
    metadata: { client_name: body.client_name, event_date: body.event_date },
  })

  return NextResponse.json(data, { status: 201 })
}
