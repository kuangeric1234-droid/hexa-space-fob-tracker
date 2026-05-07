import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchBar } from '@/components/search-bar'
import { formatDateTime, formatDate, daysOverdue, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { AlertTriangle, XCircle, Clock } from 'lucide-react'
import type { AssignmentWithRelations } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: inCirculation },
    { count: available },
    { data: openAssignments },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from('fobs').select('*', { count: 'exact', head: true }).eq('status', 'assigned'),
    supabase.from('fobs').select('*', { count: 'exact', head: true }).eq('status', 'available'),
    supabase
      .from('assignments')
      .select(`*, fob:fobs(*), member:members(*)`)
      .is('returned_at', null)
      .order('issued_at', { ascending: false }),
    supabase
      .from('assignments')
      .select(`*, fob:fobs(*), member:members(*)`)
      .order('issued_at', { ascending: false })
      .limit(20),
  ])

  const now = new Date()
  const open = (openAssignments as AssignmentWithRelations[] | null) ?? []

  const overdue = open.filter((a) => {
    const overdueByDate = a.expected_return_at && new Date(a.expected_return_at) < now
    const cancelledMember = a.member?.status === 'cancelled'
    return overdueByDate || cancelledMember
  })

  const unpaidOld = open.filter((a) => {
    if (a.deposit_status !== 'pending' && a.deposit_status !== 'failed') return false
    return daysOverdue(a.issued_at) > 30
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <SearchBar />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">In circulation</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{inCirculation ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Available</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold text-green-600">{available ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overdue</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-3xl font-bold ${overdue.length > 0 ? 'text-red-600' : ''}`}>
              {overdue.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deposits unpaid</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-3xl font-bold ${unpaidOld.length > 0 ? 'text-amber-600' : ''}`}>
              {unpaidOld.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Needs attention */}
      {(overdue.length > 0 || unpaidOld.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdue.map((a) => {
              const cancelledMember = a.member?.status === 'cancelled'
              const overdueByDate = a.expected_return_at && new Date(a.expected_return_at) < now
              return (
                <div
                  key={a.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md bg-red-50 border border-red-100"
                >
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <Link href={`/members/${a.member_id}`} className="font-medium text-sm hover:underline">
                        {a.member?.name}
                      </Link>
                      <span className="text-gray-400 mx-2">·</span>
                      <Link href={`/fobs/${a.fob_id}`} className="font-mono text-sm hover:underline">
                        {a.fob?.serial_number}
                      </Link>
                      <div className="text-xs text-red-600 mt-0.5 space-x-2">
                        {cancelledMember && <span className="font-medium">Member cancelled</span>}
                        {overdueByDate && (
                          <span>
                            Overdue by {daysOverdue(a.expected_return_at)} days (expected {formatDate(a.expected_return_at)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/return?serial=${a.fob?.serial_number}`}
                    className="text-xs text-red-700 underline shrink-0"
                  >
                    Return
                  </Link>
                </div>
              )
            })}

            {unpaidOld.map((a) => (
              <div
                key={`unpaid-${a.id}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-md bg-amber-50 border border-amber-100"
              >
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <Link href={`/members/${a.member_id}`} className="font-medium text-sm hover:underline">
                      {a.member?.name}
                    </Link>
                    <span className="text-gray-400 mx-2">·</span>
                    <Link href={`/fobs/${a.fob_id}`} className="font-mono text-sm hover:underline">
                      {a.fob?.serial_number}
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Deposit {formatCurrency(a.deposit_amount)} unpaid — issued {formatDate(a.issued_at)} ({daysOverdue(a.issued_at)} days ago)
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="text-amber-700 border-amber-300 shrink-0 text-xs">
                  {a.deposit_status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentActivity || recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500">No activity yet.</p>
          ) : (
            <div className="divide-y">
              {(recentActivity as AssignmentWithRelations[]).map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={a.returned_at ? 'secondary' : 'default'} className="text-xs">
                      {a.returned_at ? 'returned' : 'issued'}
                    </Badge>
                    <Link href={`/fobs/${a.fob_id}`} className="font-mono text-sm hover:underline">
                      {(a.fob as any)?.serial_number}
                    </Link>
                    <span className="text-gray-400 text-sm">→</span>
                    <Link href={`/members/${a.member_id}`} className="text-sm hover:underline">
                      {(a.member as any)?.name}
                    </Link>
                    {(a.member as any)?.suite && (
                      <span className="text-xs text-gray-400">{(a.member as any).suite}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {formatDateTime(a.returned_at ?? a.issued_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
