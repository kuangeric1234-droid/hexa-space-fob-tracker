import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AuditResponsesPage() {
  const supabase = await createClient()

  const { data: responses } = await supabase
    .from('fob_audit_responses')
    .select('*')
    .order('submitted_at', { ascending: false })

  const total = responses?.length ?? 0

  // Collect all reported serials for cross-reference
  const reportedSerials = new Set(
    responses?.flatMap(r =>
      ((r.fob_confirmations ?? []) as any[]).map((f: any) =>
        f.serial_number?.toUpperCase().replace(/\s/g, '')
      )
    ).filter(Boolean)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Audit responses</h1>
        <a
          href="/audit-form"
          target="_blank"
          className="text-sm text-violet-600 hover:underline font-medium"
        >
          Open member form ↗
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
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Unique fobs reported</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold text-green-600">{reportedSerials.size}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {!responses || responses.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500 mb-3">No responses yet.</p>
              <p className="text-xs text-gray-400">Share this link with your members:</p>
              <p className="text-xs font-mono text-violet-600 mt-1">
                {process.env.NEXT_PUBLIC_APP_URL ?? 'your-app-url'}/audit-form
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Member</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Fobs reported</th>
                    <th className="text-left px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => {
                    const fobs = (r.fob_confirmations ?? []) as any[]
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{r.member_name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.email ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {fobs.length === 0 ? (
                              <span className="text-gray-400 text-xs">none</span>
                            ) : fobs.map((f: any, i: number) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-0.5 text-xs font-mono">
                                {f.serial_number}
                                <span className="text-gray-400 font-sans">{f.type}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {formatDateTime(r.submitted_at)}
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
    </div>
  )
}
