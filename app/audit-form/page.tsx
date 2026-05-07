'use client'

import { useState, useEffect, useRef } from 'react'
import { Key, CheckCircle, Plus, Trash2 } from 'lucide-react'

interface Member { id: string; name: string; company: string | null; suite: string | null }
interface FobEntry { type: 'fob' | 'remote'; serial: string }

export default function AuditFormPage() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Identity
  const [nameQuery, setNameQuery] = useState('')
  const [nameResults, setNameResults] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [email, setEmail] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fob entries
  const [entries, setEntries] = useState<FobEntry[]>([{ type: 'fob', serial: '' }])

  // Member search
  useEffect(() => {
    if (!nameQuery.trim() || selectedMember) { setNameResults([]); return }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/audit-form/members?q=${encodeURIComponent(nameQuery)}`)
      if (res.ok) { setNameResults(await res.json()); setShowDropdown(true) }
    }, 250)
    return () => clearTimeout(t)
  }, [nameQuery, selectedMember])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function updateEntry(i: number, field: keyof FobEntry, value: string) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }

  function addEntry() {
    setEntries(prev => [...prev, { type: 'fob', serial: '' }])
  }

  function removeEntry(i: number) {
    setEntries(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const name = selectedMember?.name ?? nameQuery.trim()
    if (!name) { setError('Please enter your name.'); return }

    const validEntries = entries.filter(e => e.serial.trim())
    if (validEntries.length === 0) { setError('Please enter at least one serial number.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/audit-form/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedMember?.id ?? null,
          member_name: name,
          email: email.trim() || null,
          fob_confirmations: validEntries.map(e => ({
            serial_number: e.serial.trim().toUpperCase().replace(/\s/g, ''),
            type: e.type,
            status: 'have',
          })),
          additional_fobs: [],
          notes: null,
        }),
      })
      if (res.ok) setSubmitted(true)
      else setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f6f6fb] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Thanks, all done!</h2>
          <p className="text-gray-500 text-sm">Your response has been recorded. We'll be in touch if anything needs following up.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f6fb] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center">
            <Key className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Hexa Space</p>
            <p className="text-xs text-gray-400">Fob & remote audit</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Fob & remote audit</h2>
            <p className="text-sm text-gray-500 mt-1">Please fill out the details of the fob or remote you currently hold.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Your name</label>
              {selectedMember ? (
                <div className="flex items-center justify-between p-3 rounded-xl border border-violet-200 bg-violet-50">
                  <p className="font-medium text-sm text-gray-900">{selectedMember.name}</p>
                  <button type="button" className="text-xs text-violet-600 hover:text-violet-800"
                    onClick={() => { setSelectedMember(null); setNameQuery('') }}>
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  <input
                    type="text"
                    value={nameQuery}
                    onChange={e => setNameQuery(e.target.value)}
                    placeholder="Start typing your name..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    autoComplete="off"
                  />
                  {showDropdown && nameResults.length > 0 && (
                    <div className="absolute top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-y-auto max-h-60">
                      {nameResults.map(m => (
                        <button key={m.id} type="button"
                          className="w-full text-left px-4 py-3 hover:bg-violet-50 transition-colors border-b border-gray-50 last:border-0"
                          onClick={() => { setSelectedMember(m); setNameQuery(m.name); setShowDropdown(false) }}>
                          <p className="text-sm font-medium text-gray-900">{m.name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {/* Fob entries */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Fobs & remotes you currently hold</label>

              {entries.map((entry, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <select
                    value={entry.type}
                    onChange={e => updateEntry(i, 'type', e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white shrink-0"
                  >
                    <option value="fob">Fob</option>
                    <option value="remote">Remote</option>
                  </select>
                  <input
                    type="text"
                    value={entry.serial}
                    onChange={e => updateEntry(i, 'serial', e.target.value)}
                    placeholder="Serial number"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                  {entries.length > 1 && (
                    <button type="button" onClick={() => removeEntry(i)}
                      className="p-3 text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <button type="button" onClick={addEntry}
                className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-medium transition-colors">
                <Plus className="h-4 w-4" />
                Add another fob or remote
              </button>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl text-sm transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Hexa Space · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
