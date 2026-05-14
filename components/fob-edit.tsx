'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Fob } from '@/types'

interface FobEditProps {
  fob: Fob
}

export function FobEdit({ fob }: FobEditProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const [serial, setSerial] = useState(fob.serial_number)
  const [type, setType] = useState(fob.type)
  const [location, setLocation] = useState(fob.location)
  const [status, setStatus] = useState(fob.status)
  const [notes, setNotes] = useState(fob.notes ?? '')

  function resetToFob() {
    setSerial(fob.serial_number)
    setType(fob.type)
    setLocation(fob.location)
    setStatus(fob.status)
    setNotes(fob.notes ?? '')
  }

  async function handleSave() {
    if (!serial.trim()) {
      toast.error('Serial number is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/fobs/${fob.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial_number: serial, type, location, status, notes }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to save changes')
        return
      }
      toast.success('Fob updated')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => { resetToFob(); setOpen(true) }}
      >
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit fob</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="serial">Serial number</Label>
              <Input
                id="serial"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="font-mono"
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as Fob['type'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fob">fob</SelectItem>
                    <SelectItem value="remote">remote</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={location} onValueChange={(v) => setLocation(v as Fob['location'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hexa">hexa</SelectItem>
                    <SelectItem value="panorama">panorama</SelectItem>
                    <SelectItem value="kai">kai</SelectItem>
                    <SelectItem value="other">other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Fob['status'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">available</SelectItem>
                  <SelectItem value="assigned">assigned</SelectItem>
                  <SelectItem value="lost">lost</SelectItem>
                  <SelectItem value="deactivated">deactivated</SelectItem>
                  <SelectItem value="retired">retired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
