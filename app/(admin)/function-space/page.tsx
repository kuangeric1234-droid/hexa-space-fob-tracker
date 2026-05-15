import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

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
  inquiry: 'bg-gray-100 text-gray-700 border-gray-200',
  agreement_sent: 'bg-blue-100 text-blue-700 border-blue-200',
  deposit_pending: 'bg-amber-100 text-amber-700 border-amber-200',
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-violet-100 text-violet-700 border-violet-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
}

const FILTER_TABS = [
  { label: 'Active', value: 'active' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'All', value: 'all' },
]

export default async function FunctionSpacePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { filter = 'active' } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('function_space_bookings')
    .select('*')
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (filter === 'active') {
    query = query.in('status', ['inquiry', 'agreement_sent', 'deposit_pending', 'confirmed'])
  } else if (filter !== 'all') {
    query = query.eq('status', filter)
  }

  const { data: bookings } = await query

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Function Space</h1>
        <Link href="/function-space/new" className={cn(buttonVariants())}>
          + New booking
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/function-space?filter=${tab.value}`}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === tab.value
                ? 'bg-violet-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {bookings && bookings.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Space</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium">
                      {format(new Date(booking.event_date), 'd MMM yyyy')}
                    </span>
                    <span className="block text-xs text-gray-400">
                      {booking.start_time.slice(0, 5)} – {booking.end_time.slice(0, 5)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{booking.client_name}</span>
                    {booking.client_company && (
                      <span className="block text-xs text-gray-400">{booking.client_company}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {booking.space_name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {booking.event_type ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[booking.status] ?? ''}`}>
                      {STATUS_LABELS[booking.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/function-space/${booking.id}`}
                      className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg">
          <p className="text-sm text-gray-400">No bookings found</p>
          {filter === 'active' && (
            <Link
              href="/function-space/new"
              className="mt-2 inline-block text-xs text-violet-600 hover:underline"
            >
              Create the first booking →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
