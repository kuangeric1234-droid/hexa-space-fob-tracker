/**
 * Import fob/remote submissions from the Google Sheets form export.
 *
 * Usage:
 *   npx tsx scripts/import-sheets.ts scripts/sheets-data.json
 *
 * Deposits are already paid — assignments are created with deposit_status='paid'
 * and no OfficeRnD fees are created. Safe to re-run: existing assignments are skipped.
 *
 * Requires env vars (same as import-csv.ts):
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

interface SheetRow {
  timestamp: string
  fullName: string
  companyName: string
  contact: string
  deviceType: string
  // Three fob/remote pairs matching the form columns
  fob1: string; remote1: string
  fob2: string; remote2: string
  fob3: string; remote3: string
}

interface Device {
  serial: string
  type: 'fob' | 'remote'
}

interface PersonGroup {
  fullName: string
  companyName: string
  email: string | null
  contact: string
  devices: Device[]
  invalidRaw: string[]
}

// Extracts the leading hex sequence from a raw cell value, ignoring annotations
// like "(25)" or trailing garbage. Returns null if no valid sequence found.
function extractHexSerial(raw: string): string | null {
  const cleaned = raw.toUpperCase().replace(/\s+/g, '')
  const match = cleaned.match(/^([0-9A-F]{10,})/)
  return match ? match[1] : null
}

function extractEmail(contact: string): string | null {
  const m = contact.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/i)
  return m ? m[0].toLowerCase() : null
}

function collectDevices(
  row: SheetRow,
  invalidRaw: string[]
): Device[] {
  const pairs: [string, 'fob' | 'remote'][] = [
    [row.fob1, 'fob'], [row.remote1, 'remote'],
    [row.fob2, 'fob'], [row.remote2, 'remote'],
    [row.fob3, 'fob'], [row.remote3, 'remote'],
  ]
  const devices: Device[] = []
  for (const [raw, type] of pairs) {
    if (!raw?.trim()) continue
    const serial = extractHexSerial(raw)
    if (serial) {
      devices.push({ serial, type })
    } else {
      invalidRaw.push(`${raw} (expected ${type})`)
    }
  }
  return devices
}

function groupByPerson(rows: SheetRow[]): PersonGroup[] {
  const map = new Map<string, PersonGroup>()

  for (const row of rows) {
    if (!row.fullName?.trim()) continue

    const key = `${row.fullName.trim().toLowerCase()}||${(row.companyName ?? '').trim().toLowerCase()}`
    const email = extractEmail(row.contact ?? '')

    if (!map.has(key)) {
      map.set(key, {
        fullName: row.fullName.trim(),
        companyName: row.companyName?.trim() ?? '',
        email,
        contact: row.contact ?? '',
        devices: [],
        invalidRaw: [],
      })
    }

    const person = map.get(key)!
    if (email && !person.email) person.email = email

    const newDevices = collectDevices(row, person.invalidRaw)
    for (const d of newDevices) {
      if (!person.devices.some(x => x.serial === d.serial)) {
        person.devices.push(d)
      }
    }
  }

  return Array.from(map.values())
}

async function findOrCreateMember(person: PersonGroup): Promise<string | null> {
  if (person.email) {
    const { data } = await supabase
      .from('members')
      .select('id')
      .ilike('email', person.email)
      .limit(1)
      .maybeSingle()
    if (data) return data.id
  }

  const { data: byName } = await supabase
    .from('members')
    .select('id')
    .ilike('name', person.fullName)
    .limit(1)
    .maybeSingle()
  if (byName) return byName.id

  const { data: created, error } = await supabase
    .from('members')
    .insert({
      officernd_id: `import-sheets-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: person.fullName,
      company: person.companyName || null,
      email: person.email || null,
      status: 'active',
    })
    .select('id')
    .single()

  if (error || !created) {
    console.error(`  Failed to create member: ${error?.message}`)
    return null
  }

  return created.id
}

async function main() {
  const jsonPath = process.argv[2]
  if (!jsonPath) {
    console.error('Usage: npx tsx scripts/import-sheets.ts <path-to-json>')
    process.exit(1)
  }

  const rows: SheetRow[] = JSON.parse(readFileSync(resolve(jsonPath), 'utf-8'))
  console.log(`Read ${rows.length} rows`)

  const people = groupByPerson(rows)
  console.log(`Grouped into ${people.length} people\n`)

  const results = {
    membersFound: 0,
    membersCreated: 0,
    fobsImported: 0,
    assignmentsCreated: 0,
    assignmentsSkipped: 0,
    peopleWithNoValidDevices: [] as string[],
    invalidSerials: [] as string[],
    errors: [] as string[],
  }

  for (const person of people) {
    const tag = `${person.fullName}${person.companyName ? ` (${person.companyName})` : ''}`

    if (person.invalidRaw.length > 0) {
      for (const raw of person.invalidRaw) {
        results.invalidSerials.push(`${tag}: ${raw}`)
      }
    }

    if (person.devices.length === 0) {
      results.peopleWithNoValidDevices.push(tag)
      console.log(`  SKIP  ${tag} — no valid device serials`)
      continue
    }

    const memberId = await findOrCreateMember(person)
    if (!memberId) {
      results.errors.push(`${tag}: could not find or create member`)
      continue
    }

    for (const device of person.devices) {
      const { data: fob, error: fobErr } = await supabase
        .from('fobs')
        .upsert(
          { serial_number: device.serial, type: device.type, location: 'hexa', status: 'assigned' },
          { onConflict: 'serial_number' }
        )
        .select('id')
        .single()

      if (fobErr || !fob) {
        results.errors.push(`${tag} / ${device.serial}: ${fobErr?.message ?? 'fob upsert failed'}`)
        continue
      }

      results.fobsImported++

      const { data: existing } = await supabase
        .from('assignments')
        .select('id')
        .eq('fob_id', fob.id)
        .is('returned_at', null)
        .maybeSingle()

      if (existing) {
        results.assignmentsSkipped++
        continue
      }

      const { error: assignErr } = await supabase.from('assignments').insert({
        fob_id: fob.id,
        member_id: memberId,
        issued_at: new Date().toISOString(),
        deposit_amount: device.type === 'remote' ? 200 : 100,
        deposit_status: 'paid',
        issue_notes: 'Imported from Google Sheets — deposit already paid',
      })

      if (assignErr) {
        results.errors.push(`${tag} / ${device.serial}: ${assignErr.message}`)
      } else {
        results.assignmentsCreated++
        process.stdout.write(`  OK    ${tag} — ${device.type} ${device.serial}\n`)
      }
    }
  }

  await supabase.from('audit_log').insert({
    action: 'sheets_import',
    entity_type: 'bulk',
    metadata: results,
  })

  console.log('\n--- Results ---')
  console.log(`Fobs upserted:         ${results.fobsImported}`)
  console.log(`Assignments created:   ${results.assignmentsCreated}`)
  console.log(`Assignments skipped:   ${results.assignmentsSkipped} (already existed)`)

  if (results.peopleWithNoValidDevices.length > 0) {
    console.log(`\nNo valid devices (${results.peopleWithNoValidDevices.length}) — follow up needed:`)
    results.peopleWithNoValidDevices.forEach(p => console.log(`  - ${p}`))
  }

  if (results.invalidSerials.length > 0) {
    console.log(`\nInvalid serials flagged (${results.invalidSerials.length}):`)
    results.invalidSerials.forEach(s => console.log(`  - ${s}`))
  }

  if (results.errors.length > 0) {
    console.error(`\nErrors (${results.errors.length}):`)
    results.errors.forEach(e => console.error(`  - ${e}`))
  }
}

main().catch(console.error)
