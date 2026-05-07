import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils'
import { ExternalLink, AlertTriangle } from 'lucide-react'
import type { AssignmentWithRelations } from '@/types'

export const dynamic = 'force-dynamic'

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  paused: 'bg-amber-100 text-amber-800',
  contact: 'bg-gray-100 text-gray-700',
}

const depositStatusColor: Record<string, string> = {
  pending: 'text-amber-600',
  paid: 'text-green-600',
  failed: 'text-red-600',
  refunded: 'text-gray-500',
  waived: 'text-gray-500',
}

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: member } = await supabase.from('members').select('*').eq('id', id).single()
  if (!member) notFound()

  const { data: assignments } = await supabase
    .from('assignments')
    .select('*, fob:fobs(*)')
    .eq('member_id', id)
    .order('issued_at', { ascending: false })

  const activeAssignments = (assignments as AssignmentWithRelations[] | null)?.filter(
    (a) => !a.returned_at
  ) ?? []

  const flagged = member.status === 'cancelled' && activeAssignments.length > 0

  const officerndUrl = `https://app.officernd.com/members/${member.officernd_id}`

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/members" className="text-sm text-gray-400 hover:text-gray-700">← Members</Link>
        <h1 className="text-2xl font-semibold">{member.name}</h1>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[member.status]}`}>
          {member.status}
        </span>
        {flagged && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Cancelled with active fobs
          </span>
        )}
      </div>

      {/* Member info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Member info</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {member.email && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Email</p>
              <p>{member.email}</p>
            </div>
          )}
          {member.company && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Company</p>
              <p>{member.company}</p>
            </div>
          )}
          {member.suite && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Suite</p>
              <p>{member.suite}</p>
            </div>
          )}
          {member.last_synced_at && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Last synced</p>
              <p className="text-gray-600">{formatDateTime(member.last_synced_at)}</p>
            </div>
          )}
          <div className="col-span-2">
            <a
              href={officerndUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
            >
              View in OfficeRnD
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Active fobs */}
      {activeAssignments.length > 0 && (
        <Card className={flagged ? 'border-red-200' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Fobs currently held ({activeAssignments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeAssignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-md border bg-gray-50">
                <div>
                  <Link href={`/fobs/${a.fob_id}`} className="font-mono font-medium hover:underline">
                    {(a.fob as any)?.serial_number}
                  </Link>
                  <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                    <span>{(a.fob as any)?.type}</span>
                    <span>·</span>
                    <span>Issued {formatDate(a.issued_at)}</span>
                    <span className={depositStatusColor[a.deposit_status]}>
                      · {formatCurrency(a.deposit_amount)} {a.deposit_status}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/return?serial=${(a.fob as any)?.serial_number}`}
                  className="text-xs text-blue-700 underline"
                >
                  Return
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Assignment history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Full assignment history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!assignments || assignments.length === 0 ? (
            <p className="text-sm text-gray-500 px-4 py-3">No history yet.</p>
          ) : (
            <div className="divide-y">
              {(assignments as AssignmentWithRelations[]).map((a) => (
                <div key={a.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant={a.returned_at ? 'secondary' : 'default'} className="text-xs">
                        {a.returned_at ? 'returned' : 'active'}
                      </Badge>
                      <Link href={`/fobs/${a.fob_id}`} className="font-mono hover:underline">
                        {(a.fob as any)?.serial_number}
                      </Link>
                      <span className="text-gray-400 text-xs">{(a.fob as any)?.type}</span>
                    </div>
                    <span className={`text-xs ${depositStatusColor[a.deposit_status]}`}>
                      {formatCurrency(a.deposit_amount)} — {a.deposit_status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 space-x-3">
                    <span>Issued {formatDateTime(a.issued_at)}</span>
                    {a.returned_at && <span>Returned {formatDateTime(a.returned_at)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
