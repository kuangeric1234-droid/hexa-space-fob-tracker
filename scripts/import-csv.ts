/**
 * One-time CSV import script for migrating the existing Google Sheet data.
 *
 * Usage:
 *   npx tsx scripts/import-csv.ts ./fobs-export.csv
 *
 * Expected CSV columns (flexible, adjust mapping below):
 *   serial_number, type, location, status, member_name, issued_at, expected_return_at, notes
 *
 * Run against a Supabase project by setting env vars first:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const values = line.match(/(".*?"|[^,]+)/g) ?? []
    return Object.fromEntries(
      headers.map((h, i) => [h, (values[i] ?? '').trim().replace(/^"|"$/g, '')])
    )
  })
}

function normalizeSerial(s: string) {
  return s.toUpperCase().replace(/\s/g, '')
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('Usage: npx tsx scripts/import-csv.ts <path-to-csv>')
    process.exit(1)
  }

  const content = readFileSync(resolve(csvPath), 'utf-8')
  const rows = parseCSV(content)

  console.log(`Importing ${rows.length} rows...`)

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const serial = normalizeSerial(row.serial_number ?? '')
      if (!serial) { skipped++; continue }

      const type = row.type?.toLowerCase() === 'remote' ? 'remote' : 'fob'
      const location = (['hexa', 'panorama', 'kai', 'other'] as const).includes(
        row.location?.toLowerCase() as any
      )
        ? (row.location.toLowerCase() as any)
        : 'hexa'

      const isAssigned = row.status?.toLowerCase() === 'assigned' || !!row.member_name
      const fobStatus = isAssigned ? 'assigned' : 'available'

      // Upsert fob
      const { data: fob, error: fobErr } = await supabase
        .from('fobs')
        .upsert({ serial_number: serial, type, location, status: fobStatus, notes: row.notes || null }, {
          onConflict: 'serial_number',
        })
        .select()
        .single()

      if (fobErr || !fob) {
        errors.push(`${serial}: ${fobErr?.message}`)
        continue
      }

      // If assigned, find or create member and create assignment
      if (isAssigned && row.member_name) {
        const memberName = row.member_name.trim()

        let { data: member } = await supabase
          .from('members')
          .select('id')
          .ilike('name', memberName)
          .single()

        if (!member) {
          const { data: newMember } = await supabase
            .from('members')
            .insert({
              officernd_id: `import-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: memberName,
              status: 'active',
            })
            .select()
            .single()
          member = newMember
        }

        if (member) {
          // Check for existing open assignment
          const { data: existing } = await supabase
            .from('assignments')
            .select('id')
            .eq('fob_id', fob.id)
            .is('returned_at', null)
            .single()

          if (!existing) {
            const issuedAt = row.issued_at ? new Date(row.issued_at).toISOString() : new Date().toISOString()
            const expectedReturnAt = row.expected_return_at
              ? new Date(row.expected_return_at).toISOString()
              : null

            await supabase.from('assignments').insert({
              fob_id: fob.id,
              member_id: member.id,
              issued_at: issuedAt,
              expected_return_at: expectedReturnAt,
              deposit_amount: type === 'remote' ? 200 : 100,
              deposit_status: 'pending',
            })
          }
        }
      }

      imported++
      process.stdout.write(`\r${imported}/${rows.length} imported`)
    } catch (err) {
      errors.push(`Row ${JSON.stringify(row)}: ${err}`)
    }
  }

  console.log(`\n\nDone. Imported: ${imported}, Skipped: ${skipped}`)
  if (errors.length > 0) {
    console.error(`\nErrors (${errors.length}):`)
    errors.forEach((e) => console.error(' -', e))
  }
}

main().catch(console.error)
