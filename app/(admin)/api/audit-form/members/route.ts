import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const { data } = await supabase
    .from('members')
    .select('id, name, company, suite')
    .ilike('name', `%${q}%`)
    .eq('status', 'active')
    .limit(8)

  return NextResponse.json(data ?? [])
}
