'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { Member, Fob, AssignmentWithRelations } from '@/types'

interface SearchResult {
  members: Member[]
  fobs: (Fob & { current_holder?: string })[]
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!query.trim()) {
      setResults(null)
      setOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setOpen(true)
        }
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members, serials, suites..."
          className="pl-9"
        />
      </div>

      {open && results && (
        <div className="absolute top-full mt-1 w-full bg-white rounded-md border shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.members.length === 0 && results.fobs.length === 0 && (
            <p className="text-sm text-gray-500 px-4 py-3">No results found.</p>
          )}

          {results.members.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 px-4 py-2 uppercase tracking-wide">Members</p>
              {results.members.map((m) => (
                <button
                  key={m.id}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between gap-2"
                  onClick={() => {
                    router.push(`/members/${m.id}`)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <div>
                    <span className="text-sm font-medium">{m.name}</span>
                    {m.suite && <span className="text-xs text-gray-500 ml-2">{m.suite}</span>}
                  </div>
                  <Badge variant={m.status === 'active' ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {m.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {results.fobs.length > 0 && (
            <div className={results.members.length > 0 ? 'border-t' : ''}>
              <p className="text-xs font-medium text-gray-400 px-4 py-2 uppercase tracking-wide">Fobs & remotes</p>
              {results.fobs.map((f) => (
                <button
                  key={f.id}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between gap-2"
                  onClick={() => {
                    router.push(`/fobs/${f.id}`)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{f.serial_number}</span>
                    <span className="text-xs text-gray-500">{f.type}</span>
                  </div>
                  <Badge
                    variant={f.status === 'available' ? 'default' : 'secondary'}
                    className="text-xs shrink-0"
                  >
                    {f.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
