'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type BookingStatus = 'inquiry' | 'agreement_sent' | 'deposit_pending' | 'confirmed' | 'completed' | 'cancelled'

const NEXT_TRANSITION: Partial<Record<BookingStatus, { status: BookingStatus; label: string }>> = {
  inquiry: { status: 'agreement_sent', label: 'Mark agreement sent' },
  agreement_sent: { status: 'deposit_pending', label: 'Mark agreement signed' },
  deposit_pending: { status: 'confirmed', label: 'Confirm booking' },
  confirmed: { status: 'completed', label: 'Mark completed' },
}

interface Booking {
  id: string
  status: BookingStatus
  internal_notes: string | null
}

export function BookingActions({ booking }: { booking: Booking }) {
  const router = useRouter()
  const [transitioning, setTransitioning] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [notes, setNotes] = useState(booking.internal_notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)

  const next = NEXT_TRANSITION[booking.status]
  const canCancel = booking.status !== 'cancelled' && booking.status !== 'completed'

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/function-space/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Request failed')
    }
  }

  async function advanceStatus() {
    if (!next) return
    setTransitioning(true)
    try {
      await patch({ status: next.status })
      toast.success(`Status updated`)
      router.refresh()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setTransitioning(false)
    }
  }

  async function cancelBooking() {
    setTransitioning(true)
    try {
      await patch({ status: 'cancelled' })
      toast.success('Booking cancelled')
      router.refresh()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setTransitioning(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    try {
      await patch({ internal_notes: notes })
      toast.success('Notes saved')
      router.refresh()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <>
      {/* Status actions */}
      {(next || canCancel) && (
        <div className="flex gap-2 flex-wrap">
          {next && (
            <Button onClick={advanceStatus} disabled={transitioning}>
              {next.label}
            </Button>
          )}
          {canCancel && (
            <>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={transitioning}
                onClick={() => setCancelOpen(true)}
              >
                Cancel booking
              </Button>
              <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The booking will be marked as cancelled. You can still view it under the Cancelled filter.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCancelOpen(false)}>Keep booking</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={cancelBooking}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Cancel booking
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}

      {/* Internal notes */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Internal notes</p>
          <Label htmlFor="internal_notes" className="sr-only">Internal notes</Label>
          <Textarea
            id="internal_notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Staff notes — not visible to client..."
          />
          <Button size="sm" variant="outline" onClick={saveNotes} disabled={savingNotes}>
            {savingNotes ? 'Saving...' : 'Save notes'}
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
