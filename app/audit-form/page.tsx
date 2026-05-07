'use client'

import { useState, useEffect, useRef } from 'react'
import { Key, CheckCircle } from 'lucide-react'

interface Member { id: string; name: string; company: string | null; suite: string | null }
interface KnownFob { assignment_id: string; serial_number: string; type: string }
interface FobConfirmation { assignment_id: string; serial_number: string; type: string; status: 'have' | 'lost' | 'returned' }
interface AdditionalFob { serial_number: string; notes: string }

export default function AuditFormPage() {
  const [step, setStep] = useState<'identity' | 'fobs' | 'done'>('identity')

  // Step 1
  const [nameQuery, setNameQuery] = useState('')
  const [nameResults, setNameResults] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [email, setEmail] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Step 2
  const [knownFobs, setKnownFobs] = useState<KnownFob[]>([])
  const [confirmations, setConfirmations] = useState<FobConfirmation[]>([])
  const [additionalFobs, setAdditionalFobs] = useState<AdditionalFob[]>([])
  const [notes, setNotes] = useState('')
  const [loadingFobs, setLoadingFobs] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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

  async function handleNextStep() {
    if (!selectedMember && !nameQuery.trim()) return
    setLoadingFobs(true)

    if (selectedMember) {
      const res = await fetch(`/api/audit-form/fobs?member_id=${selectedMember.id}`)
      if (res.ok) {
        const fobs: KnownFob[] = await res.json()
        setKnownFobs(fobs)
        setConfirmations(fobs.map(f => ({ ...f, status: 'have' })))
      }
    }

    setLoadingFobs(false)
    setStep('fobs')
  }

  function setStatus(assignmentId: string, status: 'have' | 'lost' | 'returned') {
    setConfirmations(prev => prev.map(c => c.assignment_id === assignmentId ? { ...c, status } : c))
  }

  function addFob() {
    setAdditionalFobs(prev => [...prev, { serial_number: '', notes: '' }])
  }

  function updateAdditional(i: number, field: 'serial_number' | 'notes', value: string) {
    setAdditionalFobs(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f))
  }

  function removeAdditional(i: number) {
    setAdditionalFobs(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/audit-form/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedMember?.id ?? null,
          member_name: selectedMember?.name ?? nameQuery.trim(),
          email,
          fob_confirmations: confirmations,
          additional_fobs: additionalFobs.filter(f => f.serial_number.trim()),
          notes,
        }),
      })
      if (res.ok) setStep('done')
    } finally {
      setSubmitting(false)
    }
  }

  const statusOptions: { value: 'have' | 'lost' | 'returned'; label: string; color: string }[] = [
    { value: 'have', label: 'I have it', color: 'border-green-400 bg-green-50 text-green-700' },
    { value: 'lost', label: 'Lost', color: 'border-red-400 bg-red-50 text-red-700' },
    { value: 'returned', label: 'Already returned', color: 'border-amber-400 bg-amber-50 text-amber-700' },
  ]

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[#f6f6fb] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Thanks, all done!</h2>
          <p className="text-gray-500 text-sm">Your response has been recorded. Our team will follow up if needed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f6fb] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center">
            <Key className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Hexa Space</p>
            <p className="text-xs text-gray-400">Fob & remote audit</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Progress */}
          <div className="flex border-b border-gray-100">
            {(['identity', 'fobs'] as const).map((s, i) => (
              <div key={s} className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${step === s ? 'text-violet-700 border-b-2 border-violet-600' : 'text-gray-400'}`}>
                {i + 1}. {s === 'identity' ? 'Your details' : 'Your fobs'}
              </div>
            ))}
          </div>

          <div className="p-6 space-y-5">
            {step === 'identity' && (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Hi there!</h2>
                  <p className="text-sm text-gray-500">We're doing a quick audit of all fobs and remotes. This only takes a minute.</p>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Your name</label>
                  {selectedMember ? (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-violet-200 bg-violet-50">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{selectedMember.name}</p>
                        <p className="text-xs text-gray-500">{selectedMember.suite ?? selectedMember.company ?? ''}</p>
                      </div>
                      <button className="text-xs text-violet-600 hover:text-violet-800"
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
                        <div className="absolute top-full mt-1 w-full bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden">
                          {nameResults.map(m => (
                            <button key={m.id} type="button"
                              className="w-full text-left px-4 py-3 hover:bg-violet-50 transition-colors"
                              onClick={() => { setSelectedMember(m); setNameQuery(m.name); setShowDropdown(false) }}>
                              <p className="text-sm font-medium text-gray-900">{m.name}</p>
                              {m.suite && <p className="text-xs text-gray-400">{m.suite}</p>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Email <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                <button
                  onClick={handleNextStep}
                  disabled={(!selectedMember && !nameQuery.trim()) || loadingFobs}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl text-sm transition-colors"
                >
                  {loadingFobs ? 'Loading...' : 'Next →'}
                </button>
              </>
            )}

            {step === 'fobs' && (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">Your fobs & remotes</h2>
                  <p className="text-sm text-gray-500">
                    {knownFobs.length > 0
                      ? 'We have these on record for you. Let us know the status of each.'
                      : "We don't have any fobs on record for you. If you have one, add it below."}
                  </p>
                </div>

                {/* Known fobs */}
                {confirmations.map(c => (
                  <div key={c.assignment_id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-gray-900">{c.serial_number}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{c.type}</span>
                    </div>
                    <div className="flex gap-2">
                      {statusOptions.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setStatus(c.assignment_id, opt.value)}
                          className={`flex-1 py-2 text-xs font-medium rounded-lg border-2 transition-all ${c.status === opt.value ? opt.color : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Additional fobs */}
                {additionalFobs.map((f, i) => (
                  <div key={i} className="border border-dashed border-violet-200 rounded-xl p-4 space-y-3 bg-violet-50/30">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">Additional fob</p>
                      <button onClick={() => removeAdditional(i)} className="text-xs text-gray-400 hover:text-red-500">Remove</button>
                    </div>
                    <input
                      type="text"
                      value={f.serial_number}
                      onChange={e => updateAdditional(i, 'serial_number', e.target.value)}
                      placeholder="Serial number (e.g. FOB-042)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <input
                      type="text"
                      value={f.notes}
                      onChange={e => updateAdditional(i, 'notes', e.target.value)}
                      placeholder="Any notes (optional)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addFob}
                  className="w-full border-2 border-dashed border-gray-200 text-gray-400 hover:border-violet-300 hover:text-violet-600 rounded-xl py-3 text-sm font-medium transition-colors"
                >
                  + I have a fob not listed above
                </button>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Anything else? <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    placeholder="e.g. I gave my fob to a colleague, it's broken, etc."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('identity')}
                    className="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm transition-colors"
                  >
                    {submitting ? 'Submitting...' : 'Submit audit response'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Hexa Space · Fob audit {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
