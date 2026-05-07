import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const serial = request.nextUrl.searchParams.get('serial')
  if (!serial) return NextResponse.json({ assigned: false })

  const supabase = await createClient()

  const { data: fob } = await supabase
    .from('fobs')
    .select('id, status')
    .eq('serial_number', serial.toUpperCase().replace(/\s/g, ''))
    .single()

  if (!fob || fob.status !== 'assigned') {
    return NextResponse.json({ assigned: false })
  }

  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, member:members(name)')
    .eq('fob_id', fob.id)
    .is('returned_at', null)
    .single()

  return NextResponse.json({
    assigned: true,
    holder: (assignment?.member as any)?.name ?? 'Unknown',
  })
}
