import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import { CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react'

export const dynamic = 'force-dynamic'

const statusIcon = {
  have: <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />,
  lost: <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />,
  returned: <RotateCcw className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
}

const statusLabel = {
  have: 'Has it',
  lost: 'Lost',
  returned: 'Returned',
}

export default async function AuditResponsesPage() {
  const supabase = await createClient()

  const { data: responses } = await supabase
    .from('fob_audit_responses')
    .select('*')
    .order('submitted_at', { ascending: false })

  const total = responses?.length ?? 0
  const lostCount = responses?.reduce((n, r) => {
    const fobs = (r.fob_confirmations ?? []) as any[]
    return n + fobs.filter(f => f.status === 'lost').length
  }, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Audit responses</h1>
        <a
          href="/audit-form"
          target="_blank"
          className="text-sm text-violet-600 hover:underline font-medium"
        >
          Open form link ↗
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Responses</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fobs reported lost</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-3xl font-bold ${lostCount > 0 ? 'text-red-600' : ''}`}>{lostCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {!responses || responses.length === 0 ? (
            <p className="text-sm text-gray-500 p-6">No responses yet. Share the form link with your members.</p>
          ) : (
            <div className="divide-y">
              {responses.map((r) => {
                const fobs = (r.fob_confirmations ?? []) as any[]
                const extra = (r.additional_fobs ?? []) as any[]
                const hasLost = fobs.some(f => f.status === 'lost')
                return (
                  <div key={r.id} className={`p-4 ${hasLost ? 'bg-red-50' : ''}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{r.member_name}</p>
                        {r.email && <p className="text-xs text-gray-400">{r.email}</p>}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{formatDateTime(r.submitted_at)}</span>
                    </div>

                    {fobs.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {fobs.map((f: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            {statusIcon[f.status as keyof typeof statusIcon]}
                            <span className="font-mono">{f.serial_number}</span>
                            <span className="text-gray-400">{f.type}</span>
                            <span className={`font-medium ${f.status === 'lost' ? 'text-red-600' : f.status === 'returned' ? 'text-amber-600' : 'text-green-600'}`}>
                              {statusLabel[f.status as keyof typeof statusLabel]}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {extra.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-400 font-medium">Additional fobs reported:</p>
                        {extra.map((f: any, i: number) => (
                          <div key={i} className="text-xs flex items-center gap-2">
                            <span className="font-mono text-gray-700">{f.serial_number}</span>
                            {f.notes && <span className="text-gray-400">— {f.notes}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {r.notes && (
                      <p className="mt-2 text-xs text-gray-500 italic">"{r.notes}"</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
