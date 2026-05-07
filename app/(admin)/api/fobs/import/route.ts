import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase())
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
      current += char
    }
    values.push(current.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

function normalizeSerial(s: string) {
  return s.toUpperCase().replace(/\s/g, '')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)

  const results = { imported: 0, assigned: 0, skipped: 0, errors: [] as string[] }

  // Get settings for deposit defaults
  const { data: settings } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  const defaultFobDeposit = settings?.default_fob_deposit ?? 100
  const defaultRemoteDeposit = settings?.default_remote_deposit ?? 200

  for (const row of rows) {
    const serial = normalizeSerial(row.serial_number ?? '')
    if (!serial) { results.skipped++; continue }

    const type = row.type?.toLowerCase() === 'remote' ? 'remote' : 'fob'
    const validStatuses = ['available', 'assigned', 'lost', 'deactivated', 'retired']
    const status = validStatuses.includes(row.status?.toLowerCase())
      ? row.status.toLowerCase()
      : 'available'

    try {
      // Upsert fob
      const { data: fob, error: fobErr } = await supabase
        .from('fobs')
        .upsert(
          { serial_number: serial, type, status, notes: row.notes || null },
          { onConflict: 'serial_number' }
        )
        .select()
        .single()

      if (fobErr || !fob) {
        results.errors.push(`${serial}: ${fobErr?.message ?? 'failed to upsert'}`)
        continue
      }

      results.imported++

      // Handle member assignment
      const memberName = row.member_name?.trim()
      if (memberName && status !== 'available') {
        // Find member by name (case-insensitive)
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .ilike('name', memberName)
          .limit(1)
          .single()

        if (!member) {
          results.errors.push(`${serial}: member "${memberName}" not found — fob imported without assignment`)
          continue
        }

        // Check no open assignment already exists
        const { data: existing } = await supabase
          .from('assignments')
          .select('id')
          .eq('fob_id', fob.id)
          .is('returned_at', null)
          .single()

        if (!existing) {
          const issuedAt = row.issued_at
            ? new Date(row.issued_at).toISOString()
            : new Date().toISOString()
          const expectedReturn = row.expected_return_at
            ? new Date(row.expected_return_at).toISOString()
            : null

          const { error: assignErr } = await supabase.from('assignments').insert({
            fob_id: fob.id,
            member_id: member.id,
            issued_at: issuedAt,
            expected_return_at: expectedReturn,
            deposit_amount: type === 'remote' ? defaultRemoteDeposit : defaultFobDeposit,
            deposit_status: 'pending',
            issue_notes: row.notes || null,
          })

          if (assignErr) {
            results.errors.push(`${serial}: assignment failed — ${assignErr.message}`)
          } else {
            results.assigned++
          }
        }
      }
    } catch (err) {
      results.errors.push(`${serial}: ${String(err)}`)
    }
  }

  await supabase.from('audit_log').insert({
    action: 'fob_import',
    entity_type: 'bulk',
    metadata: results,
  })

  return NextResponse.json(results)
}
