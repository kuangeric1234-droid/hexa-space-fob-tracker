import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { BookingActions } from './booking-actions'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  inquiry: 'Inquiry',
  agreement_sent: 'Agreement Sent',
  deposit_pending: 'Deposit Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  inquiry: 'bg-gray-100 text-gray-700',
  agreement_sent: 'bg-blue-100 text-blue-700',
  deposit_pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-violet-100 text-violet-700',
  cancelled: 'bg-red-50 text-red-600',
}

const AUDIT_LABELS: Record<string, string> = {
  booking_created: 'Booking created',
  booking_status_agreement_sent: 'Agreement sent',
  booking_status_deposit_pending: 'Agreement signed — awaiting deposit',
  booking_status_confirmed: 'Booking confirmed',
  booking_status_completed: 'Marked as completed',
  booking_status_cancelled: 'Booking cancelled',
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-gray-50 last:border-0 gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? '—'}</span>
    </div>
  )
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: booking } = await supabase
    .from('function_space_bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (!booking) notFound()

  const { data: auditEntries } = await supabase
    .from('audit_log')
    .select('action, created_at')
    .eq('entity_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <Link href="/function-space" className="text-sm text-gray-400 hover:text-gray-600">
          ← Function Space
        </Link>
        <div className="flex items-start justify-between gap-4 mt-1">
          <div>
            <h1 className="text-2xl font-semibold">{booking.client_name}</h1>
            {booking.client_company && (
              <p className="text-gray-500 text-sm mt-0.5">{booking.client_company}</p>
            )}
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium shrink-0 ${STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {STATUS_LABELS[booking.status]}
          </span>
        </div>
      </div>

      {/* Action buttons + internal notes (client component) */}
      <BookingActions booking={booking} />

      {/* Event */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Event</p>
          <InfoRow label="Space" value={booking.space_name} />
          <InfoRow
            label="Date"
            value={format(new Date(booking.event_date), 'EEEE d MMMM yyyy')}
          />
          <InfoRow
            label="Time"
            value={`${booking.start_time.slice(0, 5)} – ${booking.end_time.slice(0, 5)}`}
          />
          <InfoRow label="Event type" value={booking.event_type} />
          <InfoRow label="Guests" value={booking.guest_count} />
        </CardContent>
      </Card>

      {/* Client */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Client</p>
          <InfoRow label="Name" value={booking.client_name} />
          <InfoRow label="Company" value={booking.client_company} />
          <InfoRow label="Email" value={booking.client_email} />
          <InfoRow label="Phone" value={booking.client_phone} />
        </CardContent>
      </Card>

      {/* Financials */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Financials</p>
          <InfoRow
            label="Hire fee"
            value={booking.hire_fee != null ? `$${Number(booking.hire_fee).toFixed(2)}` : null}
          />
          <InfoRow
            label="Deposit"
            value={booking.deposit_amount != null ? `$${Number(booking.deposit_amount).toFixed(2)}` : null}
          />
          <InfoRow label="Deposit status" value={booking.deposit_status} />
          {booking.officernd_fee_id && (
            <InfoRow label="OfficeRnD fee ID" value={booking.officernd_fee_id} />
          )}
        </CardContent>
      </Card>

      {/* Client-facing notes */}
      {booking.notes && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{booking.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Activity log */}
      {auditEntries && auditEntries.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Activity</p>
            <div className="space-y-2">
              {auditEntries.map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">
                    {AUDIT_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className="text-gray-400 shrink-0 ml-4">
                    {format(new Date(entry.created_at), 'd MMM, HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
