import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { FobImport } from '@/components/fob-import'

export const dynamic = 'force-dynamic'

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  assigned: 'bg-blue-100 text-blue-800',
  lost: 'bg-red-100 text-red-800',
  deactivated: 'bg-gray-100 text-gray-600',
  retired: 'bg-gray-100 text-gray-500',
}

export default async function FobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>
}) {
  const filters = await searchParams
  const supabase = await createClient()

  let query = supabase.from('fobs').select('*').order('serial_number')
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.type) query = query.eq('type', filters.type)

  const { data: fobs } = await query

  const assignedFobIds = fobs?.filter((f) => f.status === 'assigned').map((f) => f.id) ?? []
  let holderMap: Record<string, { name: string; suite: string | null }> = {}

  if (assignedFobIds.length > 0) {
    const { data: assignments } = await supabase
      .from('assignments')
      .select('fob_id, member:members(name, suite)')
      .in('fob_id', assignedFobIds)
      .is('returned_at', null)

    holderMap = Object.fromEntries(
      (assignments ?? []).map((a) => [
        a.fob_id,
        { name: (a.member as any)?.name ?? '', suite: (a.member as any)?.suite ?? null },
      ])
    )
  }

  const statuses = ['available', 'assigned', 'lost', 'deactivated', 'retired']
  const types = ['fob', 'remote']

  function filterUrl(key: string, value: string) {
    const p = new URLSearchParams(filters as Record<string, string>)
    if (p.get(key) === value) p.delete(key)
    else p.set(key, value)
    const s = p.toString()
    return `/fobs${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <div className="flex items-center gap-2">
          <FobImport />
          <Link href="/issue" className="text-sm text-violet-600 hover:underline font-medium">+ Issue fob</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Link
            key={s}
            href={filterUrl('status', s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filters.status === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {s}
          </Link>
        ))}
        <span className="text-gray-300">|</span>
        {types.map((t) => (
          <Link
            key={t}
            href={filterUrl('type', t)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filters.type === t
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {!fobs || fobs.length === 0 ? (
            <p className="text-sm text-gray-500 p-6">No fobs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Serial</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Current holder</th>
                    <th className="text-left px-4 py-3">Suite</th>
                  </tr>
                </thead>
                <tbody>
                  {fobs.map((fob) => {
                    const holder = holderMap[fob.id]
                    return (
                      <tr key={fob.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link href={`/fobs/${fob.id}`} className="font-mono hover:underline">
                            {fob.serial_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{fob.type}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[fob.status]}`}>
                            {fob.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {holder ? (
                            <Link href={`/members`} className="hover:underline text-sm">
                              {holder.name}
                            </Link>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {holder?.suite ?? '—'}
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

      <p className="text-xs text-gray-400">{fobs?.length ?? 0} items</p>
    </div>
  )
}
