'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { normalizeSerial, formatCurrency } from '@/lib/utils'
import type { Member } from '@/types'

export default function IssuePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)

  const [serial, setSerial] = useState('')
  const [serialError, setSerialError] = useState<string | null>(null)
  const [type, setType] = useState<'fob' | 'remote'>('fob')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [issueNotes, setIssueNotes] = useState('')

  const [settings, setSettings] = useState({ default_fob_deposit: 100, default_remote_deposit: 200 })

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings).catch(() => {})
  }, [])

  const depositAmount = type === 'remote' ? settings.default_remote_deposit : settings.default_fob_deposit

  useEffect(() => {
    if (!memberQuery.trim() || selectedMember) { setMemberResults([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(memberQuery)}`)
      if (res.ok) {
        const data = await res.json()
        setMemberResults(data.members ?? [])
        setShowMemberDropdown(true)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [memberQuery, selectedMember])

  async function validateSerial() {
    const norm = normalizeSerial(serial)
    if (!norm) return
    const res = await fetch(`/api/fobs/check-serial?serial=${encodeURIComponent(norm)}`)
    if (res.ok) {
      const data = await res.json()
      if (data.assigned) setSerialError(`This serial is currently assigned to ${data.holder}`)
      else setSerialError(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMember) return toast.error('Select a member first')
    if (!serial.trim()) return toast.error('Enter a serial number')
    if (serialError) return toast.error(serialError)

    setLoading(true)
    const formData = new FormData()
    formData.set('member_id', selectedMember.id)
    formData.set('serial_number', serial)
    formData.set('type', type)
    formData.set('location', 'hexa')
    if (expectedReturn) formData.set('expected_return_at', new Date(expectedReturn).toISOString())
    if (issueNotes) formData.set('issue_notes', issueNotes)

    try {
      const { issueFob } = await import('@/lib/actions/issue')
      const result = await issueFob(formData)
      if (!result.success) { toast.error(result.error ?? 'Failed to issue fob'); return }
      if (result.depositWarning) {
        toast.warning('Fob issued, but the deposit invoice in OfficeRnD failed. Check the audit log.')
      } else {
        toast.success('Fob issued. Deposit invoice sent via OfficeRnD.')
      }
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-semibold">Issue fob</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Member */}
            <div className="space-y-2">
              <Label>Member</Label>
              {selectedMember ? (
                <div className="flex items-center justify-between p-3 rounded-md border bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{selectedMember.name}</p>
                    <p className="text-xs text-gray-500">{selectedMember.suite ?? selectedMember.company ?? ''}</p>
                  </div>
                  <button type="button" className="text-xs text-gray-400 hover:text-gray-700"
                    onClick={() => { setSelectedMember(null); setMemberQuery('') }}>
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Search member name..."
                    autoComplete="off"
                  />
                  {showMemberDropdown && memberResults.length > 0 && (
                    <div className="absolute top-full mt-1 w-full bg-white border rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
                      {memberResults.map((m) => (
                        <button key={m.id} type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                          onClick={() => { setSelectedMember(m); setMemberQuery(m.name); setShowMemberDropdown(false) }}>
                          <span className="font-medium">{m.name}</span>
                          {m.suite && <span className="text-gray-400 ml-2 text-xs">{m.suite}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Serial number */}
            <div className="space-y-2">
              <Label htmlFor="serial">Serial number</Label>
              <Input
                id="serial"
                value={serial}
                onChange={(e) => { setSerial(e.target.value); setSerialError(null) }}
                onBlur={validateSerial}
                placeholder="e.g. FOB-001"
                className="font-mono"
              />
              {serialError && <p className="text-xs text-red-600">{serialError}</p>}
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => v && setType(v as 'fob' | 'remote')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fob">Fob — deposit {formatCurrency(settings.default_fob_deposit)}</SelectItem>
                  <SelectItem value="remote">Remote — deposit {formatCurrency(settings.default_remote_deposit)}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Deposit: <span className="font-medium">{formatCurrency(depositAmount)}</span>
              </p>
            </div>

            {/* Expected return */}
            <div className="space-y-2">
              <Label htmlFor="expected_return">Expected return date (optional)</Label>
              <Input
                id="expected_return"
                type="date"
                value={expectedReturn}
                onChange={(e) => setExpectedReturn(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="issue_notes">Issue notes (optional)</Label>
              <Textarea
                id="issue_notes"
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
                rows={2}
                placeholder="Any notes about this issue..."
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Issuing...' : 'Issue fob'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
