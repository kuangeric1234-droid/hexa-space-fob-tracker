import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils'
import type { AssignmentWithRelations } from '@/types'

export const dynamic = 'force-dynamic'

const depositStatusColor: Record<string, string> = {
  pending: 'text-amber-600',
  paid: 'text-green-600',
  failed: 'text-red-600',
  refunded: 'text-gray-500',
  waived: 'text-gray-500',
}

export default async function FobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: fob } = await supabase.from('fobs').select('*').eq('id', id).single()
  if (!fob) notFound()

  const { data: assignments } = await supabase
    .from('assignments')
    .select('*, member:members(*)')
    .eq('fob_id', id)
    .order('issued_at', { ascending: false })

  const currentAssignment = (assignments as AssignmentWithRelations[] | null)?.find(
    (a) => !a.returned_at
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/fobs" className="text-sm text-gray-400 hover:text-gray-700">← Inventory</Link>
        <h1 className="text-2xl font-semibold font-mono">{fob.serial_number}</h1>
        <Badge variant={fob.status === 'available' ? 'default' : 'secondary'}>{fob.status}</Badge>
      </div>

      {/* Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Type</p>
            <p>{fob.type}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Location</p>
            <p>{fob.location}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Status</p>
            <p>{fob.status}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Added</p>
            <p>{formatDate(fob.created_at)}</p>
          </div>
          {fob.notes && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Notes</p>
              <p>{fob.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current assignment */}
      {currentAssignment && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Currently assigned</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex items-center justify-between">
              <Link href={`/members/${currentAssignment.member_id}`} className="font-medium hover:underline">
                {(currentAssignment.member as any)?.name}
              </Link>
              <Link
                href={`/return?serial=${fob.serial_number}`}
                className="text-xs text-blue-700 underline"
              >
                Return
              </Link>
            </div>
            <div className="text-xs text-gray-600 space-x-3">
              <span>Issued {formatDate(currentAssignment.issued_at)}</span>
              {currentAssignment.expected_return_at && (
                <span>Expected {formatDate(currentAssignment.expected_return_at)}</span>
              )}
              <span className={depositStatusColor[currentAssignment.deposit_status]}>
                Deposit {formatCurrency(currentAssignment.deposit_amount)} — {currentAssignment.deposit_status}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Assignment history</CardTitle>
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
                      <Link href={`/members/${a.member_id}`} className="hover:underline">
                        {(a.member as any)?.name}
                      </Link>
                    </div>
                    <span className={`text-xs ${depositStatusColor[a.deposit_status]}`}>
                      {formatCurrency(a.deposit_amount)} — {a.deposit_status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 space-x-3">
                    <span>Issued {formatDateTime(a.issued_at)}</span>
                    {a.returned_at && <span>Returned {formatDateTime(a.returned_at)}</span>}
                  </div>
                  {a.issue_notes && <p className="text-xs text-gray-500 mt-1">Note: {a.issue_notes}</p>}
                  {a.return_notes && <p className="text-xs text-gray-500 mt-0.5">Return note: {a.return_notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
