import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  const supabase = await createClient()

  if (!q) {
    const { data } = await supabase
      .from('assignments')
      .select('*, fob:fobs(*), member:members(*)')
      .is('returned_at', null)
      .order('issued_at', { ascending: false })
      .limit(20)
    return NextResponse.json(data ?? [])
  }

  // Search by member name or serial
  const like = `%${q}%`
  const { data: memberMatches } = await supabase
    .from('members')
    .select('id')
    .ilike('name', like)
    .limit(20)

  const { data: fobMatches } = await supabase
    .from('fobs')
    .select('id')
    .ilike('serial_number', like)
    .limit(20)

  const memberIds = memberMatches?.map((m) => m.id) ?? []
  const fobIds = fobMatches?.map((f) => f.id) ?? []

  if (memberIds.length === 0 && fobIds.length === 0) {
    return NextResponse.json([])
  }

  let query = supabase
    .from('assignments')
    .select('*, fob:fobs(*), member:members(*)')
    .is('returned_at', null)

  if (memberIds.length > 0 && fobIds.length > 0) {
    query = query.or(`member_id.in.(${memberIds.join(',')}),fob_id.in.(${fobIds.join(',')})`)
  } else if (memberIds.length > 0) {
    query = query.in('member_id', memberIds)
  } else {
    query = query.in('fob_id', fobIds)
  }

  const { data } = await query.order('issued_at', { ascending: false }).limit(20)
  return NextResponse.json(data ?? [])
}
