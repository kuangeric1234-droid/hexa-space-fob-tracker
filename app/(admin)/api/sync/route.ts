import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllMembers, resolveAllCompanies, fetchActiveMemberships, buildSuiteMaps } from '@/lib/officernd/client'

export async function POST() {
  const supabase = await createClient()

  try {
    const members = await fetchAllMembers()

    if (members.length === 0) {
      return NextResponse.json({ error: 'OfficeRnD returned 0 members' }, { status: 500 })
    }

    const [companyMap, memberships] = await Promise.all([
      resolveAllCompanies(members),
      fetchActiveMemberships(),
    ])
    const { memberSuiteMap, teamSuiteMap, memberParkingMap, teamParkingMap } = buildSuiteMaps(memberships)

    const now = new Date().toISOString()

    for (const m of members) {
      const companyId = m.team ?? (typeof m.company === 'string' ? m.company : m.company?._id)

      const suite = memberSuiteMap.get(m._id)
        ?? (companyId ? teamSuiteMap.get(companyId) : null)
        ?? null

      const parking = memberParkingMap.get(m._id)
        ?? (companyId ? teamParkingMap.get(companyId) : null)
        ?? null

      await supabase.from('members').upsert(
        {
          officernd_id: m._id,
          name: m.name,
          email: m.email ?? null,
          company: companyId ? (companyMap.get(companyId) ?? null) : null,
          suite,
          parking,
          status: mapStatus(m.calculatedStatus ?? m.status),
          last_synced_at: now,
        },
        { onConflict: 'officernd_id' }
      )
    }

    // Mark members not in the response as cancelled
    const { data: existing } = await supabase.from('members').select('id, officernd_id')
    const orndIds = new Set(members.map((m) => m._id))
    const toCancel = (existing ?? []).filter((m) => !orndIds.has(m.officernd_id))

    if (toCancel.length > 0) {
      await supabase
        .from('members')
        .update({ status: 'cancelled', last_synced_at: now })
        .in('id', toCancel.map((m) => m.id))
    }

    await supabase.from('audit_log').insert({
      action: 'sync_completed',
      entity_type: 'manual',
      metadata: { members_synced: members.length, members_cancelled: toCancel.length },
    })

    return NextResponse.json({ ok: true, synced: members.length, cancelled: toCancel.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function mapStatus(orndStatus: string): string {
  const map: Record<string, string> = {
    active: 'active',
    former: 'cancelled',
    inactive: 'cancelled',
    cancelled: 'cancelled',
    paused: 'paused',
    'drop-in': 'contact',
    lead: 'contact',
    pending: 'contact',
    contact: 'contact',
  }
  return map[orndStatus.toLowerCase()] ?? 'contact'
}
