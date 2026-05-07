'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, daysOverdue } from '@/lib/utils'
import type { AssignmentWithRelations } from '@/types'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

function ReturnForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSerial = searchParams.get('serial') ?? ''

  const [query, setQuery] = useState(initialSerial)
  const [results, setResults] = useState<AssignmentWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithRelations | null>(null)
  const [returnNotes, setReturnNotes] = useState('')
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<'refund' | 'waive' | 'none' | null>(null)

  useEffect(() => {
    if (initialSerial) searchAssignments(initialSerial)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function searchAssignments(q: string) {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/assignments/open?q=${encodeURIComponent(q)}`)
      if (res.ok) setResults(await res.json())
    } finally {
      setSearching(false)
    }
  }

  function handleReturn(assignment: AssignmentWithRelations) {
    setSelectedAssignment(assignment)
    setShowRefundDialog(true)
  }

  async function submitReturn(action: 'refund' | 'waive' | 'none') {
    if (!selectedAssignment) return
    setLoading(true)
    setShowRefundDialog(false)

    const formData = new FormData()
    formData.set('assignment_id', selectedAssignment.id)
    formData.set('refund_action', action)
    if (returnNotes) formData.set('return_notes', returnNotes)

    try {
      const { returnFob } = await import('@/lib/actions/return')
      const result = await returnFob(formData)

      if (!result.success) {
        toast.error(result.error ?? 'Failed to process return')
        return
      }

      toast.success('Fob returned successfully.')
      setResults(results.filter(r => r.id !== selectedAssignment.id))
      setSelectedAssignment(null)
      setReturnNotes('')
    } finally {
      setLoading(false)
    }
  }

  const depositStatusColor: Record<string, string> = {
    pending: 'text-amber-600',
    paid: 'text-green-600',
    failed: 'text-red-600',
    refunded: 'text-gray-500',
    waived: 'text-gray-500',
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Return fob</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Search by member name or serial number</Label>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Jane Smith or FOB-001"
                onKeyDown={(e) => e.key === 'Enter' && searchAssignments(query)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => searchAssignments(query)}
                disabled={searching}
              >
                {searching ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>

          {results.length === 0 && query && !searching && (
            <p className="text-sm text-gray-500">No open assignments found.</p>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">{results.length} open assignment{results.length !== 1 ? 's' : ''} found</p>
              {results.map((a) => {
                const overdueDays = a.expected_return_at ? daysOverdue(a.expected_return_at) : 0
                return (
                  <div key={a.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-medium">{a.fob?.serial_number}</span>
                          <Badge variant="outline" className="text-xs">{a.fob?.type}</Badge>
                          {a.member?.status === 'cancelled' && (
                            <Badge variant="destructive" className="text-xs">Member cancelled</Badge>
                          )}
                          {overdueDays > 0 && (
                            <Badge variant="destructive" className="text-xs">{overdueDays}d overdue</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{a.member?.name}</p>
                        {a.member?.suite && <p className="text-xs text-gray-400">{a.member.suite}</p>}
                        <div className="text-xs text-gray-500 mt-1 space-x-3">
                          <span>Issued {formatDate(a.issued_at)}</span>
                          {a.expected_return_at && <span>Expected {formatDate(a.expected_return_at)}</span>}
                          <span className={depositStatusColor[a.deposit_status]}>
                            Deposit {formatCurrency(a.deposit_amount)} — {a.deposit_status}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleReturn(a)}
                        disabled={loading}
                      >
                        Return
                      </Button>
                    </div>

                    {selectedAssignment?.id === a.id && (
                      <div className="space-y-2 pt-2 border-t">
                        <Label htmlFor="return_notes">Return notes (optional)</Label>
                        <Textarea
                          id="return_notes"
                          value={returnNotes}
                          onChange={(e) => setReturnNotes(e.target.value)}
                          rows={2}
                          placeholder="Any notes about the return..."
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund dialog */}
      <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Handle deposit?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedAssignment && (
                <>
                  This assignment has a deposit of{' '}
                  <strong>{formatCurrency(selectedAssignment.deposit_amount)}</strong>{' '}
                  (status: <strong>{selectedAssignment.deposit_status}</strong>).
                  {selectedAssignment.deposit_status === 'paid' && (
                    <> The deposit has been paid — do you want to issue a refund in OfficeRnD?</>
                  )}
                  {selectedAssignment.deposit_status === 'pending' && (
                    <> The deposit is unpaid — do you want to void it in OfficeRnD?</>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => submitReturn('none')}
            >
              No action
            </Button>
            {selectedAssignment?.deposit_status === 'pending' ? (
              <Button
                variant="outline"
                size="sm"
                className="text-amber-700 border-amber-300"
                onClick={() => submitReturn('waive')}
              >
                Waive & void
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => submitReturn('refund')}
              >
                Refund deposit
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function ReturnPage() {
  return (
    <Suspense>
      <ReturnForm />
    </Suspense>
  )
}
