'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AppSettings } from '@/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Synced ${data.synced} members from OfficeRnD.`)
      } else {
        toast.error(data.error ?? 'Sync failed')
      }
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => { setSettings(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_fob_deposit: settings.default_fob_deposit,
          default_remote_deposit: settings.default_remote_deposit,
          notification_email: settings.notification_email,
          auto_create_deposit_fee: settings.auto_create_deposit_fee,
          auto_refund_on_return: settings.auto_refund_on_return,
        }),
      })
      if (res.ok) {
        toast.success('Settings saved.')
      } else {
        toast.error('Failed to save settings.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>
  if (!settings) return <p className="text-sm text-red-600">Failed to load settings.</p>

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <form onSubmit={handleSave} className="space-y-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Deposit defaults</CardTitle>
            <CardDescription>Default deposit amounts when issuing fobs and remotes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fob_deposit">Fob deposit (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  id="fob_deposit"
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={settings.default_fob_deposit}
                  onChange={(e) => setSettings({ ...settings, default_fob_deposit: parseFloat(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="remote_deposit">Remote deposit (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <Input
                  id="remote_deposit"
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={settings.default_remote_deposit}
                  onChange={(e) => setSettings({ ...settings, default_remote_deposit: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">OfficeRnD integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-create deposit fee</p>
                <p className="text-xs text-gray-500">Create a deposit fee in OfficeRnD when issuing a fob.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.auto_create_deposit_fee}
                onChange={(e) => setSettings({ ...settings, auto_create_deposit_fee: e.target.checked })}
                className="h-4 w-4"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-refund on return</p>
                <p className="text-xs text-gray-500">Automatically issue a refund/void in OfficeRnD when returning.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.auto_refund_on_return}
                onChange={(e) => setSettings({ ...settings, auto_refund_on_return: e.target.checked })}
                className="h-4 w-4"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>The nightly cron sends a digest to this email if action is needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="notification_email">Notification email</Label>
              <Input
                id="notification_email"
                type="email"
                value={settings.notification_email ?? ''}
                onChange={(e) => setSettings({ ...settings, notification_email: e.target.value || null })}
                placeholder="ops@hexaspace.com"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save settings'}
        </Button>
      </form>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">OfficeRnD member sync</CardTitle>
          <CardDescription>Manually pull the latest members from OfficeRnD right now instead of waiting for the nightly job.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync members now'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
