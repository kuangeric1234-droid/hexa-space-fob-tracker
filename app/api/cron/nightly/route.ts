import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchAllMembers, resolveAllCompanies, fetchActiveMemberships, buildSuiteMaps, getFeeStatus } from '@/lib/officernd/client'
import { sendDigestEmail } from '@/lib/email/digest'
import { daysOverdue } from '@/lib/utils'
import type { AssignmentWithRelations } from '@/types'

export async function GET(request: NextRequest) {
  // Authenticate cron request
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const supabase = await createServiceClient()

  try {
    // ── Step 1: Sync members from OfficeRnD ─────────────────────────────────
    const orndMembers = await fetchAllMembers()

    if (orndMembers.length === 0) {
      throw new Error('OfficeRnD returned 0 members — aborting to avoid marking all as cancelled')
    }

    const [companyMap, memberships] = await Promise.all([
      resolveAllCompanies(orndMembers),
      fetchActiveMemberships(),
    ])
    const { memberSuiteMap, teamSuiteMap, memberParkingMap, teamParkingMap } = buildSuiteMaps(memberships)

    const now = new Date().toISOString()
    const orndIds = new Set(orndMembers.map((m) => m._id))

    // Upsert members
    for (const m of orndMembers) {
      const companyId = m.team ?? (typeof m.company === 'string' ? m.company : m.company?._id)
      const locationId = m.office ?? (typeof m.location === 'string' ? m.location : (m.location as any)?._id)

      await supabase.from('members').upsert(
        {
          officernd_id: m._id,
          name: m.name,
          email: m.email ?? null,
          company: companyId ? (companyMap.get(companyId) ?? null) : null,
          suite: memberSuiteMap.get(m._id) ?? (companyId ? teamSuiteMap.get(companyId) : null) ?? null,
          parking: memberParkingMap.get(m._id) ?? (companyId ? teamParkingMap.get(companyId) : null) ?? null,
          status: mapStatus(m.calculatedStatus ?? m.status),
          last_synced_at: now,
        },
        { onConflict: 'officernd_id' }
      )
    }

    // Mark missing members as cancelled
    const { data: existingMembers } = await supabase
      .from('members')
      .select('id, officernd_id')

    const toCancel = (existingMembers ?? []).filter((m) => !orndIds.has(m.officernd_id))
    if (toCancel.length > 0) {
      await supabase
        .from('members')
        .update({ status: 'cancelled', last_synced_at: now })
        .in('id', toCancel.map((m) => m.id))
    }

    // ── Step 2: Refresh deposit statuses ───────────────────────────────────
    const { data: openAssignmentsWithFees } = await supabase
      .from('assignments')
      .select('id, officernd_fee_id, deposit_status')
      .is('returned_at', null)
      .not('officernd_fee_id', 'is', null)

    for (const a of openAssignmentsWithFees ?? []) {
      try {
        const status = await getFeeStatus(a.officernd_fee_id!)
        const mapped = mapFeeStatus(status)
        if (mapped && mapped !== a.deposit_status) {
          await supabase
            .from('assignments')
            .update({ deposit_status: mapped })
            .eq('id', a.id)
        }
      } catch {
        // Non-fatal — skip this fee
      }
    }

    // ── Step 3: Find action items ──────────────────────────────────────────
    const { data: openAssignments } = await supabase
      .from('assignments')
      .select('*, fob:fobs(*), member:members(*)')
      .is('returned_at', null)

    const nowDate = new Date()
    const open = (openAssignments as AssignmentWithRelations[] | null) ?? []

    const overdue = open.filter((a) => {
      return a.expected_return_at && new Date(a.expected_return_at) < nowDate
    })

    const cancelledWithFobs = open.filter((a) => {
      return (a.member as any)?.status === 'cancelled'
    })

    const unpaidOld = open.filter((a) => {
      if (a.deposit_status !== 'pending' && a.deposit_status !== 'failed') return false
      return daysOverdue(a.issued_at) > 30
    })

    // ── Step 4: Send digest email if needed ───────────────────────────────
    const { data: settings } = await supabase
      .from('app_settings')
      .select('notification_email')
      .eq('id', 1)
      .single()

    const notificationEmail = settings?.notification_email ?? process.env.NOTIFICATION_EMAIL

    if (notificationEmail && (overdue.length > 0 || cancelledWithFobs.length > 0 || unpaidOld.length > 0)) {
      await sendDigestEmail(notificationEmail, { overdue, cancelledWithFobs, unpaidOld })
    }

    const duration = Date.now() - startedAt

    // ── Step 5: Log run ────────────────────────────────────────────────────
    await supabase.from('audit_log').insert({
      action: 'sync_completed',
      entity_type: 'cron',
      metadata: {
        members_synced: orndMembers.length,
        members_cancelled: toCancel.length,
        overdue_count: overdue.length,
        cancelled_with_fobs: cancelledWithFobs.length,
        unpaid_old: unpaidOld.length,
        email_sent: !!notificationEmail && (overdue.length + cancelledWithFobs.length + unpaidOld.length) > 0,
        duration_ms: duration,
      },
    })

    return NextResponse.json({
      ok: true,
      members_synced: orndMembers.length,
      overdue: overdue.length,
      cancelled_with_fobs: cancelledWithFobs.length,
      unpaid_old: unpaidOld.length,
      duration_ms: duration,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    await supabase.from('audit_log').insert({
      action: 'sync_failed',
      entity_type: 'cron',
      metadata: { error: message, duration_ms: Date.now() - startedAt },
    })

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

function mapFeeStatus(orndStatus: string): string | null {
  const map: Record<string, string> = {
    paid: 'paid',
    unpaid: 'pending',
    overdue: 'pending',
    voided: 'waived',
    refunded: 'refunded',
  }
  return map[orndStatus.toLowerCase()] ?? null
}
