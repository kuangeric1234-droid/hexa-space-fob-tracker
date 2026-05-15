'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Member } from '@/types'

const EVENT_TYPES = [
  'Corporate event',
  'Birthday / celebration',
  'Product launch',
  'Workshop / training',
  'Networking event',
  'Conference',
  'Other',
]

const SPACES = ['Function Space']

export default function NewBookingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Member search
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState<Member[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [linkedMember, setLinkedMember] = useState<Member | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!memberQuery.trim() || linkedMember) { setMemberResults([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(memberQuery)}`)
      if (res.ok) {
        const data = await res.json()
        setMemberResults(data.members ?? [])
        setShowDropdown(true)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [memberQuery, linkedMember])

  function selectMember(m: Member) {
    setLinkedMember(m)
    setMemberQuery(m.name)
    setShowDropdown(false)
    setForm(f => ({
      ...f,
      client_name: m.name,
      client_company: m.company ?? '',
      client_email: m.email ?? '',
    }))
  }

  function clearMember() {
    setLinkedMember(null)
    setMemberQuery('')
  }

  const [form, setForm] = useState({
    client_name: '',
    client_company: '',
    client_email: '',
    client_phone: '',
    space_name: 'Function Space',
    event_date: '',
    start_time: '',
    end_time: '',
    guest_count: '',
    event_type: '',
    hire_fee: '',
    deposit_amount: '',
    notes: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_name.trim()) return toast.error('Client name is required')
    if (!form.event_date) return toast.error('Event date is required')
    if (!form.start_time || !form.end_time) return toast.error('Start and end time are required')

    setLoading(true)
    try {
      const res = await fetch('/api/function-space', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          guest_count: form.guest_count ? parseInt(form.guest_count) : null,
          hire_fee: form.hire_fee ? parseFloat(form.hire_fee) : null,
          deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null,
          event_type: form.event_type || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create booking')
        return
      }
      toast.success('Booking created')
      router.push(`/function-space/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/function-space" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold">New booking</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Client */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Client</p>

            {/* Member search */}
            <div className="space-y-2">
              <Label>Search existing member (optional)</Label>
              <div className="relative" ref={dropdownRef}>
                {linkedMember ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-md border bg-violet-50 border-violet-200">
                    <div>
                      <span className="text-sm font-medium text-violet-800">{linkedMember.name}</span>
                      {linkedMember.company && (
                        <span className="text-xs text-violet-500 ml-2">{linkedMember.company}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearMember}
                      className="text-xs text-violet-400 hover:text-violet-700"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <Input
                    value={memberQuery}
                    onChange={e => setMemberQuery(e.target.value)}
                    onFocus={() => memberResults.length > 0 && setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    placeholder="Type a name or company to search members..."
                    autoComplete="off"
                  />
                )}
                {showDropdown && memberResults.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-white border rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
                    {memberResults.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        onMouseDown={() => selectMember(m)}
                      >
                        <span className="font-medium">{m.name}</span>
                        {m.company && <span className="text-gray-400 ml-2 text-xs">{m.company}</span>}
                        {m.suite && <span className="text-gray-300 ml-2 text-xs">{m.suite}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400">Selecting a member pre-fills the fields below. You can still edit them.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_name">Name *</Label>
                <Input
                  id="client_name"
                  value={form.client_name}
                  onChange={e => set('client_name', e.target.value)}
                  placeholder="Full name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_company">Company</Label>
                <Input
                  id="client_company"
                  value={form.client_company}
                  onChange={e => set('client_company', e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_email">Email</Label>
                <Input
                  id="client_email"
                  type="email"
                  value={form.client_email}
                  onChange={e => set('client_email', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_phone">Phone</Label>
                <Input
                  id="client_phone"
                  value={form.client_phone}
                  onChange={e => set('client_phone', e.target.value)}
                  placeholder="04xx xxx xxx"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Event details */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Event details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event_date">Date *</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={form.event_date}
                  onChange={e => set('event_date', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Space</Label>
                <Select value={form.space_name} onValueChange={v => v && set('space_name', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPACES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_time">Start time *</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={form.start_time}
                  onChange={e => set('start_time', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End time *</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={form.end_time}
                  onChange={e => set('end_time', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Event type</Label>
                <Select value={form.event_type} onValueChange={v => v && set('event_type', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_count">Expected guests</Label>
                <Input
                  id="guest_count"
                  type="number"
                  min="1"
                  value={form.guest_count}
                  onChange={e => set('guest_count', e.target.value)}
                  placeholder="e.g. 50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financials */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Financials</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hire_fee">Hire fee (AUD)</Label>
                <Input
                  id="hire_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.hire_fee}
                  onChange={e => set('hire_fee', e.target.value)}
                  placeholder="e.g. 800.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit_amount">Deposit (AUD)</Label>
                <Input
                  id="deposit_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.deposit_amount}
                  onChange={e => set('deposit_amount', e.target.value)}
                  placeholder="e.g. 200.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</p>
            <div className="space-y-2">
              <Label htmlFor="notes">Client-facing notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                placeholder="Special requirements, catering notes, access instructions..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create booking'}
          </Button>
          <Link href="/function-space" className={cn(buttonVariants({ variant: 'outline' }))}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
