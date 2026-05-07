import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { parseMembership } from '@/lib/membership'

export const dynamic = 'force-dynamic'

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  paused: 'bg-amber-100 text-amber-800',
  contact: 'bg-gray-100 text-gray-700',
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const filters = await searchParams
  const supabase = await createClient()

  let query = supabase.from('members').select('*')
  if (filters.status) query = query.eq('status', filters.status)

  const { data: rawMembers } = await query

  const TYPE_ORDER: Record<string, number> = {
    'Office': 0,
    'Dedicated desk': 2,
    'Flexi': 3,
    'Virtual office': 4,
    'Parking': 5,
    'Meeting room': 6,
    '—': 7,
  }

  const members = (rawMembers ?? []).slice().sort((a, b) => {
    const pa = parseMembership(a.suite)
    const pb = parseMembership(b.suite)

    // Primary: type order, with Office level 4 before level 2
    const typeA = TYPE_ORDER[pa.type] ?? 1
    const typeB = TYPE_ORDER[pb.type] ?? 1
    if (pa.type === 'Office' && pb.type === 'Office') {
      const levelA = pa.level === '4' ? 0 : pa.level === '2' ? 1 : 2
      const levelB = pb.level === '4' ? 0 : pb.level === '2' ? 1 : 2
      if (levelA !== levelB) return levelA - levelB
    } else if (typeA !== typeB) {
      return typeA - typeB
    }

    // Secondary: suite number numerically
    const suiteNumA = parseInt(pa.suite ?? '', 10)
    const suiteNumB = parseInt(pb.suite ?? '', 10)
    if (!isNaN(suiteNumA) && !isNaN(suiteNumB)) return suiteNumA - suiteNumB
    return (pa.suite ?? '').localeCompare(pb.suite ?? '')
  })

  const { data: openCounts } = await supabase
    .from('assignments')
    .select('member_id')
    .is('returned_at', null)

  const countMap: Record<string, number> = {}
  for (const row of openCounts ?? []) {
    countMap[row.member_id] = (countMap[row.member_id] ?? 0) + 1
  }

  const statuses = ['active', 'cancelled', 'paused', 'contact']

  function filterUrl(value: string) {
    const p = new URLSearchParams(filters as Record<string, string>)
    if (p.get('status') === value) p.delete('status')
    else p.set('status', value)
    const s = p.toString()
    return `/members${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Members</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Link
            key={s}
            href={filterUrl(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filters.status === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {!members || members.length === 0 ? (
            <p className="text-sm text-gray-500 p-6">No members found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Name</th>
                    <th className="text-left px-4 py-3">Company</th>
                    <th className="text-left px-4 py-3">Membership</th>
                    <th className="text-left px-4 py-3">Level</th>
                    <th className="text-left px-4 py-3">Suite</th>
                    <th className="text-left px-4 py-3">Parking</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Fobs held</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const fobCount = countMap[m.id] ?? 0
                    const flagged = m.status === 'cancelled' && fobCount > 0
                    const { type, level, suite } = parseMembership(m.suite)
                    return (
                      <tr
                        key={m.id}
                        className={`border-b last:border-0 hover:bg-gray-50 ${flagged ? 'bg-red-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/members/${m.id}`}
                            className="hover:underline font-medium flex items-center gap-1.5"
                          >
                            {m.name}
                            {flagged && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {m.company ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {type}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {level ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {suite ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {m.parking ? parseMembership(m.parking).suite ?? '—' : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[m.status]}`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {fobCount > 0 ? (
                            <span className={`text-sm font-medium ${flagged ? 'text-red-600' : ''}`}>
                              {fobCount}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400">{members?.length ?? 0} members</p>
    </div>
  )
}
