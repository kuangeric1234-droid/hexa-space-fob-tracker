'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Upload, Download, CheckCircle, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ImportResult {
  imported: number
  assigned: number
  skipped: number
  errors: string[]
}

export function FobImport() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/fobs/import', { method: 'POST', body: formData })
      const data: ImportResult = await res.json()

      if (!res.ok) {
        toast.error((data as any).error ?? 'Import failed')
        return
      }

      setResult(data)
      if (data.imported > 0) {
        toast.success(`Imported ${data.imported} fobs, ${data.assigned} assigned.`)
        router.refresh()
      } else {
        toast.warning('No fobs were imported.')
      }
    } catch {
      toast.error('Import failed — check the file format')
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <a href="/api/fobs/template" download>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-3.5 w-3.5" />
            Download template
          </Button>
        </a>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => { setOpen(!open); setResult(null) }}
        >
          <Upload className="h-3.5 w-3.5" />
          Import CSV
        </Button>
      </div>

      {open && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Import fobs from CSV</CardTitle>
            <CardDescription>
              Download the template, fill it in, then upload it here. Members must already be synced from OfficeRnD for assignments to work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-6 w-6 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {loading ? 'Importing...' : 'Click to select your CSV file'}
              </p>
              <p className="text-xs text-gray-400 mt-1">.csv files only</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
                disabled={loading}
              />
            </div>

            {result && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 border">
                  <div className="flex items-center gap-1.5 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span>{result.imported} fobs imported</span>
                  </div>
                  <div className="text-gray-500">{result.assigned} assignments created</div>
                  {result.skipped > 0 && <div className="text-gray-400">{result.skipped} skipped</div>}
                </div>
                {result.errors.length > 0 && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-100 space-y-1">
                    <p className="text-xs font-medium text-red-700 flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5" />
                      {result.errors.length} issue{result.errors.length !== 1 ? 's' : ''}
                    </p>
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600 font-mono">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
