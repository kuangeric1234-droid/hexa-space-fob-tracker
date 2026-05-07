import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const actionColors: Record<string, string> = {
  fob_issued: 'bg-blue-100 text-blue-800',
  fob_returned: 'bg-green-100 text-green-800',
  deposit_fee_failed: 'bg-red-100 text-red-800',
  refund_fee_failed: 'bg-red-100 text-red-800',
  sync_completed: 'bg-gray-100 text-gray-700',
  sync_failed: 'bg-red-100 text-red-800',
  deposit_paid: 'bg-green-100 text-green-800',
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; from?: string; to?: string; page?: string }>
}) {
  const filters = await searchParams
  const supabase = await createClient()
  const page = parseInt(filters.page ?? '1', 10)
  const pageSize = 50
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (filters.action) query = query.eq('action', filters.action)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lte('created_at', filters.to + 'T23:59:59Z')

  const { data: logs, count } = await query

  const totalPages = Math.ceil((count ?? 0) / pageSize)

  const actionTypes = [
    'fob_issued',
    'fob_returned',
    'deposit_fee_failed',
    'refund_fee_failed',
    'sync_completed',
    'sync_failed',
  ]

  function filterUrl(key: string, value: string) {
    const p = new URLSearchParams(filters as Record<string, string>)
    p.delete('page')
    if (p.get(key) === value) p.delete(key)
    else p.set(key, value)
    const s = p.toString()
    return `/audit${s ? `?${s}` : ''}`
  }

  function pageUrl(p: number) {
    const params = new URLSearchParams(filters as Record<string, string>)
    params.set('page', String(p))
    return `/audit?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit log</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {actionTypes.map((a) => (
          <a
            key={a}
            href={filterUrl('action', a)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filters.action === a
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {a.replace(/_/g, ' ')}
          </a>
        ))}
        <span className="text-gray-300">|</span>
        <form method="get" action="/audit" className="flex items-center gap-2">
          {filters.action && <input type="hidden" name="action" value={filters.action} />}
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="text-xs border rounded px-2 py-1.5 text-gray-600"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className="text-xs border rounded px-2 py-1.5 text-gray-600"
          />
          <button type="submit" className="text-xs px-3 py-1.5 rounded border bg-white text-gray-600 hover:border-gray-400">
            Filter
          </button>
          {(filters.from || filters.to) && (
            <a href={filterUrl('from', '')} className="text-xs text-gray-400 hover:text-gray-700">Clear</a>
          )}
        </form>
      </div>

      <Card>
        <CardContent className="p-0">
          {!logs || logs.length === 0 ? (
            <p className="text-sm text-gray-500 p-6">No log entries found.</p>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionColors[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      {log.entity_type && (
                        <span className="text-xs text-gray-400">{log.entity_type}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatDateTime(log.created_at)}</span>
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-1.5 text-xs text-gray-500 font-mono bg-gray-50 rounded px-2 py-1 overflow-x-auto">
                      {JSON.stringify(log.metadata)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 && (
            <a href={pageUrl(page - 1)} className="text-sm text-blue-600 hover:underline">← Previous</a>
          )}
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={pageUrl(page + 1)} className="text-sm text-blue-600 hover:underline">Next →</a>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400">{count ?? 0} total entries</p>
    </div>
  )
}
