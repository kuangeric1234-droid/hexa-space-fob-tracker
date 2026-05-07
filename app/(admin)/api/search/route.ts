import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ members: [], fobs: [] })
  }

  const supabase = await createClient()
  const like = `%${q}%`

  const [membersRes, fobsRes] = await Promise.all([
    supabase
      .from('members')
      .select('id, officernd_id, name, company, email, suite, status')
      .or(`name.ilike.${like},suite.ilike.${like},email.ilike.${like},company.ilike.${like}`)
      .limit(5),
    supabase
      .from('fobs')
      .select('id, serial_number, type, location, status')
      .ilike('serial_number', like)
      .limit(5),
  ])

  return NextResponse.json({
    members: membersRes.data ?? [],
    fobs: fobsRes.data ?? [],
  })
}
