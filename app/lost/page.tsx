'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'
import type { AssignmentWithRelations } from '@/types'

export default function LostPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AssignmentWithRelations[]>([])
  const [searching, setSearching] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<string | null>(null)

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/assignments/open?q=${encodeURIComponent(query)}`)
      if (res.ok) setResults(await res.json())
    } finally {
      setSearching(false)
    }
  }

  async function handleMarkLost(assignment: AssignmentWithRelations) {
    setLoading(assignment.id)
    try {
      const { markFobLost } = await import('@/lib/actions/lost')
      const result = await markFobLost(assignment.id, notes[assignment.id])
      if (!result.success) {
        toast.error(result.error ?? 'Failed to mark as lost')
        return
      }
      toast.success(`${(assignment.fob as any)?.serial_number} marked as lost.`)
      setResults(results.filter(r => r.id !== assignment.id))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <h1 className="text-2xl font-semibold">Lost fob</h1>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Find by member or company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Member name or company..."
              onKeyDown={(e) => e.key === 'Enter' && search()}
            />
            <Button type="button" variant="outline" onClick={search} disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {results.length === 0 && query && !searching && (
            <p className="text-sm text-gray-500">No open assignments found.</p>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">{results.length} open assignment{results.length !== 1 ? 's' : ''}</p>
              {results.map((a) => (
                <div key={a.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-medium">{(a.fob as any)?.serial_number}</span>
                        <Badge variant="outline" className="text-xs">{(a.fob as any)?.type}</Badge>
                      </div>
                      <p className="text-sm text-gray-700 mt-0.5">{(a.member as any)?.name}</p>
                      {(a.member as any)?.company && (
                        <p className="text-xs text-gray-400">{(a.member as any).company}</p>
                      )}
                      <div className="text-xs text-gray-500 mt-1 space-x-3">
                        <span>Issued {formatDate(a.issued_at)}</span>
                        <span className="text-amber-600">
                          Deposit {formatCurrency(a.deposit_amount)} — {a.deposit_status}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={loading === a.id}
                      onClick={() => handleMarkLost(a)}
                    >
                      {loading === a.id ? 'Marking...' : 'Mark lost'}
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Notes (optional)</Label>
                    <Textarea
                      value={notes[a.id] ?? ''}
                      onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })}
                      rows={1}
                      placeholder="e.g. member reported lost on 01 May..."
                      className="text-sm"
                    />
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
