import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const memberId = request.nextUrl.searchParams.get('member_id')
  if (!memberId) return NextResponse.json([])

  const { data } = await supabase
    .from('assignments')
    .select('id, fob:fobs(serial_number, type)')
    .eq('member_id', memberId)
    .is('returned_at', null)

  return NextResponse.json(
    (data ?? []).map((a) => ({
      assignment_id: a.id,
      serial_number: (a.fob as any)?.serial_number,
      type: (a.fob as any)?.type,
    }))
  )
}
