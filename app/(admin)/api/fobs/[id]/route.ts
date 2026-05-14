import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const body = await request.json()
  const { serial_number, type, location, status, notes } = body

  const update: Record<string, unknown> = {}
  if (serial_number !== undefined) update.serial_number = serial_number.toString().toUpperCase().trim()
  if (type !== undefined) update.type = type
  if (location !== undefined) update.location = location
  if (status !== undefined) update.status = status
  if (notes !== undefined) update.notes = notes || null

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('fobs')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That serial number is already in use' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
